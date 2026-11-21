package org.lhspla.redistribution.dto.response;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Délais d'exécution des plans validés dans l'année, région par région, avec une ligne de
 * référence « ensemble des régions ».
 */
@Data
public class DelaisDTO {
    private int annee;
    private String programme;
    /** Régions qui ont validé au moins un plan dans l'année. */
    private List<Region> regions = new ArrayList<>();
    /** Régions du périmètre sans plan validé dans l'année (citées, pas comparées). */
    private List<String> regionsSansPlan = new ArrayList<>();
    /** Toutes les régions réunies (moyenne de référence, sans détail des autres régions). */
    private Region ensemble;
    /** Délai moyen d'exécution des plans, mois de validation par mois, pour chaque région. */
    private List<Mois> parMois = new ArrayList<>();

    @Data
    public static class Region {
        private Long regionId;
        private String region;
        /** Plans validés dans l'année. */
        private int nbPlans;
        /** Plans dont tous les mouvements sont reçus (complets ou clos avec un écart). */
        private int nbPlansExecutes;
        private int nbPlansEnCours;
        /** Validation → dernière réception, plans exécutés uniquement. */
        private Double delaiMoyenPlanJours;
        private Double delaiMedianPlanJours;
        private Double delaiMinPlanJours;
        private Double delaiMaxPlanJours;
        /** Validation → réception complète, par mouvement. */
        private Double delaiMoyenMouvementJours;
        private int nbMouvementsRecus;
        /** Ancienneté moyenne, depuis la validation, des plans encore en cours. */
        private Double ageMoyenEnCoursJours;
        /** Quantités reçues ÷ quantités prévues, en %. */
        private double tauxQuantitesRecues;
        private int nbReceptionsAvecEcart;
    }

    @Data
    public static class Mois {
        private int mois;
        /** Délai moyen des plans exécutés validés ce mois, par nom de région (absent : aucun). */
        private java.util.Map<String, Double> delaiMoyenParRegion = new java.util.LinkedHashMap<>();
    }
}
