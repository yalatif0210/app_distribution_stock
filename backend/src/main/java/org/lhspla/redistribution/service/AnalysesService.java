package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.response.AnalysesDTO;
import org.lhspla.redistribution.dto.response.AnalysesDTO.*;
import org.lhspla.redistribution.entity.*;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Analyses d'un plan (onglet « Analyses ») et tendances des indicateurs.
 *
 * Chaque analyse produit des chiffres, une lecture et des actions « À faire », par des règles
 * dont les seuils sont les barèmes administrables (ParametresAnalyseService). Les règles sont
 * décrites dans docs/manuels/indicateurs.md.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnalysesService {

    private static final DateTimeFormatter JOUR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final double JOURS_PAR_MOIS = 30.4;

    private final PlanReattributionRepository planRepo;
    private final LignePlanRepository ligneRepo;
    private final PeriodeSaisieRepository periodeRepo;
    private final SaisieStockRepository saisieRepo;
    private final StructureProgrammeProduitRepository sppRepo;
    private final SeuilsStatutService seuilsStatut;
    private final AnalyseStockService analyseStockService;
    private final ParametresAnalyseService parametres;

    /** Situation d'un couple site/produit avant et après le plan. */
    private static final class Couple {
        SaisieStock saisie;
        BigDecimal stockAvant, cmm, stockApres;
        BigDecimal cede = BigDecimal.ZERO;
        String cle() { return saisie.getStructure().getId() + "_" + saisie.getProduit().getId(); }
        boolean consomme() { return cmm != null && cmm.signum() > 0; }
        Double msdAvant() { return consomme() ? stockAvant.doubleValue() / cmm.doubleValue() : null; }
        Double msdApres() { return consomme() ? stockApres.doubleValue() / cmm.doubleValue() : null; }
        String site() { return saisie.getStructure().getNom(); }
        String produit() { return saisie.getProduit().getNom(); }
    }

    public AnalysesDTO calculer(Long periodeId, Long programmeId, Long regionId, Long planId, String base) {
        PlanReattribution plan = planRepo.findById(planId).orElseThrow(() -> BusinessException.notFound("Plan", planId));
        PeriodeSaisie periode = periodeRepo.findById(periodeId).orElseThrow(() -> BusinessException.notFound("Période", periodeId));
        boolean surExecute = !"BROUILLON".equals(plan.getStatut()) && !"PREVUE".equalsIgnoreCase(base);
        ParametresAnalyseService.Baremes b = parametres.baremes();

        // Situation avant (états soumis) et après (quantités prévues ou exécutées)
        Map<String, Couple> couples = new LinkedHashMap<>();
        for (SaisieStock s : saisieRepo.findSubmittedByPeriodeAndProgrammeAndRegion(periodeId, programmeId, regionId)) {
            Couple c = new Couple();
            c.saisie = s;
            c.stockAvant = Optional.ofNullable(s.getStockDisponible()).orElse(BigDecimal.ZERO);
            c.cmm = s.getCmm();
            c.stockApres = c.stockAvant;
            couples.put(c.cle(), c);
        }
        List<LignePlan> lignes = ligneRepo.findByPlanId(planId).stream()
                .filter(l -> !"ANNULE".equals(l.getStatut()) && l.getProduit() != null
                        && l.getStructureSource() != null && l.getStructureCible() != null).toList();
        for (LignePlan l : lignes) {
            BigDecimal q = surExecute ? l.getQuantiteExecutee() : l.getQuantiteProposee();
            if (q == null || q.signum() <= 0) continue;
            Couple src = couples.get(l.getStructureSource().getId() + "_" + l.getProduit().getId());
            Couple cib = couples.get(l.getStructureCible().getId() + "_" + l.getProduit().getId());
            if (src != null) { src.stockApres = src.stockApres.subtract(q).max(BigDecimal.ZERO); src.cede = src.cede.add(q); }
            if (cib != null) cib.stockApres = cib.stockApres.add(q);
        }

        AnalysesDTO dto = new AnalysesDTO();
        dto.setBaseApres(surExecute ? "EXECUTEE" : "PREVUE");
        dto.setBaremes(b);
        matrice(dto.getMatrice(), couples.values(), b);
        dispersion(dto.getDispersion(), couples.values(), b);
        peremptions(dto.getPeremptions(), couples.values());
        alerte(dto.getAlerte(), couples.values(), periode, b);
        chroniques(dto.getChroniques(), periode, programmeId, regionId, b);
        fiabilite(dto.getFiabilite(), regionId, programmeId, b);
        dto.setFlux(flux(lignes));
        return dto;
    }

    // ── Statuts ──────────────────────────────────────────────────────────────

    private String statut(BigDecimal stock, BigDecimal cmm) {
        if (cmm == null || cmm.signum() <= 0) return stock.signum() > 0 ? "STOCK_DORMANT" : "RUPTURE";
        return seuilsStatut.statut(stock.divide(cmm, 2, RoundingMode.HALF_UP));
    }

    private static boolean critique(String statut) {
        return "RUPTURE".equals(statut) || "TENSION".equals(statut);
    }

    // ── 1. Matrice sites × produits ─────────────────────────────────────────

    private void matrice(Matrice m, Collection<Couple> couples, ParametresAnalyseService.Baremes b) {
        Map<Long, Element> sites = new TreeMap<>(), produits = new TreeMap<>();
        for (Couple c : couples) {
            Structure s = c.saisie.getStructure();
            Produit p = c.saisie.getProduit();
            sites.putIfAbsent(s.getId(), new Element(s.getId(), s.getCode(), s.getNom()));
            produits.putIfAbsent(p.getId(), new Element(p.getId(), p.getCode(), p.getNom()));
            Cellule cel = new Cellule();
            cel.setSiteId(s.getId());
            cel.setProduitId(p.getId());
            cel.setStatutAvant(statut(c.stockAvant, c.cmm));
            cel.setStatutApres(statut(c.stockApres, c.cmm));
            cel.setMsdAvant(arrondi(c.msdAvant()));
            cel.setMsdApres(arrondi(c.msdApres()));
            m.getCellules().add(cel);
        }
        m.setSites(sites.values().stream().sorted(Comparator.comparing(Element::getNom)).toList());
        m.setProduits(produits.values().stream().sorted(Comparator.comparing(Element::getNom)).toList());

        Interpretation it = m.getInterpretation();
        if (m.getCellules().isEmpty()) { it.getLecture().add("Aucun état de stock soumis pour ce programme sur la période."); return; }
        long rupAv = m.getCellules().stream().filter(c -> "RUPTURE".equals(c.getStatutAvant())).count();
        long rupAp = m.getCellules().stream().filter(c -> "RUPTURE".equals(c.getStatutApres())).count();
        long criAv = m.getCellules().stream().filter(c -> critique(c.getStatutAvant())).count();
        long criAp = m.getCellules().stream().filter(c -> critique(c.getStatutApres())).count();
        it.getLecture().add(String.format("%d couple(s) site/produit en rupture avant le plan, %d après ; en tension ou rupture : %d avant, %d après, sur %d couples.",
                rupAv, rupAp, criAv, criAp, m.getCellules().size()));

        // Sites fragiles : part de leurs produits en tension ou rupture après le plan
        Map<Long, List<Cellule>> parSite = m.getCellules().stream().collect(Collectors.groupingBy(Cellule::getSiteId));
        List<Map.Entry<Long, double[]>> fragiles = parSite.entrySet().stream()
                .map(e -> Map.entry(e.getKey(), new double[]{
                        e.getValue().stream().filter(c -> critique(c.getStatutApres())).count(), e.getValue().size()}))
                .filter(e -> e.getValue()[0] > 0 && e.getValue()[0] / e.getValue()[1] * 100 >= b.fragilitePct())
                .sorted(Comparator.comparingDouble((Map.Entry<Long, double[]> e) -> -e.getValue()[0] / e.getValue()[1]))
                .toList();
        if (fragiles.isEmpty()) {
            it.getLecture().add(String.format("Aucun site n'a %s %% ou plus de ses produits en tension ou rupture après le plan.", nf(b.fragilitePct())));
        } else {
            for (var e : fragiles.stream().limit(3).toList()) {
                String nom = sites.get(e.getKey()).getNom();
                it.getLecture().add(String.format("%s reste fragile : %d produit(s) sur %d en tension ou rupture après le plan.",
                        nom, (int) e.getValue()[0], (int) e.getValue()[1]));
                it.getAFaire().add(String.format("Vérifier la CMM déclarée et la dotation de %s : ses tensions touchent plusieurs produits.", nom));
            }
        }
        // Produit le plus tendu
        m.getCellules().stream().collect(Collectors.groupingBy(Cellule::getProduitId)).entrySet().stream()
                .map(e -> Map.entry(e.getKey(), new long[]{e.getValue().stream().filter(c -> critique(c.getStatutApres())).count(), e.getValue().size()}))
                .filter(e -> e.getValue()[0] > 0)
                .max(Comparator.comparingDouble(e -> (double) e.getValue()[0] / e.getValue()[1]))
                .ifPresent(e -> it.getLecture().add(String.format("Produit le plus tendu : %s, %d site(s) sur %d en tension ou rupture après le plan.",
                        produits.get(e.getKey()).getNom(), e.getValue()[0], e.getValue()[1])));
    }

    // ── 2. Dispersion des MSD ───────────────────────────────────────────────

    private void dispersion(Dispersion d, Collection<Couple> couples, ParametresAnalyseService.Baremes b) {
        Map<Long, List<Couple>> parProduit = couples.stream().filter(Couple::consomme)
                .collect(Collectors.groupingBy(c -> c.saisie.getProduit().getId()));
        for (List<Couple> l : parProduit.values()) {
            if (l.size() < 3) continue;          // une dispersion n'a pas de sens sous trois sites
            DispersionProduit dp = new DispersionProduit();
            dp.setProduitId(l.get(0).saisie.getProduit().getId());
            dp.setProduit(l.get(0).produit());
            dp.setNbSites(l.size());
            dp.setAvant(boite(l.stream().map(Couple::msdAvant).toList()));
            dp.setApres(boite(l.stream().map(Couple::msdApres).toList()));
            double iqrAv = dp.getAvant().getEcartInterquartile(), iqrAp = dp.getApres().getEcartInterquartile();
            if (iqrAv <= 0.0001) {
                dp.setVerdict("DEJA_EQUILIBRE");
            } else {
                double variation = (iqrAp - iqrAv) / iqrAv * 100;
                dp.setVariationPct(arrondi(variation));
                if (-variation >= b.equilibrageNetPct()) dp.setVerdict("NET");
                else if (-variation >= b.equilibrageModerePct()) dp.setVerdict("MODERE");
                else if (variation > b.equilibrageModerePct()) dp.setVerdict("DESEQUILIBRE");
                else dp.setVerdict("SANS_EFFET");
            }
            d.getProduits().add(dp);
        }
        d.getProduits().sort(Comparator.comparing(DispersionProduit::getProduit));

        Interpretation it = d.getInterpretation();
        if (d.getProduits().isEmpty()) { it.getLecture().add("Pas assez de sites (trois au moins par produit) pour mesurer l'équilibre du réseau."); return; }
        for (DispersionProduit p : d.getProduits()) {
            String ecart = String.format("l'écart entre sites passe de %s à %s mois", nf(p.getAvant().getEcartInterquartile()), nf(p.getApres().getEcartInterquartile()));
            switch (p.getVerdict()) {
                case "NET" -> it.getLecture().add(String.format("%s : %s (%s %%) : le plan équilibre nettement le réseau.", p.getProduit(), ecart, nf(p.getVariationPct())));
                case "MODERE" -> it.getLecture().add(String.format("%s : %s (%s %%) : équilibrage modéré.", p.getProduit(), ecart, nf(p.getVariationPct())));
                case "DESEQUILIBRE" -> {
                    it.getLecture().add(String.format("%s : %s (+%s %%) : le réseau est plus déséquilibré après le plan.", p.getProduit(), ecart, nf(p.getVariationPct())));
                    it.getAFaire().add(String.format("Revoir les mouvements de %s : ils accentuent les écarts entre sites.", p.getProduit()));
                }
                case "SANS_EFFET" -> {
                    it.getLecture().add(String.format("%s : %s : pas d'effet notable sur l'équilibre.", p.getProduit(), ecart));
                    if (p.getApres().getMin() < 1)
                        it.getAFaire().add(String.format("%s : des sites restent sous 1 mois sans rééquilibrage ; chercher d'autres sources (stocks dormants, autres régions) ou alerter le programme.", p.getProduit()));
                }
                default -> it.getLecture().add(String.format("%s : MSD déjà homogène entre sites (médiane %s mois).", p.getProduit(), nf(p.getAvant().getMediane())));
            }
        }
    }

    private static Boite boite(List<Double> valeurs) {
        List<Double> v = valeurs.stream().filter(Objects::nonNull).sorted().toList();
        Boite bt = new Boite();
        bt.setMin(arrondiP(v.get(0)));
        bt.setMax(arrondiP(v.get(v.size() - 1)));
        bt.setQ1(arrondiP(quantile(v, .25)));
        bt.setMediane(arrondiP(quantile(v, .5)));
        bt.setQ3(arrondiP(quantile(v, .75)));
        return bt;
    }

    /** Quantile par interpolation linéaire (méthode usuelle des tableurs). */
    private static double quantile(List<Double> tries, double q) {
        double pos = (tries.size() - 1) * q;
        int bas = (int) Math.floor(pos);
        int haut = (int) Math.ceil(pos);
        return tries.get(bas) + (tries.get(haut) - tries.get(bas)) * (pos - bas);
    }

    // ── 3. Péremptions évitées ──────────────────────────────────────────────

    private void peremptions(Peremptions p, Collection<Couple> couples) {
        for (Couple c : couples) {
            LocalDate peremption = c.saisie.getExpireDate();
            if (peremption == null || c.stockAvant.signum() <= 0) continue;
            // Part qui périmera avant d'être consommée : tout le stock s'il n'est pas consommé
            BigDecimal perimable = c.consomme() ? analyseStockService.surplusPerimable(c.saisie)
                    : (peremption.isAfter(LocalDate.now()) ? c.stockAvant : BigDecimal.ZERO);
            if (perimable.signum() <= 0) continue;
            BigDecimal evite = perimable.min(c.cede);
            BigDecimal reste = perimable.subtract(evite);
            if (evite.signum() > 0) p.getEvitees().add(lot(c, evite, peremption));
            if (reste.signum() > 0) p.getARisque().add(lot(c, reste, peremption));
        }
        p.getEvitees().sort(Comparator.comparing(LotPerimable::getDatePeremption));
        p.getARisque().sort(Comparator.comparing(LotPerimable::getDatePeremption));

        Interpretation it = p.getInterpretation();
        if (p.getEvitees().isEmpty() && p.getARisque().isEmpty()) {
            it.getLecture().add("Aucun lot ne risque de périmer avant d'être consommé.");
            return;
        }
        if (p.getEvitees().isEmpty()) {
            it.getLecture().add("Aucune quantité vouée à la péremption n'a été redistribuée par ce plan.");
        } else {
            String detail = p.getEvitees().stream().collect(Collectors.groupingBy(l -> l.getProduit() + "|" + l.getUnite(),
                            LinkedHashMap::new, Collectors.summingDouble(LotPerimable::getQuantite)))
                    .entrySet().stream().map(e -> e.getKey().split("\\|")[0] + " " + nf(e.getValue()) + " " + e.getKey().split("\\|")[1])
                    .collect(Collectors.joining(", "));
            it.getLecture().add("Quantités qui auraient périmé à la source et ont été redistribuées : " + detail + ".");
        }
        if (p.getARisque().isEmpty()) {
            it.getLecture().add("Tous les lots à risque de péremption sont redistribués.");
        } else {
            it.getLecture().add(String.format("%d lot(s) périmeront encore avant d'être consommés.", p.getARisque().size()));
            p.getARisque().stream().limit(5).forEach(l -> it.getAFaire().add(String.format(
                    "%s, %s : %s %s périmeront le %s ; chercher un destinataire.",
                    l.getSite(), l.getProduit(), nf(l.getQuantite()), l.getUnite(), l.getDatePeremption().format(JOUR))));
        }
    }

    private static LotPerimable lot(Couple c, BigDecimal q, LocalDate peremption) {
        LotPerimable l = new LotPerimable();
        l.setSite(c.site());
        l.setProduit(c.produit());
        l.setUnite(c.saisie.getProduit().getUnite());
        l.setQuantite(Math.floor(q.doubleValue()));
        l.setDatePeremption(peremption);
        return l;
    }

    // ── 4. Alerte précoce ───────────────────────────────────────────────────

    private void alerte(Alerte a, Collection<Couple> couples, PeriodeSaisie periode, ParametresAnalyseService.Baremes b) {
        LocalDate aujourdhui = LocalDate.now();
        LocalDate dateEtat = periode.getDateRas() != null ? periode.getDateRas() : aujourdhui;
        long age = Math.max(0, ChronoUnit.DAYS.between(dateEtat, aujourdhui));
        a.setHorizonJours(b.alerteHorizonJours());
        a.setAgeEtatJours(age);
        for (Couple c : couples) {
            if (!c.consomme()) continue;
            long joursAvant = Math.round(c.msdAvant() * JOURS_PAR_MOIS) - age;
            long joursApres = Math.round(c.msdApres() * JOURS_PAR_MOIS) - age;
            if (joursAvant < b.alerteHorizonJours()) a.setNbAvant(a.getNbAvant() + 1);
            if (joursApres < b.alerteHorizonJours()) {
                a.setNbApres(a.getNbApres() + 1);
                RuptureAVenir r = new RuptureAVenir();
                r.setSite(c.site());
                r.setProduit(c.produit());
                r.setJoursRestants(Math.max(0, joursApres));
                r.setDateEstimee(aujourdhui.plusDays(Math.max(0, joursApres)));
                a.getRestantes().add(r);
            }
        }
        a.getRestantes().sort(Comparator.comparingLong(RuptureAVenir::getJoursRestants));

        Interpretation it = a.getInterpretation();
        it.getLecture().add(String.format("Sans le plan, %d couple(s) site/produit seraient en rupture d'ici %d jours ; avec le plan, %d.",
                a.getNbAvant(), b.alerteHorizonJours(), a.getNbApres()));
        if (age > 45) it.getLecture().add(String.format("L'état de stock date de %d jours : ces estimations supposent une consommation régulière depuis, à confirmer par un nouvel état.", age));
        a.getRestantes().stream().limit(5).forEach(r -> it.getAFaire().add(String.format(
                "%s, %s : rupture estimée %s ; prévoir un réapprovisionnement.", r.getSite(), r.getProduit(),
                r.getJoursRestants() == 0 ? "dès maintenant" : "le " + r.getDateEstimee().format(JOUR))));
        if (a.getNbApres() == 0) it.getLecture().add("Aucune rupture n'est attendue dans l'horizon après le plan.");
    }

    // ── 5. Ruptures et surstocks chroniques ─────────────────────────────────

    private void chroniques(Chroniques ch, PeriodeSaisie periode, Long programmeId, Long regionId, ParametresAnalyseService.Baremes b) {
        ch.setFenetre(b.chroniqueFenetre());
        ch.setOccurrences(b.chroniqueOccurrences());
        List<PeriodeSaisie> periodes = periodeRepo.findByRegionIdOrderByDateRasDesc(regionId).stream()
                .filter(p -> p.getDateRas() != null && periode.getDateRas() != null && !p.getDateRas().isAfter(periode.getDateRas()))
                .limit(b.chroniqueFenetre()).toList();
        ch.setPeriodesAnalysees(periodes.size());
        Interpretation it = ch.getInterpretation();
        if (periodes.size() < b.chroniqueOccurrences()) {
            it.getLecture().add(String.format("Historique insuffisant : %d période(s) disponible(s), il en faut au moins %d pour parler de situation chronique.",
                    periodes.size(), b.chroniqueOccurrences()));
            return;
        }
        Map<String, Integer> ruptures = new HashMap<>(), surstocks = new HashMap<>();
        Map<String, String[]> noms = new HashMap<>();
        Map<String, Set<Long>> sitesSuivis = new HashMap<>();
        for (PeriodeSaisie p : periodes) {
            for (SaisieStock s : saisieRepo.findSubmittedByPeriodeAndProgrammeAndRegion(p.getId(), programmeId, regionId)) {
                String cle = s.getStructure().getId() + "_" + s.getProduit().getId();
                noms.put(cle, new String[]{s.getStructure().getNom(), s.getProduit().getNom()});
                sitesSuivis.computeIfAbsent(s.getProduit().getNom(), k -> new HashSet<>()).add(s.getStructure().getId());
                String st = statut(Optional.ofNullable(s.getStockDisponible()).orElse(BigDecimal.ZERO), s.getCmm());
                if ("RUPTURE".equals(st)) ruptures.merge(cle, 1, Integer::sum);
                if ("SURSTOCK".equals(st) || "STOCK_DORMANT".equals(st)) surstocks.merge(cle, 1, Integer::sum);
            }
        }
        ruptures.forEach((cle, n) -> {
            if (n < b.chroniqueOccurrences()) return;
            Chronique c = new Chronique();
            c.setSite(noms.get(cle)[0]);
            c.setProduit(noms.get(cle)[1]);
            c.setNbFois(n);
            ch.getRuptures().add(c);
        });
        ch.getRuptures().sort(Comparator.comparingInt(Chronique::getNbFois).reversed().thenComparing(Chronique::getProduit));
        Map<String, Long> surstockParProduit = surstocks.entrySet().stream().filter(e -> e.getValue() >= b.chroniqueOccurrences())
                .collect(Collectors.groupingBy(e -> noms.get(e.getKey())[1], Collectors.counting()));
        surstockParProduit.forEach((produit, n) -> {
            SurstockProduit sp = new SurstockProduit();
            sp.setProduit(produit);
            sp.setNbSites(n.intValue());
            sp.setNbSitesSuivis(sitesSuivis.getOrDefault(produit, Set.of()).size());
            ch.getSurstocks().add(sp);
        });
        ch.getSurstocks().sort(Comparator.comparingInt(SurstockProduit::getNbSites).reversed());

        String regle = String.format("au moins %d fois sur les %d dernières périodes", b.chroniqueOccurrences(), periodes.size());
        if (ch.getRuptures().isEmpty()) {
            it.getLecture().add("Aucune rupture chronique (" + regle + ").");
        } else {
            ch.getRuptures().stream().limit(5).forEach(c -> it.getLecture().add(String.format(
                    "%s en rupture à %s %d fois sur les %d dernières périodes, malgré les plans.", c.getProduit(), c.getSite(), c.getNbFois(), periodes.size())));
            it.getAFaire().add("Signaler les ruptures chroniques au programme : ce n'est plus un problème de redistribution mais de dotation (ou de CMM sous-estimée).");
        }
        ch.getSurstocks().stream().filter(sp -> sp.getNbSitesSuivis() > 0 && sp.getNbSites() * 2 >= sp.getNbSitesSuivis())
                .forEach(sp -> {
                    it.getLecture().add(String.format("%s en surstock dans %d site(s) sur %d de façon chronique.", sp.getProduit(), sp.getNbSites(), sp.getNbSitesSuivis()));
                    it.getAFaire().add(String.format("%s : dotation probablement excessive, à revoir avec le programme.", sp.getProduit()));
                });
    }

    // ── 6. Fiabilité de l'exécution ─────────────────────────────────────────

    private void fiabilite(Fiabilite f, Long regionId, Long programmeId, ParametresAnalyseService.Baremes b) {
        LocalDateTime depuis = LocalDateTime.now().minusMonths(12);
        List<PlanReattribution> plans = planRepo.findValidesEntre(depuis, LocalDateTime.now().plusDays(1)).stream()
                .filter(p -> !"BROUILLON".equals(p.getStatut()) && p.getRegion() != null && regionId.equals(p.getRegion().getId())
                        && (programmeId == null || (p.getProgramme() != null && programmeId.equals(p.getProgramme().getId()))))
                .toList();
        f.setNbPlans(plans.size());
        Map<String, List<double[]>> parSite = new TreeMap<>();   // taux, enRetard, délai (-1 si inconnu)
        for (PlanReattribution p : plans) {
            for (LignePlan l : Optional.ofNullable(p.getLignes()).orElse(List.of())) {
                if ("ANNULE".equals(l.getStatut()) || l.getStructureSource() == null) continue;
                double prevu = valeur(l.getQuantiteProposee());
                if (prevu <= 0) continue;
                double taux = Math.min(1, valeur(l.getQuantiteExecutee()) / prevu);
                boolean termine = "EXECUTE".equals(l.getStatut());
                boolean retard = !termine && p.getDateValidation() != null
                        && ChronoUnit.DAYS.between(p.getDateValidation(), LocalDateTime.now()) > b.retardJours();
                double delai = l.dateEffectiveReception() != null && p.getDateValidation() != null
                        ? Math.max(0, ChronoUnit.DAYS.between(p.getDateValidation().toLocalDate(), l.dateEffectiveReception())) : -1;
                parSite.computeIfAbsent(l.getStructureSource().getNom(), k -> new ArrayList<>()).add(new double[]{taux, retard ? 1 : 0, delai});
            }
        }
        parSite.forEach((site, mvts) -> {
            FiabiliteSite fs = new FiabiliteSite();
            fs.setSite(site);
            fs.setNbMouvements(mvts.size());
            fs.setTauxLivraison(arrondi(mvts.stream().mapToDouble(x -> x[0]).average().orElse(0) * 100));
            fs.setNbEnRetard((int) mvts.stream().filter(x -> x[1] > 0).count());
            mvts.stream().filter(x -> x[2] >= 0).mapToDouble(x -> x[2]).average().ifPresent(v -> fs.setDelaiMoyenJours(arrondi(v)));
            fs.setVerdict(fs.getTauxLivraison() >= b.fiabiliteBonnePct() ? "BONNE"
                    : fs.getTauxLivraison() < b.fiabiliteFaiblePct() ? "FAIBLE" : "MOYENNE");
            f.getSites().add(fs);
        });
        f.getSites().sort(Comparator.comparingDouble(FiabiliteSite::getTauxLivraison));

        Interpretation it = f.getInterpretation();
        if (f.getSites().isEmpty()) {
            it.getLecture().add("Aucun plan validé dans les 12 derniers mois pour ce programme : pas encore d'historique d'exécution.");
            return;
        }
        it.getLecture().add(String.format("Sur %d plan(s) validé(s) des 12 derniers mois, %d site(s) expéditeur(s) suivis.", plans.size(), f.getSites().size()));
        FiabiliteSite meilleur = f.getSites().get(f.getSites().size() - 1), moins = f.getSites().get(0);
        if (f.getSites().size() > 1) {
            it.getLecture().add(String.format("%s a livré en moyenne %s %% des quantités prévues, contre %s %% pour %s.",
                    moins.getSite(), nf(moins.getTauxLivraison()), nf(meilleur.getTauxLivraison()), meilleur.getSite()));
        }
        for (FiabiliteSite fs : f.getSites()) {
            if ("FAIBLE".equals(fs.getVerdict()) || fs.getNbEnRetard() > 0) {
                it.getAFaire().add(String.format("%s : %s %% livré%s ; vérifier ses moyens d'acheminement avant de le solliciter au prochain plan.",
                        fs.getSite(), nf(fs.getTauxLivraison()),
                        fs.getNbEnRetard() > 0 ? ", " + fs.getNbEnRetard() + " mouvement(s) en retard de plus de " + b.retardJours() + " jours" : ""));
            }
        }
        if (it.getAFaire().isEmpty()) it.getLecture().add("Tous les sites expéditeurs livrent correctement.");
    }

    // ── Flux entre districts ────────────────────────────────────────────────

    private static List<Flux> flux(List<LignePlan> lignes) {
        Map<String, List<LignePlan>> groupes = lignes.stream().collect(Collectors.groupingBy(l ->
                nomDistrict(l.getStructureSource()) + "→" + nomDistrict(l.getStructureCible()), TreeMap::new, Collectors.toList()));
        return groupes.entrySet().stream().map(e -> {
            Flux f = new Flux();
            String[] parts = e.getKey().split("→", 2);
            f.setDistrictSource(parts[0]);
            f.setDistrictCible(parts[1]);
            f.setNbMouvements(e.getValue().size());
            f.setNbProduits((int) e.getValue().stream().map(l -> l.getProduit().getId()).distinct().count());
            return f;
        }).sorted(Comparator.comparingInt(Flux::getNbMouvements).reversed()).toList();
    }

    private static String nomDistrict(Structure s) {
        return s.getDistrict() != null ? s.getDistrict().getNom() : "Sans district";
    }

    // ── Tendances des indicateurs (mini-courbes des cartes) ─────────────────

    public record Tendance(String periode, double tauxDisponibilite, double tauxBienStocke, double indiceRisque) {}

    /** Indicateurs « avant plan » des dernières périodes de la région, jusqu'à la période donnée incluse. */
    public List<Tendance> tendances(Long regionId, Long programmeId, Long periodeId, int nombre) {
        PeriodeSaisie courante = periodeRepo.findById(periodeId).orElseThrow(() -> BusinessException.notFound("Période", periodeId));
        Set<String> geres = sppRepo.findGeresDansRegion(programmeId, regionId).stream()
                .map(spp -> spp.getStructure().getId() + "_" + spp.getProduit().getId()).collect(Collectors.toSet());
        List<PeriodeSaisie> periodes = new ArrayList<>(periodeRepo.findByRegionIdOrderByDateRasDesc(regionId).stream()
                .filter(p -> p.getDateRas() != null && courante.getDateRas() != null && !p.getDateRas().isAfter(courante.getDateRas()))
                .limit(nombre).toList());
        Collections.reverse(periodes);
        List<Tendance> resultat = new ArrayList<>();
        for (PeriodeSaisie p : periodes) {
            List<SaisieStock> saisies = saisieRepo.findSubmittedByPeriodeAndProgrammeAndRegion(p.getId(), programmeId, regionId);
            if (saisies.isEmpty()) continue;
            Set<String> univers = new HashSet<>(geres);
            saisies.forEach(s -> univers.add(s.getStructure().getId() + "_" + s.getProduit().getId()));
            long dispo = 0, bien = 0; double risque = 0;
            for (SaisieStock s : saisies) {
                BigDecimal stock = Optional.ofNullable(s.getStockDisponible()).orElse(BigDecimal.ZERO);
                if (stock.signum() > 0) dispo++;
                String st = statut(stock, s.getCmm());
                if ("BIEN_STOCKE".equals(st)) bien++;
                risque += switch (st) { case "RUPTURE" -> 3; case "TENSION" -> 2; case "SURSTOCK", "STOCK_DORMANT" -> 1; default -> 0; };
            }
            resultat.add(new Tendance(p.getDateRas().format(DateTimeFormatter.ofPattern("MM/yyyy")),
                    arrondi((double) dispo / univers.size() * 100), arrondi((double) bien / saisies.size() * 100),
                    Math.round(risque / saisies.size() * 100.0) / 100.0));
        }
        return resultat;
    }

    // ── Outils ──────────────────────────────────────────────────────────────

    private static double valeur(BigDecimal b) { return b != null ? b.doubleValue() : 0; }

    private static Double arrondi(Double v) { return v == null ? null : Math.round(v * 10.0) / 10.0; }

    private static double arrondiP(double v) { return Math.round(v * 100.0) / 100.0; }

    /** Nombre à la française, sans décimale inutile. */
    private static String nf(double v) {
        if (v == Math.rint(v)) return String.valueOf((long) v);
        return String.format(Locale.FRANCE, "%.1f", v);
    }
}
