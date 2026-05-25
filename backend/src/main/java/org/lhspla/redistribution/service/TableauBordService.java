package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.lhspla.redistribution.dto.response.TableauBordDTO;
import org.lhspla.redistribution.entity.LignePlan;
import org.lhspla.redistribution.entity.PeriodeSaisie;
import org.lhspla.redistribution.entity.PlanReattribution;
import org.lhspla.redistribution.entity.SaisieStock;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.LignePlanRepository;
import org.lhspla.redistribution.repository.PeriodeSaisieRepository;
import org.lhspla.redistribution.repository.PlanReattributionRepository;
import org.lhspla.redistribution.repository.SaisieStockRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class TableauBordService {

    private final SaisieStockRepository saisieStockRepo;
    private final PlanReattributionRepository planRepo;
    private final LignePlanRepository ligneRepo;
    private final PeriodeSaisieRepository periodeRepo;

    private static final BigDecimal ZERO = BigDecimal.ZERO;

    public TableauBordDTO calculer(Long periodeId, Long programmeId, Long regionId, Long planId) {

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

        for (LignePlan ligne : lignesPlan) {
            if (ligne.getProduit() == null || ligne.getStructureSource() == null
                    || ligne.getStructureCible() == null || ligne.getQuantiteProposee() == null) {
                continue;
            }
            Long produitId = ligne.getProduit().getId();
            Long sourceId = ligne.getStructureSource().getId();
            Long cibleId = ligne.getStructureCible().getId();
            BigDecimal qte = ligne.getQuantiteProposee();

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
            statutApresMap.put(cle, calculerStatut(msdApres));
        }

        // Etape 3: Section A - Evolution MSD
        List<TableauBordDTO.MsdEvolutionDTO> evolutionMsd = new ArrayList<>();
        for (Map.Entry<String, SaisieStock> entry : saisieParCle.entrySet()) {
            String cle = entry.getKey();
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
                .toList();

        // Etape 5: Section C - Proportions stockage par produit
        // Grouper saisies par produit
        Map<Long, List<SaisieStock>> saisiesParProduit = saisiesAvant.stream()
                .collect(Collectors.groupingBy(s -> s.getProduit().getId()));

        List<TableauBordDTO.ProportionStockageDTO> proportionsStockage = new ArrayList<>();
        for (Map.Entry<Long, List<SaisieStock>> entry : saisiesParProduit.entrySet()) {
            Long pid = entry.getKey();
            List<SaisieStock> saisiesProduit = entry.getValue();
            int total = saisiesProduit.size();

            int nbRuptureAvant = 0, nbTensionAvant = 0, nbSurveillerAvant = 0, nbNormalAvant = 0, nbSurstockAvant = 0;
            int nbRuptureApres = 0, nbTensionApres = 0, nbSurveillerApres = 0, nbNormalApres = 0, nbSurstockApres = 0;

            for (SaisieStock s : saisiesProduit) {
                String cle = s.getStructure().getId() + "_" + pid;
                String statutAvant = s.getStatutStock() != null ? s.getStatutStock() : calculerStatut(s.getMsd() != null ? s.getMsd() : ZERO);
                String statutApres = statutApresMap.getOrDefault(cle, "RUPTURE");

                switch (statutAvant) {
                    case "RUPTURE" -> nbRuptureAvant++;
                    case "TENSION" -> nbTensionAvant++;
                    case "SURVEILLER" -> nbSurveillerAvant++;
                    case "BIEN_STOCKE", "NORMAL" -> nbNormalAvant++;
                    case "SURSTOCK" -> nbSurstockAvant++;
                }
                switch (statutApres) {
                    case "RUPTURE" -> nbRuptureApres++;
                    case "TENSION" -> nbTensionApres++;
                    case "SURVEILLER" -> nbSurveillerApres++;
                    case "BIEN_STOCKE", "NORMAL" -> nbNormalApres++;
                    case "SURSTOCK" -> nbSurstockApres++;
                }
            }

            double tauxBienAvant = total > 0 ? (double) nbNormalAvant / total * 100.0 : 0.0;
            double tauxBienApres = total > 0 ? (double) nbNormalApres / total * 100.0 : 0.0;

            TableauBordDTO.ProportionStockageDTO dto = new TableauBordDTO.ProportionStockageDTO();
            dto.setProduitId(pid);
            dto.setProduitNom(saisiesProduit.get(0).getProduit().getNom());
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

            proportionsStockage.add(dto);
        }

        // Etape 6: Section D - Disponibilités par produit
        List<TableauBordDTO.DisponibiliteDTO> disponibilites = new ArrayList<>();
        long totalSitesDispoAvantGlobal = 0;
        long totalSitesDispoApresGlobal = 0;
        long totalSitesGlobal = 0;

        for (Map.Entry<Long, List<SaisieStock>> entry : saisiesParProduit.entrySet()) {
            Long pid = entry.getKey();
            List<SaisieStock> saisiesProduit = entry.getValue();
            int total = saisiesProduit.size();

            long dispoAvant = saisiesProduit.stream()
                    .filter(s -> s.getMsd() != null && s.getMsd().compareTo(ZERO) > 0)
                    .count();
            long dispoApres = saisiesProduit.stream()
                    .filter(s -> {
                        String cle = s.getStructure().getId() + "_" + pid;
                        BigDecimal msdA = msdApresMap.getOrDefault(cle, ZERO);
                        return msdA.compareTo(ZERO) > 0;
                    })
                    .count();

            double tauxAvant = total > 0 ? (double) dispoAvant / total * 100.0 : 0.0;
            double tauxApres = total > 0 ? (double) dispoApres / total * 100.0 : 0.0;
            double delta = tauxApres - tauxAvant;

            TableauBordDTO.DisponibiliteDTO dto = new TableauBordDTO.DisponibiliteDTO();
            dto.setProduitId(pid);
            dto.setProduitNom(saisiesProduit.get(0).getProduit().getNom());
            dto.setTauxDispoAvant(Math.round(tauxAvant * 100.0) / 100.0);
            dto.setTauxDispoApres(Math.round(tauxApres * 100.0) / 100.0);
            dto.setDeltaDispo(Math.round(delta * 100.0) / 100.0);
            dto.setTendance(delta > 0 ? "AMELIORATION" : delta < 0 ? "DEGRADATION" : "STABLE");
            disponibilites.add(dto);

            totalSitesDispoAvantGlobal += dispoAvant;
            totalSitesDispoApresGlobal += dispoApres;
            totalSitesGlobal += total;
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

        // nbSitesAmeliores / Degrades
        long nbSitesAmeliores = evolutionMsd.stream()
                .filter(m -> "GAIN".equals(m.getTendance())).count();
        long nbSitesDegrades = evolutionMsd.stream()
                .filter(m -> "PERTE".equals(m.getTendance())).count();

        // Taux couverture programme = % produits ayant au moins 1 site en NORMAL
        long nbProduitsTotal = saisiesParProduit.size();
        long nbProduitsAvecNormalAvant = proportionsStockage.stream()
                .filter(p -> p.getNbNormalAvant() > 0).count();
        long nbProduitsAvecNormalApres = proportionsStockage.stream()
                .filter(p -> p.getNbNormalApres() > 0).count();
        double tauxCouvertureAvant = nbProduitsTotal > 0
                ? (double) nbProduitsAvecNormalAvant / nbProduitsTotal * 100.0 : 0.0;
        double tauxCouvertureApres = nbProduitsTotal > 0
                ? (double) nbProduitsAvecNormalApres / nbProduitsTotal * 100.0 : 0.0;

        // Indice risque
        double indiceRisqueAvant = proportionsStockage.stream()
                .mapToDouble(p -> p.getNbRuptureAvant() * 3.0 + p.getNbTensionAvant() * 2.0 + p.getNbSurstockAvant() * 1.0)
                .sum();
        double indiceRisqueApres = proportionsStockage.stream()
                .mapToDouble(p -> p.getNbRuptureApres() * 3.0 + p.getNbTensionApres() * 2.0 + p.getNbSurstockApres() * 1.0)
                .sum();

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
        analytique.setIndiceRisqueAvant(indiceRisqueAvant);
        analytique.setIndiceRisqueApres(indiceRisqueApres);
        analytique.setCompletudeExecution(Math.round(completudeExecution * 100.0) / 100.0);
        analytique.setNbSitesAmeliores((int) nbSitesAmeliores);
        analytique.setNbSitesDegrades((int) nbSitesDegrades);

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
        if (msd == null || msd.compareTo(ZERO) == 0) {
            return "RUPTURE";
        }
        int cmp1 = msd.compareTo(BigDecimal.ONE);
        if (cmp1 < 0) {
            return "TENSION";
        }
        int cmp2 = msd.compareTo(new BigDecimal("2"));
        if (cmp2 < 0) {
            return "SURVEILLER";
        }
        int cmp4 = msd.compareTo(new BigDecimal("4"));
        if (cmp4 <= 0) {
            return "BIEN_STOCKE";
        }
        return "SURSTOCK";
    }
}
