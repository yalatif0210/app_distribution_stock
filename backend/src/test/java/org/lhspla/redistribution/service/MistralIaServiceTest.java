package org.lhspla.redistribution.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.lhspla.redistribution.config.MistralApiConfig;
import org.lhspla.redistribution.dto.response.AnalyseResultatDTO;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MistralIaServiceTest {

    // Clés et URLs factices — ne jamais utiliser de vraies clés ici
    private static final String FAKE_API_KEY = "PLACEHOLDER_MISTRAL_API_KEY_FOR_UNIT_TESTS_ONLY";
    private static final String FAKE_API_URL = "http://fake-mistral-api.test/v1/chat/completions";

    @Mock private MistralApiConfig config;
    @Mock private RestTemplate restTemplate;
    @Captor private ArgumentCaptor<HttpEntity<?>> requestCaptor;

    // ObjectMapper réel : pas de dépendances externes, pas de secrets
    private MistralIaService service;

    @BeforeEach
    void setUp() {
        service = new MistralIaService(config, restTemplate, new ObjectMapper());
        when(config.getModel()).thenReturn("mistral-small-latest");
        when(config.getApiKey()).thenReturn(FAKE_API_KEY);
        when(config.getApiUrl()).thenReturn(FAKE_API_URL);
    }

    // ── Cas nominal ──────────────────────────────────────────────────────────────

    @Test
    void genererPlan_retourne_mouvements_valides() {
        String jsonContent = """
            {
              "resume": "Un produit redistributé vers le site en rupture.",
              "mouvements": [
                {
                  "produit_id": 10,
                  "produit_nom": "Amoxicilline 500mg",
                  "produit_unite": "Boîte",
                  "source_id": 1,
                  "source_nom": "CSB2 Ambatobe",
                  "cible_id": 2,
                  "cible_nom": "CSB1 Ambohipo",
                  "quantite_allouee": 120.0,
                  "date_peremption": "2025-09-30",
                  "motif": "Rupture détectée, excédent disponible"
                }
              ],
              "avertissements": []
            }
            """;

        preparerReponseApiMistral(jsonContent);

        MistralIaService.PlanIaResponse result = service.genererPlan(analyseFactice(), 2.0);

        assertThat(result).isNotNull();
        assertThat(result.mouvements()).hasSize(1);
        MistralIaService.MouvementIA mv = result.mouvements().get(0);
        assertThat(mv.produit_id()).isEqualTo(10L);
        assertThat(mv.source_id()).isEqualTo(1L);
        assertThat(mv.cible_id()).isEqualTo(2L);
        assertThat(mv.quantite_allouee()).isEqualTo(120.0);
        assertThat(result.resume()).contains("redistribu");
        assertThat(result.avertissements()).isEmpty();
    }

    // ── Filtrage des lignes invalides ─────────────────────────────────────────────

    @Test
    void genererPlan_filtre_mouvement_avec_produit_id_null() {
        String jsonContent = """
            {
              "resume": "Plan incomplet.",
              "mouvements": [
                {
                  "produit_id": null,
                  "source_id": 1,
                  "cible_id": 2,
                  "quantite_allouee": 50.0,
                  "motif": "Mouvement sans produit — doit être ignoré"
                }
              ],
              "avertissements": ["Produit non identifié"]
            }
            """;

        preparerReponseApiMistral(jsonContent);

        MistralIaService.PlanIaResponse result = service.genererPlan(analyseFactice(), 2.0);

        assertThat(result.mouvements()).isEmpty();
        assertThat(result.avertissements()).contains("Produit non identifié");
    }

    @Test
    void genererPlan_filtre_mouvement_avec_quantite_zero() {
        String jsonContent = """
            {
              "resume": "Aucune redistribution utile.",
              "mouvements": [
                {
                  "produit_id": 5,
                  "source_id": 1,
                  "cible_id": 2,
                  "quantite_allouee": 0,
                  "motif": "Quantité nulle — doit être ignorée"
                }
              ],
              "avertissements": []
            }
            """;

        preparerReponseApiMistral(jsonContent);

        MistralIaService.PlanIaResponse result = service.genererPlan(analyseFactice(), 2.0);

        assertThat(result.mouvements()).isEmpty();
    }

    @Test
    void genererPlan_filtre_mouvement_avec_source_id_null() {
        String jsonContent = """
            {
              "resume": "Source non identifiée.",
              "mouvements": [
                {
                  "produit_id": 3,
                  "source_id": null,
                  "cible_id": 2,
                  "quantite_allouee": 30.0,
                  "motif": "Source nulle — doit être ignorée"
                }
              ],
              "avertissements": []
            }
            """;

        preparerReponseApiMistral(jsonContent);

        MistralIaService.PlanIaResponse result = service.genererPlan(analyseFactice(), 2.0);

        assertThat(result.mouvements()).isEmpty();
    }

    // ── Réponse API vide ─────────────────────────────────────────────────────────

    @Test
    void genererPlan_retourne_liste_vide_si_aucun_mouvement() {
        String jsonContent = """
            {
              "resume": "Aucune redistribution possible.",
              "mouvements": [],
              "avertissements": ["Pas de surstock dans la région"]
            }
            """;

        preparerReponseApiMistral(jsonContent);

        MistralIaService.PlanIaResponse result = service.genererPlan(analyseFactice(), 2.0);

        assertThat(result.mouvements()).isEmpty();
        assertThat(result.avertissements()).containsExactly("Pas de surstock dans la région");
    }

    // ── Erreur réseau ─────────────────────────────────────────────────────────────

    @Test
    void genererPlan_retourne_null_si_api_indisponible() {
        when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenThrow(new RuntimeException("Connection refused to fake endpoint"));

        MistralIaService.PlanIaResponse result = service.genererPlan(analyseFactice(), 2.0);

        assertThat(result).isNull();
    }

    // ── JSON encapsulé dans du texte (markdown) ───────────────────────────────────

    @Test
    void genererPlan_extrait_json_encapsule_dans_texte_libre() {
        // L'IA peut parfois envelopper le JSON dans du texte
        String jsonContent = "Voici mon analyse :\n```json\n" +
            "{\"resume\":\"Plan ok\",\"mouvements\":[{\"produit_id\":7,\"source_id\":3,\"cible_id\":4," +
            "\"quantite_allouee\":25.0,\"produit_nom\":\"Cotrimoxazole\",\"produit_unite\":\"Cp\"," +
            "\"source_nom\":\"Site A\",\"cible_nom\":\"Site B\",\"motif\":\"Tension\"}]," +
            "\"avertissements\":[]}\n```\nFin de réponse.";

        preparerReponseApiMistral(jsonContent);

        MistralIaService.PlanIaResponse result = service.genererPlan(analyseFactice(), 2.0);

        assertThat(result).isNotNull();
        assertThat(result.mouvements()).hasSize(1);
        assertThat(result.mouvements().get(0).produit_id()).isEqualTo(7L);
    }

    // ── Règle métier : besoin indicatif, pas un plafond ──────────────────────────

    @Test
    void genererPlan_accepte_quantite_superieure_au_besoin_du_destinataire() {
        // besoin calculé du site en rupture = 120 dans analyseFactice()
        // Mistral propose 200 → le service ne doit PAS filtrer ce mouvement
        String jsonContent = """
            {
              "resume": "Allocation supérieure au besoin indicatif.",
              "mouvements": [
                {
                  "produit_id": 10,
                  "produit_nom": "Amoxicilline 500mg",
                  "produit_unite": "Boîte",
                  "source_id": 1,
                  "source_nom": "CSB2 Ambatobe",
                  "cible_id": 2,
                  "cible_nom": "CSB1 Ambohipo",
                  "quantite_allouee": 200.0,
                  "date_peremption": null,
                  "motif": "Rupture — quantité supérieure au besoin indicatif (120)"
                }
              ],
              "avertissements": []
            }
            """;
        preparerReponseApiMistral(jsonContent);

        MistralIaService.PlanIaResponse result = service.genererPlan(analyseFactice(), 2.0);

        assertThat(result.mouvements()).hasSize(1);
        assertThat(result.mouvements().get(0).quantite_allouee()).isEqualTo(200.0);
    }

    @Test
    void genererPlan_stock_dormant_peut_allouer_tout_son_stock() {
        // Site STOCK_DORMANT (cmm=0, stock=300) — tout le stock redistribuable, pas de seuil MSD
        String jsonContent = """
            {
              "resume": "Stock dormant entièrement redistribué.",
              "mouvements": [
                {
                  "produit_id": 10,
                  "produit_nom": "Amoxicilline 500mg",
                  "produit_unite": "Boîte",
                  "source_id": 3,
                  "source_nom": "Site Dormant",
                  "cible_id": 2,
                  "cible_nom": "CSB1 Ambohipo",
                  "quantite_allouee": 300.0,
                  "date_peremption": null,
                  "motif": "Stock dormant — intégralité disponible à la redistribution"
                }
              ],
              "avertissements": []
            }
            """;
        preparerReponseApiMistral(jsonContent);

        MistralIaService.PlanIaResponse result = service.genererPlan(analyseAvecStockDormant(), 2.0);

        assertThat(result.mouvements()).hasSize(1);
        assertThat(result.mouvements().get(0).source_id()).isEqualTo(3L);
        assertThat(result.mouvements().get(0).quantite_allouee()).isEqualTo(300.0);
    }

    // ── Contenu du prompt envoyé à Mistral ───────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void prompt_decrit_besoin_comme_indicatif_pas_un_plafond() {
        preparerReponseApiMistral("{\"resume\":\"\",\"mouvements\":[],\"avertissements\":[]}");

        service.genererPlan(analyseFactice(), 2.0);

        verify(restTemplate).postForEntity(anyString(), requestCaptor.capture(), eq(Map.class));
        Map<String, Object> body = (Map<String, Object>) requestCaptor.getValue().getBody();
        List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
        String prompt = (String) messages.get(0).get("content");

        assertThat(prompt)
                .as("Le prompt doit indiquer que besoin ne plafonne pas l'allocation")
                .contains("NE plafonne PAS")
                .contains("BESOIN NON BLOQUANT")
                .contains("JAMAIS un motif de refus");
    }

    @Test
    @SuppressWarnings("unchecked")
    void prompt_contient_contrainte_msd_residuelle_sur_la_source() {
        preparerReponseApiMistral("{\"resume\":\"\",\"mouvements\":[],\"avertissements\":[]}");

        service.genererPlan(analyseFactice(), 2.0);

        verify(restTemplate).postForEntity(anyString(), requestCaptor.capture(), eq(Map.class));
        Map<String, Object> body = (Map<String, Object>) requestCaptor.getValue().getBody();
        List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
        String prompt = (String) messages.get(0).get("content");

        assertThat(prompt)
                .as("Le prompt doit définir la contrainte MSD résiduelle pour la source")
                .contains("MSD résiduelle")
                .contains("seuil_stock_securite_msd")
                .contains("La contrainte unique sur la quantité allouée est que la SOURCE");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private AnalyseResultatDTO analyseAvecStockDormant() {
        AnalyseResultatDTO dto = analyseFactice();

        AnalyseResultatDTO.AnalyseProduitDTO produit = dto.getProduits().get(0);

        AnalyseResultatDTO.StructureAnalyseDTO dormant = new AnalyseResultatDTO.StructureAnalyseDTO();
        dormant.setStructureId(3L);
        dormant.setStructureNom("Site Dormant");
        dormant.setMsd(null);
        dormant.setStockDisponible(new BigDecimal("300"));
        dormant.setCmm(BigDecimal.ZERO);
        dormant.setStatutStock("STOCK_DORMANT");
        dormant.setExcedent(new BigDecimal("300"));
        dormant.setBesoin(BigDecimal.ZERO);
        dormant.setAllocationsExistantes(BigDecimal.ZERO);

        // Ajouter aux sources existantes
        java.util.List<AnalyseResultatDTO.StructureAnalyseDTO> sources = new java.util.ArrayList<>(
                produit.getStructuresEnSurstock() != null ? produit.getStructuresEnSurstock() : java.util.List.of());
        sources.add(dormant);
        produit.setStructuresEnSurstock(sources);

        return dto;
    }

    @SuppressWarnings("unchecked")
    private void preparerReponseApiMistral(String content) {
        Map<String, Object> message = Map.of("content", content);
        Map<String, Object> choice  = Map.of("message", message);
        Map<String, Object> body    = Map.of("choices", List.of(choice));

        when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(body));
    }

    private AnalyseResultatDTO analyseFactice() {
        AnalyseResultatDTO dto = new AnalyseResultatDTO();
        dto.setPeriodeId(1L);
        dto.setProgrammeId(1L);
        dto.setRegionId(1L);
        dto.setPeriodeLibelle("01/2025");
        dto.setProgrammeNom("PNLS Factice");
        dto.setRegionNom("Région Test");

        AnalyseResultatDTO.AnalyseProduitDTO produit = new AnalyseResultatDTO.AnalyseProduitDTO();
        produit.setProduitId(10L);
        produit.setProduitCode("AMX500");
        produit.setProduitNom("Amoxicilline 500mg");
        produit.setProduitUnite("Boîte");

        AnalyseResultatDTO.StructureAnalyseDTO surstock = new AnalyseResultatDTO.StructureAnalyseDTO();
        surstock.setStructureId(1L);
        surstock.setStructureNom("CSB2 Ambatobe");
        surstock.setMsd(new BigDecimal("6.5"));
        surstock.setStockDisponible(new BigDecimal("650"));
        surstock.setCmm(new BigDecimal("100"));
        surstock.setStatutStock("SURSTOCK");
        surstock.setExcedent(new BigDecimal("250"));
        surstock.setBesoin(BigDecimal.ZERO);
        surstock.setAllocationsExistantes(BigDecimal.ZERO);
        produit.setStructuresEnSurstock(List.of(surstock));

        AnalyseResultatDTO.StructureAnalyseDTO rupture = new AnalyseResultatDTO.StructureAnalyseDTO();
        rupture.setStructureId(2L);
        rupture.setStructureNom("CSB1 Ambohipo");
        rupture.setMsd(BigDecimal.ZERO);
        rupture.setStockDisponible(BigDecimal.ZERO);
        rupture.setCmm(new BigDecimal("60"));
        rupture.setStatutStock("RUPTURE");
        rupture.setExcedent(BigDecimal.ZERO);
        rupture.setBesoin(new BigDecimal("120"));
        rupture.setAllocationsExistantes(BigDecimal.ZERO);
        produit.setStructuresEnRupture(List.of(rupture));

        dto.setProduits(List.of(produit));
        return dto;
    }
}
