package org.lhspla.redistribution.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.lhspla.redistribution.service.ParametresAnalyseService;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Analyses d'un plan pour l'onglet « Analyses » du tableau de bord. Chaque analyse porte
 * sa lecture et ses actions « À faire », produites par des règles (barèmes administrables).
 */
@Data
public class AnalysesDTO {
    /** PREVUE (après théorique) ou EXECUTEE (quantités livrées). */
    private String baseApres;
    private ParametresAnalyseService.Baremes baremes;

    private Matrice matrice = new Matrice();
    private Dispersion dispersion = new Dispersion();
    private Peremptions peremptions = new Peremptions();
    private Alerte alerte = new Alerte();
    private Chroniques chroniques = new Chroniques();
    private Fiabilite fiabilite = new Fiabilite();
    private List<Flux> flux = new ArrayList<>();

    /** Ce qu'il faut retenir, et ce qu'il faut faire. */
    @Data
    public static class Interpretation {
        private List<String> lecture = new ArrayList<>();
        @com.fasterxml.jackson.annotation.JsonProperty("aFaire")
        private List<String> aFaire = new ArrayList<>();
    }

    @Data @AllArgsConstructor @NoArgsConstructor
    public static class Element { private Long id; private String code; private String nom; }

    // ── 1. Matrice sites × produits ─────────────────────────────────────────
    @Data
    public static class Matrice {
        private List<Element> sites = new ArrayList<>();
        private List<Element> produits = new ArrayList<>();
        private List<Cellule> cellules = new ArrayList<>();
        private Interpretation interpretation = new Interpretation();
    }

    @Data
    public static class Cellule {
        private Long siteId;
        private Long produitId;
        private String statutAvant;
        private String statutApres;
        private Double msdAvant;
        private Double msdApres;
    }

    // ── 2. Dispersion des MSD ───────────────────────────────────────────────
    @Data
    public static class Dispersion {
        private List<DispersionProduit> produits = new ArrayList<>();
        private Interpretation interpretation = new Interpretation();
    }

    @Data
    public static class DispersionProduit {
        private Long produitId;
        private String produit;
        private int nbSites;
        private Boite avant;
        private Boite apres;
        /** Variation de l'écart interquartile, en % (négatif : resserrement). Null si l'écart avant est nul. */
        private Double variationPct;
        /** NET, MODERE, SANS_EFFET, DESEQUILIBRE ou DEJA_EQUILIBRE. */
        private String verdict;
    }

    /** Résumé d'une distribution de MSD (boîte à moustaches). */
    @Data
    public static class Boite {
        private double min, q1, mediane, q3, max;
        public double getEcartInterquartile() { return q3 - q1; }
    }

    // ── 3. Péremptions évitées ──────────────────────────────────────────────
    @Data
    public static class Peremptions {
        private List<LotPerimable> evitees = new ArrayList<>();
        @com.fasterxml.jackson.annotation.JsonProperty("aRisque")
        private List<LotPerimable> aRisque = new ArrayList<>();
        private Interpretation interpretation = new Interpretation();
    }

    @Data
    public static class LotPerimable {
        private String site;
        private String produit;
        private String unite;
        private double quantite;
        private LocalDate datePeremption;
    }

    // ── 4. Alerte précoce ───────────────────────────────────────────────────
    @Data
    public static class Alerte {
        private int horizonJours;
        private int nbAvant;
        private int nbApres;
        /** Jours écoulés depuis la date de l'état de stock. */
        private long ageEtatJours;
        private List<RuptureAVenir> restantes = new ArrayList<>();
        private Interpretation interpretation = new Interpretation();
    }

    @Data
    public static class RuptureAVenir {
        private String site;
        private String produit;
        private LocalDate dateEstimee;
        private long joursRestants;
    }

    // ── 5. Ruptures et surstocks chroniques ─────────────────────────────────
    @Data
    public static class Chroniques {
        private int fenetre;
        private int occurrences;
        /** Périodes réellement disponibles dans l'historique (au plus la fenêtre). */
        private int periodesAnalysees;
        private List<Chronique> ruptures = new ArrayList<>();
        private List<SurstockProduit> surstocks = new ArrayList<>();
        private Interpretation interpretation = new Interpretation();
    }

    @Data
    public static class Chronique {
        private String site;
        private String produit;
        private int nbFois;
    }

    @Data
    public static class SurstockProduit {
        private String produit;
        private int nbSites;
        private int nbSitesSuivis;
    }

    // ── 6. Fiabilité de l'exécution ─────────────────────────────────────────
    @Data
    public static class Fiabilite {
        /** Plans pris en compte : validés dans les 12 derniers mois, même région et programme. */
        private int nbPlans;
        private List<FiabiliteSite> sites = new ArrayList<>();
        private Interpretation interpretation = new Interpretation();
    }

    @Data
    public static class FiabiliteSite {
        private String site;
        private int nbMouvements;
        /** Moyenne des taux de livraison des mouvements (livré / prévu, plafonné à 100 %). */
        private double tauxLivraison;
        private int nbEnRetard;
        private Double delaiMoyenJours;
        /** BONNE, MOYENNE ou FAIBLE. */
        private String verdict;
    }

    // ── Flux entre districts (diagramme) ────────────────────────────────────
    @Data
    public static class Flux {
        private String districtSource;
        private String districtCible;
        private int nbMouvements;
        private int nbProduits;
    }
}
