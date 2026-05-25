package org.lhspla.redistribution.dto.response;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
public class TableauBordDTO {

    // Contexte
    private Long periodeId;
    private Long programmeId;
    private Long regionId;
    private Long planId;
    private String periodeLibelle;
    private String programmeNom;
    private String regionNom;
    private String planStatut;

    // Section A: Evolution MSD par produit x site
    private List<MsdEvolutionDTO> evolutionMsd;

    // Section B: Ruptures par produit
    private List<RuptureEvolutionDTO> evolutionRuptures;

    // Section C: Proportions par produit (bien/mal stocke)
    private List<ProportionStockageDTO> proportionsStockage;

    // Section D: Taux de disponibilite par produit
    private List<DisponibiliteDTO> disponibilites;
    private double tauxDispoGlobalAvant;
    private double tauxDispoGlobalApres;
    private double tauxBienStockeGlobalAvant;
    private double tauxBienStockeGlobalApres;

    // Section E: Metriques analytiques
    private AnalytiqueDTO analytique;

    // --- Classes internes ---

    @Data
    @NoArgsConstructor
    public static class MsdEvolutionDTO {
        private Long produitId;
        private String produitNom;
        private String produitCode;
        private Long structureId;
        private String structureNom;
        private BigDecimal msdAvant;
        private BigDecimal msdApres;
        private BigDecimal deltaMsd;
        private String statutAvant;
        private String statutApres;
        private String tendance; // "GAIN", "PERTE", "STABLE"
    }

    @Data
    @NoArgsConstructor
    public static class RuptureEvolutionDTO {
        private Long produitId;
        private String produitNom;
        private int nbRupturesAvant;
        private int nbRupturesApres;
        private int delta;
        private String tendance; // "AMELIORATION", "DEGRADATION", "STABLE"
    }

    @Data
    @NoArgsConstructor
    public static class ProportionStockageDTO {
        private Long produitId;
        private String produitNom;
        private int nbRuptureAvant;
        private int nbTensionAvant;
        private int nbSurveillerAvant;
        private int nbNormalAvant;
        private int nbSurstockAvant;
        private int nbRuptureApres;
        private int nbTensionApres;
        private int nbSurveillerApres;
        private int nbNormalApres;
        private int nbSurstockApres;
        private double tauxBienStockeAvant;
        private double tauxMalStockeAvant;
        private double tauxBienStockeApres;
        private double tauxMalStockeApres;
        private double deltaBienStocke;
        private int nbSitesTotal;
    }

    @Data
    @NoArgsConstructor
    public static class DisponibiliteDTO {
        private Long produitId;
        private String produitNom;
        private double tauxDispoAvant;
        private double tauxDispoApres;
        private double deltaDispo;
        private String tendance;
    }

    @Data
    @NoArgsConstructor
    public static class AnalytiqueDTO {
        private double scoreImpactGlobal;
        private List<MouvementImpactDTO> top5Mouvements;
        private double tauxCouvertureProgrammeAvant;
        private double tauxCouvertureProgrammeApres;
        private double indiceRisqueAvant;
        private double indiceRisqueApres;
        private double completudeExecution;
        private int nbSitesAmeliores;
        private int nbSitesDegrades;
    }

    @Data
    @NoArgsConstructor
    public static class MouvementImpactDTO {
        private Long lignePlanId;
        private String produitNom;
        private String structureSourceNom;
        private String structureCibleNom;
        private BigDecimal quantiteProposee;
        private BigDecimal gainMsdCible;
    }
}
