package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.lhspla.redistribution.dto.response.TableauBordDTO;
import org.lhspla.redistribution.entity.LignePlan;
import org.lhspla.redistribution.entity.PeriodeSaisie;
import org.lhspla.redistribution.entity.PlanReattribution;
import org.lhspla.redistribution.entity.Produit;
import org.lhspla.redistribution.entity.SaisieStock;
import org.lhspla.redistribution.entity.StructureProgrammeProduit;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.LignePlanRepository;
import org.lhspla.redistribution.repository.PeriodeSaisieRepository;
import org.lhspla.redistribution.repository.PlanReattributionRepository;
import org.lhspla.redistribution.repository.SaisieStockRepository;
import org.lhspla.redistribution.repository.StructureProgrammeProduitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class TableauBordService {

    private final SaisieStockRepository saisieStockRepo;
    private final SeuilsStatutService seuilsStatut;
    private final PlanReattributionRepository planRepo;
    private final LignePlanRepository ligneRepo;
    private final PeriodeSaisieRepository periodeRepo;
    private final StructureProgrammeProduitRepository sppRepo;

    private static final BigDecimal ZERO = BigDecimal.ZERO;

    public TableauBordDTO calculer(Long periodeId, Long programmeId, Long regionId, Long planId) {
        return calculer(periodeId, programmeId, regionId, planId, null);
    }

    /**
     * @param base « PREVUE » : situation après théorique, si toutes les quantités prévues
     *             étaient livrées ; « EXECUTEE » : quantités réellement livrées. Null : exécutée
     *             pour un plan validé, prévue pour un brouillon (qui n'a rien d'exécuté).
     */
    public TableauBordDTO calculer(Long periodeId, Long programmeId, Long regionId, Long planId, String base) {

        // Etape 1: Charger les données de base
        PeriodeSaisie periode = periodeRepo.findById(periodeId)
                .orElseThrow(() -> BusinessException.notFound("Période", periodeId));
        PlanReattribution plan = planRepo.findById(planId)
                .orElseThrow(() -> BusinessException.notFound("Plan", planId));
        List<LignePlan> lignesPlan = ligneRepo.findByPlanId(planId);
        List<SaisieStock> saisiesAvant = saisieStockRepo
                .findSubmittedByPeriodeAndProgrammeAndRegion(periodeId, programmeId, regionId);

        log.debug("TableauBord: {} saisies, {} lignes plan pour periode={} programme={} region={}",
                saisiesAvant.size(), lignesPlan.size(), periodeId, programmeId, regionId);

        // Etape 2: Calculer l'état "après" (MSD théorique après exécution supposée complète du plan)
        // Map clé: structureId+"_"+produitId → stockApres
        Map<String, BigDecimal> stockApresMap = new HashMap<>();
        Map<String, BigDecimal> cmmMap = new HashMap<>();
        Map<String, SaisieStock> saisieParCle = new LinkedHashMap<>();

        for (SaisieStock s : saisiesAvant) {
            String cle = s.getStructure().getId() + "_" + s.getProduit().getId();
            stockApresMap.put(cle, s.getStockDisponible() != null ? s.getStockDisponible() : ZERO);
            cmmMap.put(cle, s.getCmm() != null ? s.getCmm() : ZERO);
            saisieParCle.put(cle, s);
        }

        // « Après » : quantités réellement exécutées dès que le plan est validé, quantités
        // prévues tant qu'il est en brouillon. Les lignes annulées ne comptent pas.
        boolean surExecute = !"BROUILLON".equals(plan.getStatut()) && !"PREVUE".equalsIgnoreCase(base);
        Set<String> clesSources = new HashSet<>();
        for (LignePlan ligne : lignesPlan) {
            if (ligne.getProduit() == null || ligne.getStructureSource() == null
                    || ligne.getStructureCible() == null || "ANNULE".equals(ligne.getStatut())) {
                continue;
            }
            Long produitId = ligne.getProduit().getId();
            Long sourceId = ligne.getStructureSource().getId();
            Long cibleId = ligne.getStructureCible().getId();
            BigDecimal qte = surExecute ? ligne.getQuantiteExecutee() : ligne.getQuantiteProposee();
            if (qte == null || qte.signum() <= 0) continue;
            clesSources.add(sourceId + "_" + produitId);

            String cleSource = sourceId + "_" + produitId;
            String cleCible = cibleId + "_" + produitId;

            // Déduire du source (min à 0)
            BigDecimal stockSource = stockApresMap.getOrDefault(cleSource, ZERO);
            stockApresMap.put(cleSource, stockSource.subtract(qte).max(ZERO));

            // Ajouter à la cible
            BigDecimal stockCible = stockApresMap.getOrDefault(cleCible, ZERO);
            stockApresMap.put(cleCible, stockCible.add(qte));
        }

        // Calculer MSD après pour chaque saisie
        Map<String, BigDecimal> msdApresMap = new HashMap<>();
        Map<String, String> statutApresMap = new HashMap<>();

        for (Map.Entry<String, SaisieStock> entry : saisieParCle.entrySet()) {
            String cle = entry.getKey();
            SaisieStock s = entry.getValue();
            BigDecimal cmm = cmmMap.getOrDefault(cle, ZERO);
            BigDecimal stockApres = stockApresMap.getOrDefault(cle, ZERO);

            BigDecimal msdApres;
            if (cmm.compareTo(ZERO) > 0) {
                msdApres = stockApres.divide(cmm, 2, RoundingMode.HALF_UP);
            } else {
                msdApres = ZERO;
            }
            msdApresMap.put(cle, msdApres);
            // Sans consommation (CMM nulle), le MSD vaut 0 : le statut dépend du stock restant,
            // comme dans l'analyse (stock dormant s'il en reste, rupture sinon)
            statutApresMap.put(cle, cmm.signum() > 0 ? calculerStatut(msdApres)
                    : stockApres.signum() > 0 ? "STOCK_DORMANT" : "RUPTURE");
        }

        // Etape 3: Section A - Evolution MSD, limitée aux sites ayant participé au plan
        // (source ou cible d'au moins un mouvement non annulé, pour le produit concerné)
        Set<String> clesDuPlan = new HashSet<>();
        for (LignePlan l : lignesPlan) {
            if ("ANNULE".equals(l.getStatut()) || l.getProduit() == null
                    || l.getStructureSource() == null || l.getStructureCible() == null) continue;
            clesDuPlan.add(l.getStructureSource().getId() + "_" + l.getProduit().getId());
            clesDuPlan.add(l.getStructureCible().getId() + "_" + l.getProduit().getId());
        }
        List<TableauBordDTO.MsdEvolutionDTO> evolutionMsd = new ArrayList<>();
        for (Map.Entry<String, SaisieStock> entry : saisieParCle.entrySet()) {
            String cle = entry.getKey();
            if (!clesDuPlan.contains(cle)) continue;
            SaisieStock s = entry.getValue();
            BigDecimal msdAvant = s.getMsd() != null ? s.getMsd() : ZERO;
            BigDecimal msdApres = msdApresMap.getOrDefault(cle, ZERO);
            BigDecimal delta = msdApres.subtract(msdAvant);

            TableauBordDTO.MsdEvolutionDTO dto = new TableauBordDTO.MsdEvolutionDTO();
            dto.setProduitId(s.getProduit().getId());
            dto.setProduitNom(s.getProduit().getNom());
            dto.setProduitCode(s.getProduit().getCode());
            dto.setStructureId(s.getStructure().getId());
            dto.setStructureNom(s.getStructure().getNom());
            dto.setMsdAvant(msdAvant);
            dto.setMsdApres(msdApres);
            dto.setDeltaMsd(delta);
            dto.setStatutAvant(s.getStatutStock() != null ? s.getStatutStock() : calculerStatut(msdAvant));
            dto.setStatutApres(statutApresMap.getOrDefault(cle, "RUPTURE"));

            int cmp = msdApres.compareTo(msdAvant);
            dto.setTendance(cmp > 0 ? "GAIN" : cmp < 0 ? "PERTE" : "STABLE");

            evolutionMsd.add(dto);
        }

        // Etape 4: Section B - Evolution ruptures par produit
        Map<Long, Long> rupturesAvantParProduit = saisiesAvant.stream()
                .filter(s -> "RUPTURE".equals(s.getStatutStock())
                        || (s.getStatutStock() == null && (s.getMsd() == null || s.getMsd().compareTo(ZERO) == 0)))
                .collect(Collectors.groupingBy(s -> s.getProduit().getId(), Collectors.counting()));

        Map<Long, Long> rupturesApresParProduit = new HashMap<>();
        for (Map.Entry<String, SaisieStock> entry : saisieParCle.entrySet()) {
            String cle = entry.getKey();
            SaisieStock s = entry.getValue();
            if ("RUPTURE".equals(statutApresMap.getOrDefault(cle, ""))) {
                rupturesApresParProduit.merge(s.getProduit().getId(), 1L, Long::sum);
            }
        }

        Map<Long, String> produitNomMap = saisiesAvant.stream()
                .collect(Collectors.toMap(
                        s -> s.getProduit().getId(),
                        s -> s.getProduit().getNom(),
                        (a, b) -> a));

        List<TableauBordDTO.RuptureEvolutionDTO> evolutionRuptures = produitNomMap.entrySet().stream()
                .map(e -> {
                    Long pid = e.getKey();
                    int avant = rupturesAvantParProduit.getOrDefault(pid, 0L).intValue();
                    int apres = rupturesApresParProduit.getOrDefault(pid, 0L).intValue();
                    int delta = apres - avant;

                    TableauBordDTO.RuptureEvolutionDTO dto = new TableauBordDTO.RuptureEvolutionDTO();
                    dto.setProduitId(pid);
                    dto.setProduitNom(e.getValue());
                    dto.setNbRupturesAvant(avant);
                    dto.setNbRupturesApres(apres);
                    dto.setDelta(delta);
                    dto.setTendance(delta < 0 ? "AMELIORATION" : delta > 0 ? "DEGRADATION" : "STABLE");
                    return dto;
                })
                // Produits concernés : au moins un site en rupture avant ou après le plan
                .filter(dto -> dto.getNbRupturesAvant() > 0 || dto.getNbRupturesApres() > 0)
                .sorted(Comparator.comparing(TableauBordDTO.RuptureEvolutionDTO::getProduitNom))
                .toList();

        // Etape 5 et 6 : produits gérés sur au moins un site de la région (sélection active),
        // plus ceux qui ont une saisie. Pour chacun : répartition des sites par statut
        // (section C) et disponibilité = sites avec un stock > 0 / sites gérant le produit (D).
        Map<Long, Set<Long>> sitesGerantParProduit = new HashMap<>();
        Map<Long, Produit> produitsUnivers = new HashMap<>();
        for (StructureProgrammeProduit spp : sppRepo.findGeresDansRegion(programmeId, regionId)) {
            Long pid = spp.getProduit().getId();
            sitesGerantParProduit.computeIfAbsent(pid, k -> new HashSet<>()).add(spp.getStructure().getId());
            produitsUnivers.put(pid, spp.getProduit());
        }
        Map<Long, List<SaisieStock>> saisiesParProduit = saisiesAvant.stream()
                .collect(Collectors.groupingBy(s -> s.getProduit().getId()));
        saisiesAvant.forEach(s -> produitsUnivers.putIfAbsent(s.getProduit().getId(), s.getProduit()));
        List<Produit> produitsTries = produitsUnivers.values().stream()
                .sorted(Comparator.comparing(Produit::getNom)).toList();

        List<TableauBordDTO.ProportionStockageDTO> proportionsStockage = new ArrayList<>();
        List<TableauBordDTO.DisponibiliteDTO> disponibilites = new ArrayList<>();
        long totalSitesDispoAvantGlobal = 0;
        long totalSitesDispoApresGlobal = 0;
        long totalSitesGlobal = 0;

        for (Produit produit : produitsTries) {
            Long pid = produit.getId();
            List<SaisieStock> saisiesProduit = saisiesParProduit.getOrDefault(pid, List.of());
            Set<Long> sitesAvecSaisie = saisiesProduit.stream()
                    .map(s -> s.getStructure().getId()).collect(Collectors.toSet());
            Set<Long> sitesGerant = new HashSet<>(sitesGerantParProduit.getOrDefault(pid, Set.of()));
            sitesGerant.addAll(sitesAvecSaisie);
            int nbGerant = sitesGerant.size();
            int nbSansSaisie = (int) sitesGerant.stream().filter(id -> !sitesAvecSaisie.contains(id)).count();
            int total = saisiesProduit.size();

            int nbRuptureAvant = 0, nbTensionAvant = 0, nbSurveillerAvant = 0, nbNormalAvant = 0, nbSurstockAvant = 0;
            int nbRuptureApres = 0, nbTensionApres = 0, nbSurveillerApres = 0, nbNormalApres = 0, nbSurstockApres = 0;
            int dispoAvant = 0, dispoApres = 0;

            for (SaisieStock s : saisiesProduit) {
                String cle = s.getStructure().getId() + "_" + pid;
                String statutAvant = s.getStatutStock() != null ? s.getStatutStock() : calculerStatut(s.getMsd() != null ? s.getMsd() : ZERO);
                // Stock dormant (sans consommation) : statut inchangé après le plan s'il garde du stock
                String statutApres = "STOCK_DORMANT".equals(statutAvant)
                        && stockApresMap.getOrDefault(cle, ZERO).signum() > 0
                        ? "STOCK_DORMANT" : statutApresMap.getOrDefault(cle, "RUPTURE");

                switch (statutAvant) {
                    case "RUPTURE" -> nbRuptureAvant++;
                    case "TENSION" -> nbTensionAvant++;
                    case "SURVEILLER" -> nbSurveillerAvant++;
                    case "BIEN_STOCKE", "NORMAL" -> nbNormalAvant++;
                    case "SURSTOCK", "STOCK_DORMANT" -> nbSurstockAvant++;
                }
                switch (statutApres) {
                    case "RUPTURE" -> nbRuptureApres++;
                    case "TENSION" -> nbTensionApres++;
                    case "SURVEILLER" -> nbSurveillerApres++;
                    case "BIEN_STOCKE", "NORMAL" -> nbNormalApres++;
                    case "SURSTOCK", "STOCK_DORMANT" -> nbSurstockApres++;
                }
                if (s.getStockDisponible() != null && s.getStockDisponible().signum() > 0) dispoAvant++;
                if (stockApresMap.getOrDefault(cle, ZERO).signum() > 0) dispoApres++;
            }

            double tauxBienAvant = total > 0 ? (double) nbNormalAvant / total * 100.0 : 0.0;
            double tauxBienApres = total > 0 ? (double) nbNormalApres / total * 100.0 : 0.0;

            TableauBordDTO.ProportionStockageDTO dto = new TableauBordDTO.ProportionStockageDTO();
            dto.setProduitId(pid);
            dto.setProduitNom(produit.getNom());
            dto.setProduitCode(produit.getCode());
            dto.setNbRuptureAvant(nbRuptureAvant);
            dto.setNbTensionAvant(nbTensionAvant);
            dto.setNbSurveillerAvant(nbSurveillerAvant);
            dto.setNbNormalAvant(nbNormalAvant);
            dto.setNbSurstockAvant(nbSurstockAvant);
            dto.setNbRuptureApres(nbRuptureApres);
            dto.setNbTensionApres(nbTensionApres);
            dto.setNbSurveillerApres(nbSurveillerApres);
            dto.setNbNormalApres(nbNormalApres);
            dto.setNbSurstockApres(nbSurstockApres);
            dto.setTauxBienStockeAvant(Math.round(tauxBienAvant * 100.0) / 100.0);
            dto.setTauxMalStockeAvant(Math.round((100.0 - tauxBienAvant) * 100.0) / 100.0);
            dto.setTauxBienStockeApres(Math.round(tauxBienApres * 100.0) / 100.0);
            dto.setTauxMalStockeApres(Math.round((100.0 - tauxBienApres) * 100.0) / 100.0);
            dto.setDeltaBienStocke(Math.round((tauxBienApres - tauxBienAvant) * 100.0) / 100.0);
            dto.setNbSitesTotal(total);
            dto.setNbSitesGerant(nbGerant);
            dto.setNbSansSaisie(nbSansSaisie);
            proportionsStockage.add(dto);

            double tauxDispoAvant = nbGerant > 0 ? (double) dispoAvant / nbGerant * 100.0 : 0.0;
            double tauxDispoApres = nbGerant > 0 ? (double) dispoApres / nbGerant * 100.0 : 0.0;
            double deltaDispo = tauxDispoApres - tauxDispoAvant;
            TableauBordDTO.DisponibiliteDTO dispo = new TableauBordDTO.DisponibiliteDTO();
            dispo.setProduitId(pid);
            dispo.setProduitNom(produit.getNom());
            dispo.setNbSitesGerant(nbGerant);
            dispo.setNbDispoAvant(dispoAvant);
            dispo.setNbDispoApres(dispoApres);
            dispo.setNbSansSaisie(nbSansSaisie);
            dispo.setTauxDispoAvant(Math.round(tauxDispoAvant * 100.0) / 100.0);
            dispo.setTauxDispoApres(Math.round(tauxDispoApres * 100.0) / 100.0);
            dispo.setDeltaDispo(Math.round(deltaDispo * 100.0) / 100.0);
            dispo.setTendance(deltaDispo > 0 ? "AMELIORATION" : deltaDispo < 0 ? "DEGRADATION" : "STABLE");
            disponibilites.add(dispo);

            totalSitesDispoAvantGlobal += dispoAvant;
            totalSitesDispoApresGlobal += dispoApres;
            totalSitesGlobal += nbGerant;
        }

        double tauxDispoGlobalAvant = totalSitesGlobal > 0
                ? (double) totalSitesDispoAvantGlobal / totalSitesGlobal * 100.0 : 0.0;
        double tauxDispoGlobalApres = totalSitesGlobal > 0
                ? (double) totalSitesDispoApresGlobal / totalSitesGlobal * 100.0 : 0.0;

        // Taux bien stocké global
        long totalNormalAvantGlobal = proportionsStockage.stream()
                .mapToLong(TableauBordDTO.ProportionStockageDTO::getNbNormalAvant).sum();
        long totalNormalApresGlobal = proportionsStockage.stream()
                .mapToLong(TableauBordDTO.ProportionStockageDTO::getNbNormalApres).sum();
        long totalSitesProduits = proportionsStockage.stream()
                .mapToLong(TableauBordDTO.ProportionStockageDTO::getNbSitesTotal).sum();

        double tauxBienStockeGlobalAvant = totalSitesProduits > 0
                ? (double) totalNormalAvantGlobal / totalSitesProduits * 100.0 : 0.0;
        double tauxBienStockeGlobalApres = totalSitesProduits > 0
                ? (double) totalNormalApresGlobal / totalSitesProduits * 100.0 : 0.0;

        // Etape 7: Section E - Analytique
        // Score impact global
        double scoreImpactGlobal = evolutionMsd.stream()
                .filter(m -> m.getDeltaMsd() != null && m.getDeltaMsd().compareTo(ZERO) > 0)
                .mapToDouble(m -> m.getDeltaMsd().doubleValue())
                .sum();

        // Couples site/produit dont le MSD augmente (les cibles servies)
        long nbSitesAmeliores = evolutionMsd.stream()
                .filter(m -> "GAIN".equals(m.getTendance())).count();

        // Couverture du programme = produits sans aucun site en rupture / produits suivis.
        // Un produit sans aucun état soumis est écarté : on ne sait pas s'il est en rupture.
        List<TableauBordDTO.ProportionStockageDTO> produitsSuivis = proportionsStockage.stream()
                .filter(p -> p.getNbSitesTotal() > 0).toList();
        long nbProduitsSuivis = produitsSuivis.size();
        long nbSansRuptureAvant = produitsSuivis.stream().filter(p -> p.getNbRuptureAvant() == 0).count();
        long nbSansRuptureApres = produitsSuivis.stream().filter(p -> p.getNbRuptureApres() == 0).count();
        double tauxCouvertureAvant = nbProduitsSuivis > 0 ? (double) nbSansRuptureAvant / nbProduitsSuivis * 100.0 : 0.0;
        double tauxCouvertureApres = nbProduitsSuivis > 0 ? (double) nbSansRuptureApres / nbProduitsSuivis * 100.0 : 0.0;

        // Indice de risque : moyenne par couple site/produit saisi, de 0 (aucun risque) à 3
        // (tout en rupture) ; rupture = 3, tension = 2, surstock = 1, autres = 0.
        long nbCouples = proportionsStockage.stream().mapToLong(TableauBordDTO.ProportionStockageDTO::getNbSitesTotal).sum();
        double indiceRisqueAvant = nbCouples == 0 ? 0 : proportionsStockage.stream()
                .mapToDouble(p -> p.getNbRuptureAvant() * 3.0 + p.getNbTensionAvant() * 2.0 + p.getNbSurstockAvant() * 1.0)
                .sum() / nbCouples;
        double indiceRisqueApres = nbCouples == 0 ? 0 : proportionsStockage.stream()
                .mapToDouble(p -> p.getNbRuptureApres() * 3.0 + p.getNbTensionApres() * 2.0 + p.getNbSurstockApres() * 1.0)
                .sum() / nbCouples;

        // Sources : sollicitées, et passées sous le seuil de sécurité (seule l'exception
        // péremption le permet)
        BigDecimal seuil = AnalyseStockService.seuilSecurite(plan.getRegion());
        long nbSitesSousSeuil = clesSources.stream()
                .filter(cle -> cmmMap.getOrDefault(cle, ZERO).signum() > 0
                        && msdApresMap.getOrDefault(cle, ZERO).compareTo(seuil) < 0)
                .count();

        // Complétude exécution
        long nbLignesTotal = lignesPlan.size();
        long nbLignesExecutees = lignesPlan.stream()
                .filter(l -> "EXECUTE".equals(l.getStatut()) || "PARTIEL".equals(l.getStatut()))
                .count();
        double completudeExecution = nbLignesTotal > 0
                ? (double) nbLignesExecutees / nbLignesTotal * 100.0 : 0.0;

        // Top 5 mouvements par gain MSD sur cible
        List<TableauBordDTO.MouvementImpactDTO> top5 = lignesPlan.stream()
                .filter(l -> l.getProduit() != null && l.getStructureCible() != null)
                .map(l -> {
                    String cleCible = l.getStructureCible().getId() + "_" + l.getProduit().getId();
                    // Trouver msdAvant de la cible
                    SaisieStock saisieAvantCible = saisieParCle.get(cleCible);
                    BigDecimal msdAvantCible = saisieAvantCible != null && saisieAvantCible.getMsd() != null
                            ? saisieAvantCible.getMsd() : ZERO;
                    BigDecimal msdApresCible = msdApresMap.getOrDefault(cleCible, ZERO);
                    BigDecimal gainMsdCible = msdApresCible.subtract(msdAvantCible);

                    TableauBordDTO.MouvementImpactDTO dto = new TableauBordDTO.MouvementImpactDTO();
                    dto.setLignePlanId(l.getId());
                    dto.setProduitNom(l.getProduit().getNom());
                    dto.setStructureSourceNom(l.getStructureSource() != null ? l.getStructureSource().getNom() : "");
                    dto.setStructureCibleNom(l.getStructureCible().getNom());
                    dto.setQuantiteProposee(l.getQuantiteProposee());
                    dto.setGainMsdCible(gainMsdCible);
                    return dto;
                })
                .sorted(Comparator.comparing(TableauBordDTO.MouvementImpactDTO::getGainMsdCible,
                        Comparator.reverseOrder()))
                .limit(5)
                .collect(Collectors.toList());

        TableauBordDTO.AnalytiqueDTO analytique = new TableauBordDTO.AnalytiqueDTO();
        analytique.setScoreImpactGlobal(Math.round(scoreImpactGlobal * 100.0) / 100.0);
        analytique.setTop5Mouvements(top5);
        analytique.setTauxCouvertureProgrammeAvant(Math.round(tauxCouvertureAvant * 100.0) / 100.0);
        analytique.setTauxCouvertureProgrammeApres(Math.round(tauxCouvertureApres * 100.0) / 100.0);
        analytique.setNbProduitsSuivis((int) nbProduitsSuivis);
        analytique.setNbProduitsSansRuptureAvant((int) nbSansRuptureAvant);
        analytique.setNbProduitsSansRuptureApres((int) nbSansRuptureApres);
        analytique.setIndiceRisqueAvant(Math.round(indiceRisqueAvant * 100.0) / 100.0);
        analytique.setIndiceRisqueApres(Math.round(indiceRisqueApres * 100.0) / 100.0);
        analytique.setCompletudeExecution(Math.round(completudeExecution * 100.0) / 100.0);
        analytique.setNbSitesAmeliores((int) nbSitesAmeliores);
        analytique.setNbSourcesSollicitees(clesSources.size());
        analytique.setNbSitesSousSeuil((int) nbSitesSousSeuil);
        analytique.setSeuilSecurite(seuil.doubleValue());

        // Assembler le DTO final
        TableauBordDTO result = new TableauBordDTO();
        result.setPeriodeId(periodeId);
        result.setProgrammeId(programmeId);
        result.setRegionId(regionId);
        result.setPlanId(planId);
        result.setPeriodeLibelle(periode.getDateRas() != null ? periode.getDateRas().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) : String.format("%02d/%d", periode.getMois(), periode.getAnnee()));
        result.setProgrammeNom(plan.getProgramme() != null ? plan.getProgramme().getNom() : "");
        result.setRegionNom(plan.getRegion() != null ? plan.getRegion().getNom() : "");
        result.setPlanStatut(plan.getStatut());
        result.setBaseApres(surExecute ? "EXECUTEE" : "PREVUE");
        result.setEvolutionMsd(evolutionMsd);
        result.setEvolutionRuptures(evolutionRuptures);
        result.setProportionsStockage(proportionsStockage);
        result.setDisponibilites(disponibilites);
        result.setTauxDispoGlobalAvant(Math.round(tauxDispoGlobalAvant * 100.0) / 100.0);
        result.setTauxDispoGlobalApres(Math.round(tauxDispoGlobalApres * 100.0) / 100.0);
        result.setTauxBienStockeGlobalAvant(Math.round(tauxBienStockeGlobalAvant * 100.0) / 100.0);
        result.setTauxBienStockeGlobalApres(Math.round(tauxBienStockeGlobalApres * 100.0) / 100.0);
        result.setAnalytique(analytique);

        return result;
    }

    private String calculerStatut(BigDecimal msd) {
        return seuilsStatut.statut(msd);
    }
}
