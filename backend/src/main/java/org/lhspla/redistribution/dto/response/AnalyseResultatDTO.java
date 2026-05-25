package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.util.List;

@Data
public class AnalyseResultatDTO {
    private Long periodeId;
    private Long programmeId;
    private Long regionId;
    private String periodeLibelle;
    private String programmeNom;
    private String regionNom;
    private List<AnalyseProduitDTO> produits;
    private int nbProduitsEnTension;
    private int nbProduitsEnSurstock;
    private int nbProduitsEnRupture;

    @Data
    public static class AnalyseProduitDTO {
        private Long produitId;
        private String produitCode;
        private String produitNom;
        private String produitUnite;
        private List<StructureAnalyseDTO> structuresEnRupture;
        private List<StructureAnalyseDTO> structuresEnTension;
        private List<StructureAnalyseDTO> structuresEnSurstock;
        private String potentielRedistribution;
    }

    @Data
    public static class StructureAnalyseDTO {
        private Long structureId;
        private String structureCode;
        private String structureNom;
        private java.math.BigDecimal msd;
        private java.math.BigDecimal stockDisponible;
        private java.math.BigDecimal cmm;
        private java.math.BigDecimal besoin;
        private java.math.BigDecimal excedent;
        private String statutStock;
        /** Date de péremption FEFO du lot source — pour que l'IA puisse appliquer R4/R5. */
        private java.time.LocalDate expireDateFefo;
        /** Allocations déjà planifiées depuis ce site pour ce produit (0 à la génération initiale). */
        private java.math.BigDecimal allocationsExistantes = java.math.BigDecimal.ZERO;
    }
}
