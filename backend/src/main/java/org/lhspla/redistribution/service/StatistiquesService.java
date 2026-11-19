package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.response.StatistiquesDTO;
import org.lhspla.redistribution.entity.LignePlan;
import org.lhspla.redistribution.entity.PlanReattribution;
import org.lhspla.redistribution.entity.Region;
import org.lhspla.redistribution.entity.SaisieStock;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.PlanReattributionRepository;
import org.lhspla.redistribution.repository.ProgrammeRepository;
import org.lhspla.redistribution.repository.RegionRepository;
import org.lhspla.redistribution.repository.SaisieStockRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Statistiques des plans de redéploiement validés entre deux dates (date de validation du plan).
 *
 * Plans pris en compte : validés, en cours ou clôturés (les brouillons sont exclus), validés
 * entre « debut » et « fin » inclus, dans les régions du périmètre. Les mouvements sont les
 * lignes non annulées de ces plans.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StatistiquesService {

    private static final Set<String> STATUTS_PLANS = Set.of("VALIDE", "EN_COURS", "CLOTURE");
    private static final DateTimeFormatter MOIS = DateTimeFormatter.ofPattern("MM/yyyy");

    private final PlanReattributionRepository planRepo;
    private final RegionRepository regionRepo;
    private final ProgrammeRepository programmeRepo;
    private final SaisieStockRepository saisieRepo;

    /** Un mouvement et ce qu'il faut en savoir pour les agrégats. */
    private record Mvt(PlanReattribution plan, LignePlan ligne, boolean execute, boolean rupture) {
        double prevu() { return valeur(ligne.getQuantiteProposee()); }
        double realise() { return valeur(ligne.getQuantiteExecutee()); }
        String cleCible() {
            return plan.getPeriode().getId() + "_" + ligne.getStructureCible().getId() + "_" + ligne.getProduit().getId();
        }
    }

    /**
     * @param regionIds régions du périmètre (null = toutes : niveau national, admin)
     */
    public StatistiquesDTO calculer(LocalDate debut, LocalDate fin, Set<Long> regionIds, Long programmeId) {
        if (debut == null || fin == null || fin.isBefore(debut)) {
            throw BusinessException.badRequest("Plage de dates invalide : la date de fin doit suivre la date de début.");
        }
        List<PlanReattribution> plans = planRepo.findValidesEntre(debut.atStartOfDay(), fin.plusDays(1).atStartOfDay()).stream()
                .filter(p -> STATUTS_PLANS.contains(p.getStatut()))
                .filter(p -> regionIds == null || (p.getRegion() != null && regionIds.contains(p.getRegion().getId())))
                .filter(p -> programmeId == null || (p.getProgramme() != null && programmeId.equals(p.getProgramme().getId())))
                .sorted(Comparator.comparing(PlanReattribution::getDateValidation))
                .toList();

        // Statut des sites destinataires avant le plan (état de stock de la période du plan)
        Map<Long, Map<String, String>> statutsParPeriode = new HashMap<>();
        List<Mvt> mvts = new ArrayList<>();
        for (PlanReattribution p : plans) {
            Map<String, String> statuts = statutsParPeriode.computeIfAbsent(p.getPeriode().getId(), id ->
                    saisieRepo.findByPeriodeId(id).stream().collect(Collectors.toMap(
                            s -> s.getStructure().getId() + "_" + s.getProduit().getId(),
                            s -> Objects.toString(s.getStatutStock(), ""), (a, b) -> a)));
            for (LignePlan l : Optional.ofNullable(p.getLignes()).orElse(List.of())) {
                if ("ANNULE".equals(l.getStatut()) || l.getProduit() == null
                        || l.getStructureSource() == null || l.getStructureCible() == null) continue;
                boolean execute = "EXECUTE".equals(l.getStatut()) || "PARTIEL".equals(l.getStatut());
                boolean rupture = "RUPTURE".equals(statuts.get(l.getStructureCible().getId() + "_" + l.getProduit().getId()));
                mvts.add(new Mvt(p, l, execute, rupture));
            }
        }

        StatistiquesDTO dto = new StatistiquesDTO();
        dto.setDebut(debut);
        dto.setFin(fin);
        dto.setNiveau(libelleNiveau(regionIds));
        dto.setProgramme(programmeId == null ? "Tous les programmes"
                : programmeRepo.findById(programmeId).map(pr -> pr.getNom()).orElse("Programme " + programmeId));

        // ── Synthèse ─────────────────────────────────────────────────────────
        StatistiquesDTO.Synthese s = dto.getSynthese();
        s.setNbPlans(plans.size());
        s.setNbPlansClotures((int) plans.stream().filter(p -> "CLOTURE".equals(p.getStatut())).count());
        s.setNbRegions((int) plans.stream().map(p -> p.getRegion().getId()).distinct().count());
        s.setNbMouvements(mvts.size());
        s.setNbExecutes((int) mvts.stream().filter(m -> "EXECUTE".equals(m.ligne().getStatut())).count());
        s.setNbPartiels((int) mvts.stream().filter(m -> "PARTIEL".equals(m.ligne().getStatut())).count());
        s.setNbEnAttente(s.getNbMouvements() - s.getNbExecutes() - s.getNbPartiels());
        s.setTauxExecutionMouvements(pct(s.getNbExecutes() + s.getNbPartiels(), s.getNbMouvements()));
        s.setTauxExecutionQuantites(pct(somme(mvts, Mvt::realise), somme(mvts, Mvt::prevu)));
        List<Double> delais = mvts.stream()
                .filter(m -> m.execute() && m.ligne().getDateExecution() != null && m.plan().getDateValidation() != null)
                .map(m -> (double) Math.max(0, ChronoUnit.DAYS.between(
                        m.plan().getDateValidation().toLocalDate(), m.ligne().getDateExecution().toLocalDate())))
                .sorted().toList();
        if (!delais.isEmpty()) {
            s.setDelaiMoyenJours(arrondi(delais.stream().mapToDouble(Double::doubleValue).average().orElse(0)));
            int n = delais.size();
            s.setDelaiMedianJours(arrondi(n % 2 == 1 ? delais.get(n / 2) : (delais.get(n / 2 - 1) + delais.get(n / 2)) / 2));
        }
        s.setNbCiblesServies((int) mvts.stream().filter(m -> m.realise() > 0).map(Mvt::cleCible).distinct().count());
        s.setNbRupturesResorbees(rupturesResorbees(mvts));

        // ── Agrégats ─────────────────────────────────────────────────────────
        dto.setParRegion(grouper(mvts, plans, p -> p.getRegion().getNom()));
        dto.setParProgramme(grouper(mvts, plans, p -> p.getProgramme() != null ? p.getProgramme().getNom() : "Tous programmes"));
        dto.setParMois(grouper(mvts, plans, p -> p.getDateValidation().format(MOIS)).stream()
                .sorted(Comparator.comparing(g -> LocalDate.parse("01/" + g.getLibelle(), DateTimeFormatter.ofPattern("dd/MM/yyyy"))))
                .toList());
        dto.setParProduit(parProduit(mvts));
        dto.setSitesSources(sites(mvts, true));
        dto.setSitesCibles(sites(mvts, false));
        return dto;
    }

    private String libelleNiveau(Set<Long> regionIds) {
        if (regionIds == null) return "National";
        List<String> noms = regionRepo.findAllById(regionIds).stream().map(Region::getNom).sorted().toList();
        if (noms.size() == 1) return noms.get(0).toLowerCase().startsWith("région") ? noms.get(0) : "Région " + noms.get(0);
        return "Périmètre : " + String.join(", ", noms);
    }

    private static int rupturesResorbees(List<Mvt> mvts) {
        return (int) mvts.stream().filter(m -> m.rupture() && m.realise() > 0).map(Mvt::cleCible).distinct().count();
    }

    private static List<StatistiquesDTO.Groupe> grouper(List<Mvt> mvts, List<PlanReattribution> plans,
                                                       Function<PlanReattribution, String> cle) {
        Map<String, List<Mvt>> parCle = mvts.stream().collect(Collectors.groupingBy(m -> cle.apply(m.plan()), TreeMap::new, Collectors.toList()));
        Map<String, Long> plansParCle = plans.stream().collect(Collectors.groupingBy(cle, Collectors.counting()));
        // Un plan sans mouvement compte aussi
        plansParCle.keySet().forEach(k -> parCle.putIfAbsent(k, List.of()));
        return parCle.entrySet().stream().map(e -> {
            List<Mvt> l = e.getValue();
            StatistiquesDTO.Groupe g = new StatistiquesDTO.Groupe();
            g.setLibelle(e.getKey());
            g.setNbPlans(plansParCle.getOrDefault(e.getKey(), 0L).intValue());
            g.setNbMouvements(l.size());
            g.setNbExecutesAuMoinsEnPartie((int) l.stream().filter(Mvt::execute).count());
            g.setTauxExecutionMouvements(pct(g.getNbExecutesAuMoinsEnPartie(), l.size()));
            g.setTauxExecutionQuantites(pct(somme(l, Mvt::realise), somme(l, Mvt::prevu)));
            g.setNbRupturesResorbees(rupturesResorbees(l));
            return g;
        }).sorted(Comparator.comparing(StatistiquesDTO.Groupe::getLibelle)).toList();
    }

    private static List<StatistiquesDTO.Produit> parProduit(List<Mvt> mvts) {
        return mvts.stream().collect(Collectors.groupingBy(m -> m.ligne().getProduit().getId())).values().stream().map(l -> {
            var produit = l.get(0).ligne().getProduit();
            StatistiquesDTO.Produit p = new StatistiquesDTO.Produit();
            p.setProgramme(produit.getProgramme() != null ? produit.getProgramme().getNom() : "");
            p.setCode(produit.getCode());
            p.setNom(produit.getNom());
            p.setUnite(produit.getUnite());
            p.setNbMouvements(l.size());
            p.setQuantitePrevue(arrondi(somme(l, Mvt::prevu)));
            p.setQuantiteExecutee(arrondi(somme(l, Mvt::realise)));
            p.setTauxExecutionQuantites(pct(p.getQuantiteExecutee(), p.getQuantitePrevue()));
            return p;
        }).sorted(Comparator.comparing(StatistiquesDTO.Produit::getProgramme).thenComparing(StatistiquesDTO.Produit::getNom)).toList();
    }

    /** Sites les plus sollicités (sources) ou servis (destinataires), par nombre de mouvements. */
    private static List<StatistiquesDTO.Site> sites(List<Mvt> mvts, boolean sources) {
        return mvts.stream().collect(Collectors.groupingBy(m ->
                (sources ? m.ligne().getStructureSource() : m.ligne().getStructureCible()).getId())).values().stream().map(l -> {
            var structure = sources ? l.get(0).ligne().getStructureSource() : l.get(0).ligne().getStructureCible();
            StatistiquesDTO.Site st = new StatistiquesDTO.Site();
            st.setNom(structure.getNom());
            st.setRegion(l.get(0).plan().getRegion().getNom());
            st.setNbMouvements(l.size());
            st.setNbExecutesAuMoinsEnPartie((int) l.stream().filter(Mvt::execute).count());
            st.setNbProduits((int) l.stream().map(m -> m.ligne().getProduit().getId()).distinct().count());
            if (!sources) st.setNbRupturesResorbees(rupturesResorbees(l));
            return st;
        }).sorted(Comparator.comparingInt(StatistiquesDTO.Site::getNbMouvements).reversed()
                .thenComparing(StatistiquesDTO.Site::getNom)).limit(10).toList();
    }

    private static double somme(List<Mvt> l, java.util.function.ToDoubleFunction<Mvt> f) {
        return l.stream().mapToDouble(f).sum();
    }

    private static double valeur(BigDecimal b) {
        return b != null ? b.doubleValue() : 0;
    }

    private static double pct(double part, double total) {
        return total > 0 ? arrondi(part / total * 100.0) : 0;
    }

    private static double arrondi(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
