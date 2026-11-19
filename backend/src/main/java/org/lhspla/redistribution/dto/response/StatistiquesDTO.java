package org.lhspla.redistribution.dto.response;

import lombok.Data;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Statistiques des plans de redéploiement validés sur une plage de dates (date de validation),
 * pour une région, un périmètre de superviseur ou le niveau national.
 */
@Data
public class StatistiquesDTO {
    private LocalDate debut;
    private LocalDate fin;
    /** « National », « Région X » ou « Périmètre : A, B ». */
    private String niveau;
    /** Programme filtré, ou « Tous les programmes ». */
    private String programme;

    private Synthese synthese = new Synthese();
    private List<Groupe> parRegion = new ArrayList<>();
    private List<Groupe> parProgramme = new ArrayList<>();
    private List<Produit> parProduit = new ArrayList<>();
    private List<Site> sitesSources = new ArrayList<>();
    private List<Site> sitesCibles = new ArrayList<>();
    private List<Groupe> parMois = new ArrayList<>();

    @Data
    public static class Synthese {
        private int nbPlans;
        private int nbPlansClotures;
        private int nbRegions;
        /** Mouvements = lignes non annulées des plans. */
        private int nbMouvements;
        private int nbExecutes;
        private int nbPartiels;
        private int nbEnAttente;
        /** Mouvements exécutés au moins en partie / mouvements, en %. */
        private double tauxExecutionMouvements;
        /** Quantités exécutées / quantités prévues, toutes lignes confondues, en %. */
        private double tauxExecutionQuantites;
        /** Jours entre la validation du plan et l'exécution d'un mouvement (mouvements exécutés). */
        private Double delaiMoyenJours;
        private Double delaiMedianJours;
        /** Couples site/produit en rupture avant le plan et ayant reçu une quantité exécutée. */
        private int nbRupturesResorbees;
        /** Couples site/produit destinataires ayant reçu une quantité exécutée. */
        private int nbCiblesServies;
    }

    /** Ligne d'agrégat (région, programme ou mois). */
    @Data
    public static class Groupe {
        private String libelle;
        private int nbPlans;
        private int nbMouvements;
        private int nbExecutesAuMoinsEnPartie;
        private double tauxExecutionMouvements;
        private double tauxExecutionQuantites;
        private int nbRupturesResorbees;
    }

    @Data
    public static class Produit {
        private String programme;
        private String code;
        private String nom;
        private String unite;
        private int nbMouvements;
        private double quantitePrevue;
        private double quantiteExecutee;
        private double tauxExecutionQuantites;
    }

    @Data
    public static class Site {
        private String nom;
        private String region;
        private int nbMouvements;
        private int nbExecutesAuMoinsEnPartie;
        private int nbProduits;
        /** Pour les destinataires : ruptures résorbées sur ce site. */
        private int nbRupturesResorbees;
    }
}
