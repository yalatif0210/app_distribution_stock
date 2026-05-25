package org.lhspla.redistribution.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.lhspla.redistribution.config.ClaudeApiConfig;
import org.lhspla.redistribution.dto.response.AnalyseResultatDTO;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClaudeIaService {

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

    private final ClaudeApiConfig config;
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
            headers.set("x-api-key",          config.getApiKey());
            headers.set("anthropic-version",   "2023-06-01");
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    config.getApiUrl(), new HttpEntity<>(body, headers), Map.class
            );

            return parseReponse(response.getBody());
        } catch (Exception e) {
            log.error("Erreur appel Claude API", e);
            return null;
        }
    }

    // ── Parsing de la réponse ────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private PlanIaResponse parseReponse(Map<String, Object> body) {
        try {
            // Format Anthropic : content[0].text
            List<Map<String, Object>> content = (List<Map<String, Object>>) body.get("content");
            String text = (String) content.get(0).get("text");

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
            log.error("Impossible de parser la réponse Claude", e);
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
            List<Map<String, Object>> stocks = buildStockList(analyse);
            Map<String, Object> input = new LinkedHashMap<>();
            input.put("date_du_jour",            LocalDate.now().toString());
            input.put("periode",                  analyse.getPeriodeLibelle());
            input.put("programme",                analyse.getProgrammeNom());
            input.put("region",                   analyse.getRegionNom());
            input.put("seuil_stock_securite_msd", seuilStockSecuriteMsd);
            input.put("stocks",                   stocks);
            String inputJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(input);

            return """
Tu es un moteur de décision logistique pour un système de gestion de stock pharmaceutique\
 dans un réseau de structures sanitaires. Ton objectif est de produire un plan de\
 redistribution optimal qui réduit les risques de rupture et de péremption à l'échelle du réseau.

## Données d'entrée

Pour chaque site et produit, les champs sont :
- site_id / site_nom : identifiant et nom du site
- produit_id / produit_nom / produit_unite
- stock_saisi : quantité physique constatée
- cmm : consommation mensuelle moyenne
- msd : mois de stock disponible
- date_peremption : date de péremption du lot (null si inconnue)
- allocations_existantes : quantité déjà planifiée depuis ce site pour ce produit
- stock_disponible = stock_saisi − allocations_existantes  ← toujours utiliser cette valeur
- statut : RUPTURE | TENSION | SURVEILLER | BIEN_STOCKE | SURSTOCK | STOCK_DORMANT
- excedent : quantité disponible à la redistribution côté source (au-delà de son seuil de sécurité)
- besoin : estimation indicative côté destinataire — informatif uniquement, NE plafonne PAS la quantité allouée

%s

## Règles — non négociables

R1 — SOURCE : un site est éligible comme source si :
     a) statut = SURSTOCK : son MSD après allocation doit rester ≥ seuil_stock_securite_msd (%.1f).
        MSD résiduelle = (stock_disponible − quantite_allouee) / cmm
     b) statut = STOCK_DORMANT : TOUT le stock est disponible à la redistribution.
        Aucun seuil MSD ne s'applique (cmm = 0, MSD non calculable).
        quantite_allouee ≤ stock_disponible (règle R3 toujours applicable).
     → La contrainte unique sur la quantité allouée est que la SOURCE ne descende pas sous son seuil.
       Le champ besoin du destinataire est un guide, pas un plafond.

R2 — CIBLE : un site n'est éligible comme cible que si statut = RUPTURE ou TENSION.

R3 — PLAFOND : quantite_allouee ≤ stock_disponible de la source.
     Si plusieurs lignes partagent la même source et le même produit, leurs quantités
     cumulées ne doivent pas dépasser stock_disponible. Recalculer dynamiquement.

R4 — FEFO : si date_peremption est renseignée, sélectionner en priorité le lot dont
     la date de péremption est la plus proche (First Expired, First Out).

R5 — DATE PÉREMPTION : reporter dans chaque ligne la date_peremption du lot source
     sélectionné. Ne jamais inventer, estimer ou calculer cette date.

R6 — INUTILE : ne pas générer de ligne si quantite_allouee = 0 ou si la cible
     n'est pas en tension/rupture.

R7 — BESOIN NON BLOQUANT : "besoin insuffisant" n'est JAMAIS un motif de refus.
     Si stock_disponible > 0 et que R1/R3 le permettent, allouer ce qui est disponible
     même si quantite_allouee < besoin. Mentionner la couverture partielle dans motif.
     Seules R1 (MSD source) et R3 (plafond stock) peuvent bloquer une allocation.

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
      "motif": "<tension/rupture détectée, excédent source, risque péremption>"
    }
  ],
  "avertissements": ["<message si données insuffisantes, règle non applicable ou produit exclu>"]
}

Si aucune redistribution n'est possible, retourner mouvements = [] et expliquer dans avertissements.
""".formatted(inputJson, seuilStockSecuriteMsd);

        } catch (Exception e) {
            throw new RuntimeException("Erreur construction prompt IA", e);
        }
    }

    private List<Map<String, Object>> buildStockList(AnalyseResultatDTO analyse) {
        List<Map<String, Object>> stocks = new ArrayList<>();
        if (analyse.getProduits() == null) return stocks;

        for (AnalyseResultatDTO.AnalyseProduitDTO produit : analyse.getProduits()) {
            List<AnalyseResultatDTO.StructureAnalyseDTO> toutes = new ArrayList<>();
            if (produit.getStructuresEnRupture()  != null) toutes.addAll(produit.getStructuresEnRupture());
            if (produit.getStructuresEnTension()   != null) toutes.addAll(produit.getStructuresEnTension());
            if (produit.getStructuresEnSurstock()  != null) toutes.addAll(produit.getStructuresEnSurstock());

            for (AnalyseResultatDTO.StructureAnalyseDTO s : toutes) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("site_id",                s.getStructureId());
                entry.put("site_nom",               s.getStructureNom());
                entry.put("produit_id",              produit.getProduitId());
                entry.put("produit_nom",             produit.getProduitNom());
                entry.put("produit_unite",           produit.getProduitUnite());
                entry.put("stock_saisi",             s.getStockDisponible());
                entry.put("cmm",                     s.getCmm());
                entry.put("msd",                     s.getMsd());
                entry.put("date_peremption",         s.getExpireDateFefo() != null
                                                        ? s.getExpireDateFefo().toString() : null);
                entry.put("allocations_existantes",  s.getAllocationsExistantes());
                entry.put("stock_disponible",        s.getStockDisponible()
                                                        .subtract(s.getAllocationsExistantes()));
                entry.put("statut",                  s.getStatutStock());
                entry.put("excedent",                s.getExcedent());
                entry.put("besoin",                  s.getBesoin());
                stocks.add(entry);
            }
        }
        return stocks;
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
