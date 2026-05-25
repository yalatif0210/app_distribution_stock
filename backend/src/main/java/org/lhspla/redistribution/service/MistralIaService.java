package org.lhspla.redistribution.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.lhspla.redistribution.config.MistralApiConfig;
import org.lhspla.redistribution.dto.response.AnalyseResultatDTO;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class MistralIaService {

    public record PlanIaResponse(String resume, List<MouvementIA> mouvements, List<String> avertissements) {}

    public record MouvementIA(
            Long    produit_id,
            String  produit_nom,
            String  produit_unite,
            Long    source_id,
            String  source_nom,
            Long    cible_id,
            String  cible_nom,
            double  quantite_allouee,
            String  date_peremption,
            String  motif
    ) {}

    private final MistralApiConfig config;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public PlanIaResponse genererPlan(AnalyseResultatDTO analyse, double seuilStockSecuriteMsd) {
        try {
            String prompt = construirePrompt(analyse, seuilStockSecuriteMsd);
            Map<String, Object> body = Map.of(
                    "model",      config.getModel(),
                    "max_tokens", 4000,
                    "messages",   List.of(Map.of("role", "user", "content", prompt))
            );

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + config.getApiKey());
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    config.getApiUrl(), new HttpEntity<>(body, headers), Map.class
            );

            return parseReponse(response.getBody());
        } catch (Exception e) {
            log.error("Erreur appel Mistral API", e);
            return null;
        }
    }

    // ── Parsing de la réponse ────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private PlanIaResponse parseReponse(Map<String, Object> body) {
        try {
            List<Map<String, Object>> choices = (List<Map<String, Object>>) body.get("choices");
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String text = (String) message.get("content");

            String jsonStr = extractJson(text);
            Map<String, Object> parsed = objectMapper.readValue(jsonStr, Map.class);

            String resume = (String) parsed.getOrDefault("resume", "");
            List<String> avertissements = (List<String>) parsed.getOrDefault("avertissements", List.of());

            List<Map<String, Object>> raw = (List<Map<String, Object>>) parsed.getOrDefault("mouvements", List.of());
            List<MouvementIA> mouvements = raw.stream()
                    .filter(m -> m.get("source_id") != null && m.get("cible_id") != null && m.get("produit_id") != null)
                    .map(m -> new MouvementIA(
                            toLong(m.get("produit_id")),
                            (String) m.getOrDefault("produit_nom", ""),
                            (String) m.getOrDefault("produit_unite", ""),
                            toLong(m.get("source_id")),
                            (String) m.getOrDefault("source_nom", ""),
                            toLong(m.get("cible_id")),
                            (String) m.getOrDefault("cible_nom", ""),
                            toDouble(m.get("quantite_allouee")),
                            (String) m.get("date_peremption"),
                            (String) m.getOrDefault("motif", "")
                    ))
                    .filter(mv -> mv.quantite_allouee() > 0)
                    .toList();

            return new PlanIaResponse(resume, mouvements, avertissements);
        } catch (Exception e) {
            log.error("Impossible de parser la réponse Mistral", e);
            return null;
        }
    }

    private String extractJson(String text) {
        int start = text.indexOf('{');
        int end   = text.lastIndexOf('}');
        if (start >= 0 && end > start) return text.substring(start, end + 1);
        return text;
    }

    // ── Construction du prompt ───────────────────────────────────────────────────

    private String construirePrompt(AnalyseResultatDTO analyse, double seuilStockSecuriteMsd) {
        try {
            List<Map<String, Object>> produits = buildProduitsParRole(analyse);
            Map<String, Object> input = new LinkedHashMap<>();
            input.put("date_du_jour",            LocalDate.now().toString());
            input.put("periode",                  analyse.getPeriodeLibelle());
            input.put("programme",                analyse.getProgrammeNom());
            input.put("region",                   analyse.getRegionNom());
            input.put("seuil_stock_securite_msd", seuilStockSecuriteMsd);
            input.put("produits",                 produits);
            String inputJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(input);

            return """
Tu es un moteur de décision logistique pour un système de gestion de stock pharmaceutique\
 dans un réseau de structures sanitaires. Ton objectif est de produire un plan de\
 redistribution optimal qui réduit les risques de rupture et de péremption à l'échelle du réseau.

## Principe directeur

"Soulager les plus faibles sans léser les plus forts."
Côté source : après allocation, le stock résiduel de la source doit couvrir sa propre MSD.
Côté cible : prioriser les sites les plus en tension (rupture imminente, ratio stock/MSD le plus faible).

## Structure des données

Les données sont organisées par produit. Chaque produit contient deux listes pré-classifiées
par le système — ne jamais intervertir les rôles :

sources_eligibles — sites autorisés à redistribuer ce produit. Deux cas d'éligibilité :
  • Condition A (surstock / stock dormant) : statut = SURSTOCK ou STOCK_DORMANT.
  • Condition B (risque de péremption, cmm > 0 uniquement) : msd > mois_restants avant date_peremption.
    Surplus redistribuable = stock_disponible − (mois_restants × cmm).
    Ne redistribuer que l'excédent que le site ne peut pas consommer avant péremption.
  ATTENTION : la date_peremption d'une source STOCK_DORMANT est une raison supplémentaire de
  redistribuer en urgence — jamais un motif de blocage. Condition B ne s'applique pas à STOCK_DORMANT.
  Champs : site_id, site_nom, statut (SURSTOCK|STOCK_DORMANT),
           stock_disponible (net, allocations déjà déduites), cmm, msd,
           date_peremption, excedent.
  Si cette liste est vide → aucune redistribution possible pour ce produit → avertissements.

cibles — sites RUPTURE ou TENSION qui ont besoin de ce produit.
  RUPTURE et TENSION sont tous les deux des cibles valides. Une liste de cibles contenant
  uniquement des sites TENSION est tout à fait suffisante pour déclencher des allocations.
  Champs : site_id, site_nom, statut (RUPTURE|TENSION),
           stock_disponible, cmm, msd, date_peremption,
           besoin (indicateur de priorisation — ne plafonne pas l'allocation).

%s

## Règles — non négociables

R1 — ÉLIGIBILITÉ SOURCE : utiliser uniquement les sites de sources_eligibles.
     a) statut = SURSTOCK : MSD résiduelle = (stock_disponible − quantite_allouee) / cmm
        doit rester ≥ seuil_stock_securite_msd (%.1f) après allocation.
        quantite_max_allouable = stock_disponible − (cmm × seuil_stock_securite_msd).
     b) statut = STOCK_DORMANT : tout le stock_disponible est redistribuable sans exception.
        cmm = 0 → pas de seuil MSD à respecter. date_peremption → urgence de redistribuer, pas un blocage.
     c) Risque de péremption (s'applique uniquement aux sources avec cmm > 0, statut SURSTOCK) :
        mois_restants = (date_peremption − date_du_jour) en mois.
        Si msd > mois_restants : quantite_redistribuable = stock_disponible − (mois_restants × cmm).
        Ne jamais dépasser ce surplus — ne pas compromettre la couverture consommation de la source.
     Si sources_eligibles est vide → avertissement, aucune ligne pour ce produit.

R2 — ÉLIGIBILITÉ CIBLE : utiliser uniquement les sites de cibles.
     Ne jamais utiliser un site de cibles comme source, même si son stock_disponible > 0.
     besoin est un indicateur de priorisation, pas un plafond : une cible peut recevoir plus
     que son besoin calculé si le stock redistribuable le permet.

R3 — PLAFOND SOURCE : la somme des quantite_allouee depuis une même source pour un même produit
     ne doit pas dépasser son stock redistribuable (calculé selon R1a, R1b ou R1c).
     Recalculer dynamiquement après chaque allocation.

R4 — FEFO : reporter la date_peremption de la source (lot à péremption la plus proche).
     Ne jamais inventer ni calculer cette date.

R5 — BESOIN NON BLOQUANT : besoin est un indicateur de priorisation.
     Ne pas limiter quantite_allouee au besoin calculé de la cible, ni au stock existant de la cible.
     Ne jamais bloquer ni écrêter une allocation au motif que la cible aurait atteint son besoin.
     Allouer le maximum autorisé par R1 et R3.

R6 — MAXIMISER STOCK_DORMANT : depuis une source STOCK_DORMANT, allouer l'intégralité du
     stock_disponible. Si plusieurs cibles, répartir proportionnellement à leur besoin.
     Ne jamais allouer une fraction symbolique.

R7 — PRÉSERVATION SOURCE : aucune allocation ne doit mettre la source elle-même en tension.
     Après allocation, le stock résiduel de la source doit couvrir sa propre MSD.
     Exception : ne s'applique PAS aux sources STOCK_DORMANT (cmm = 0 → aucune consommation
     propre à protéger). Pour STOCK_DORMANT, tout le stock est redistribuable — voir R6.
     On redistribue un excédent — on ne crée pas un nouveau problème.

R8 — PRIORISATION CIBLES : si le stock redistribuable est insuffisant pour couvrir toutes les cibles,
     allouer en priorité au site présentant le ratio stock/MSD le plus faible (plus critique).
     Traiter les RUPTURE avant les TENSION à ratio égal.

R9 — INUTILE : ne générer aucune ligne si quantite_allouee = 0.

## Format de sortie — JSON strict, sans aucun texte avant ou après

{
  "resume": "Synthèse narrative du plan (3 à 5 lignes)",
  "mouvements": [
    {
      "produit_id": <Long>,
      "produit_nom": "<string>",
      "produit_unite": "<string>",
      "source_id": <Long>,
      "source_nom": "<string>",
      "cible_id": <Long>,
      "cible_nom": "<string>",
      "quantite_allouee": <number>,
      "date_peremption": "<YYYY-MM-DD ou null>",
      "motif": "<raison : rupture/tension cible, surstock/stock dormant/risque péremption source>"
    }
  ],
  "avertissements": ["<produit sans source éligible ou autre impossibilité>"]
}

Si aucune redistribution n'est possible, retourner mouvements = [] et expliquer dans avertissements.
""".formatted(inputJson, seuilStockSecuriteMsd);

        } catch (Exception e) {
            throw new RuntimeException("Erreur construction prompt IA", e);
        }
    }

    private List<Map<String, Object>> buildProduitsParRole(AnalyseResultatDTO analyse) {
        List<Map<String, Object>> produits = new ArrayList<>();
        if (analyse.getProduits() == null) return produits;

        for (AnalyseResultatDTO.AnalyseProduitDTO produit : analyse.getProduits()) {
            boolean hasCible = (produit.getStructuresEnRupture() != null && !produit.getStructuresEnRupture().isEmpty())
                            || (produit.getStructuresEnTension()  != null && !produit.getStructuresEnTension().isEmpty());
            if (!hasCible) continue;

            List<Map<String, Object>> sources = new ArrayList<>();
            if (produit.getStructuresEnSurstock() != null) {
                for (AnalyseResultatDTO.StructureAnalyseDTO s : produit.getStructuresEnSurstock()) {
                    sources.add(buildSiteSource(s));
                }
            }

            List<Map<String, Object>> cibles = new ArrayList<>();
            if (produit.getStructuresEnRupture() != null) {
                for (AnalyseResultatDTO.StructureAnalyseDTO s : produit.getStructuresEnRupture()) {
                    cibles.add(buildSiteCible(s));
                }
            }
            if (produit.getStructuresEnTension() != null) {
                for (AnalyseResultatDTO.StructureAnalyseDTO s : produit.getStructuresEnTension()) {
                    cibles.add(buildSiteCible(s));
                }
            }

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("produit_id",        produit.getProduitId());
            entry.put("produit_nom",       produit.getProduitNom());
            entry.put("produit_unite",     produit.getProduitUnite());
            entry.put("sources_eligibles", sources);
            entry.put("cibles",            cibles);
            produits.add(entry);
        }
        return produits;
    }

    private Map<String, Object> buildSiteSource(AnalyseResultatDTO.StructureAnalyseDTO s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("site_id",       s.getStructureId());
        m.put("site_nom",      s.getStructureNom());
        m.put("statut",        s.getStatutStock());
        m.put("stock_disponible", s.getStockDisponible().subtract(s.getAllocationsExistantes()));
        m.put("cmm",           s.getCmm());
        m.put("msd",           s.getMsd());
        m.put("date_peremption", s.getExpireDateFefo() != null ? s.getExpireDateFefo().toString() : null);
        m.put("excedent",      s.getExcedent());
        return m;
    }

    private Map<String, Object> buildSiteCible(AnalyseResultatDTO.StructureAnalyseDTO s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("site_id",       s.getStructureId());
        m.put("site_nom",      s.getStructureNom());
        m.put("statut",        s.getStatutStock());
        m.put("stock_disponible", s.getStockDisponible().subtract(s.getAllocationsExistantes()));
        m.put("cmm",           s.getCmm());
        m.put("msd",           s.getMsd());
        m.put("date_peremption", s.getExpireDateFefo() != null ? s.getExpireDateFefo().toString() : null);
        m.put("besoin",        s.getBesoin());
        return m;
    }

    // ── Helpers de conversion ────────────────────────────────────────────────────

    private Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Long l)    return l;
        if (v instanceof Integer i) return i.longValue();
        if (v instanceof Number n)  return n.longValue();
        try { return Long.parseLong(v.toString()); } catch (NumberFormatException e) { return null; }
    }

    private double toDouble(Object v) {
        if (v == null) return 0.0;
        if (v instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(v.toString()); } catch (NumberFormatException e) { return 0.0; }
    }
}
