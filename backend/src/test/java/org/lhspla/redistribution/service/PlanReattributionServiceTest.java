package org.lhspla.redistribution.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.lhspla.redistribution.dto.request.ExecutionRequest;
import org.lhspla.redistribution.dto.request.ReceptionRequest;
import org.lhspla.redistribution.entity.*;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.*;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlanReattributionServiceTest {

    @Mock private PlanReattributionRepository planRepo;
    @Mock private LignePlanRepository ligneRepo;
    @Mock private ReceptionLigneRepository receptionRepo;
    @Mock private PeriodeSaisieRepository periodeRepo;
    @Mock private ProgrammeRepository programmeRepo;
    @Mock private RegionRepository regionRepo;
    @Mock private StructureRepository structureRepo;
    @Mock private ProduitRepository produitRepo;
    @Mock private SaisieStockRepository saisieStockRepo;
    @Mock private UtilisateurRepository utilisateurRepo;
    @Mock private AnalyseStockService analyseStockService;
    @Mock private MistralIaService mistralIaService;
    @Mock private NotificationService notificationService;
    @Mock private PeriodeService periodeService;

    @InjectMocks private PlanReattributionService service;

    // ── generer : un seul brouillon par périmètre ────────────────────────────────

    @Test
    void generer_refuse_si_un_brouillon_existe_sans_demande_de_remplacement() {
        when(periodeRepo.verrouiller(1L)).thenReturn(Optional.of(new PeriodeSaisie()));
        when(regionRepo.findById(1L)).thenReturn(Optional.of(new Region()));
        when(planRepo.existsPlanActifFor(1L, 1L, 1L)).thenReturn(false);
        PlanReattribution brouillon = planAvecStatut("BROUILLON");
        brouillon.setId(6L);
        when(planRepo.findBrouillons(1L, 1L, 1L)).thenReturn(List.of(brouillon));

        org.lhspla.redistribution.dto.request.PlanGenerationRequest req =
                new org.lhspla.redistribution.dto.request.PlanGenerationRequest();
        req.setPeriodeId(1L); req.setProgrammeId(1L); req.setRegionId(1L); req.setAnalyseIa(false);

        assertThatThrownBy(() -> service.generer(req, "pharmacien1"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("n° 6");
        verify(planRepo, never()).deleteAll(any());
        verify(planRepo, never()).save(any());
    }

    @Test
    void generer_en_mode_IA_bascule_en_manuel_si_l_IA_n_est_pas_configuree() {
        PeriodeSaisie periode = new PeriodeSaisie();
        when(periodeRepo.verrouiller(1L)).thenReturn(Optional.of(periode));
        when(regionRepo.findById(1L)).thenReturn(Optional.of(new Region()));
        when(programmeRepo.findById(1L)).thenReturn(Optional.of(new Programme()));
        org.lhspla.redistribution.dto.response.AnalyseResultatDTO analyse =
                new org.lhspla.redistribution.dto.response.AnalyseResultatDTO();
        analyse.setProduits(List.of(new org.lhspla.redistribution.dto.response.AnalyseResultatDTO.AnalyseProduitDTO()));
        when(analyseStockService.analyserStocks(1L, 1L, 1L)).thenReturn(analyse);
        when(mistralIaService.estConfiguree()).thenReturn(false);
        when(planRepo.save(any(PlanReattribution.class))).thenAnswer(inv -> {
            PlanReattribution p = inv.getArgument(0);
            p.setId(42L);
            when(planRepo.findById(42L)).thenReturn(Optional.of(p));
            return p;
        });

        org.lhspla.redistribution.dto.request.PlanGenerationRequest req =
                new org.lhspla.redistribution.dto.request.PlanGenerationRequest();
        req.setPeriodeId(1L); req.setProgrammeId(1L); req.setRegionId(1L); req.setAnalyseIa(true);

        var plan = service.generer(req, "pharmacien1");

        assertThat(plan.isBasculeManuel()).isTrue();
        assertThat(plan.getMotifBascule()).contains("pas configurée");
        assertThat(plan.getGenereParlA()).isFalse();
        verify(mistralIaService, never()).genererPlan(any(), anyDouble());
    }

    // ── supprimerLigne : plan BROUILLON ──────────────────────────────────────────

    @Test
    void supprimerLigne_accepte_tout_role_si_plan_est_brouillon() {
        PlanReattribution plan = planAvecStatut("BROUILLON");
        LignePlan ligne = ligneDuPlan(99L);
        lenient().when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));
        when(ligneRepo.findById(99L)).thenReturn(Optional.of(ligne));

        service.supprimerLigne(1L, 99L, "gestionnaire01");

        verify(ligneRepo).delete(ligne);
    }

    // ── supprimerLigne : plan VALIDE, restriction de rôle ───────────────────────

    @Test
    void supprimerLigne_interdit_au_gestionnaire_sur_plan_valide() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        lenient().when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));
        when(utilisateurRepo.findByUsername("gestionnaire01"))
                .thenReturn(Optional.of(utilisateurAvecRole("GESTIONNAIRE")));

        assertThatThrownBy(() -> service.supprimerLigne(1L, 99L, "gestionnaire01"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("administrateur");
    }

    @Test
    void supprimerLigne_interdit_au_superviseur_sur_plan_valide() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        lenient().when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));
        when(utilisateurRepo.findByUsername("superviseur01"))
                .thenReturn(Optional.of(utilisateurAvecRole("SUPERVISEUR")));

        assertThatThrownBy(() -> service.supprimerLigne(1L, 99L, "superviseur01"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("administrateur");
        verify(ligneRepo, never()).delete(any());
    }

    @Test
    void supprimerLigne_autorise_l_admin_sur_plan_valide() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        lenient().when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));
        when(utilisateurRepo.findByUsername("admin_sys"))
                .thenReturn(Optional.of(utilisateurAvecRole("ADMIN")));
        LignePlan ligne = ligneDuPlan(99L);
        when(ligneRepo.findById(99L)).thenReturn(Optional.of(ligne));
        lenient().when(ligneRepo.findByPlanId(1L)).thenReturn(List.of());

        service.supprimerLigne(1L, 99L, "admin_sys");

        verify(ligneRepo).delete(ligne);
    }

    // ── supprimerLigne : plan CLOTURE ────────────────────────────────────────────

    @Test
    void supprimerLigne_refuse_si_plan_est_cloture() {
        PlanReattribution plan = planAvecStatut("CLOTURE");
        lenient().when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));

        assertThatThrownBy(() -> service.supprimerLigne(1L, 99L, "n_importe_qui"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("clôturé");
    }

    // ── executerLigne (saisie du total par le pharmacien) ───────────────────────

    @Test
    void executerLigne_refuse_si_plan_est_en_brouillon() {
        PlanReattribution plan = planAvecStatut("BROUILLON");
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));

        assertThatThrownBy(() -> service.executerLigne(1L, 1L, executionRequest("80", null), "pharma"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("validé");
    }

    @Test
    void executerLigne_passe_a_EXECUTE_quand_quantite_atteint_proposee() {
        LignePlan ligne = preparerLigne("100");

        service.executerLigne(1L, 1L, executionRequest("100", "Livraison complète"), "pharma");

        assertThat(ligne.getStatut()).isEqualTo("EXECUTE");
        assertThat(ligne.getQuantiteExecutee()).isEqualByComparingTo("100");
        assertThat(ligne.getDateReception()).isEqualTo(LocalDate.now());
        verify(receptionRepo).save(any(ReceptionLigne.class));
    }

    @Test
    void executerLigne_refuse_une_quantite_superieure_a_la_proposee() {
        preparerLigne("100");

        assertThatThrownBy(() -> service.executerLigne(1L, 1L, executionRequest("110", null), "pharma"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("dépasser");
    }

    @Test
    void executerLigne_passe_a_PARTIEL_quand_quantite_inferieure_a_proposee() {
        LignePlan ligne = preparerLigne("100");

        service.executerLigne(1L, 1L, executionRequest("60", "Livraison partielle"), "pharma");

        assertThat(ligne.getStatut()).isEqualTo("PARTIEL");
    }

    @Test
    void executerLigne_refuse_de_descendre_sous_les_receptions_confirmees() {
        LignePlan ligne = preparerLigne("100");
        ligne.setQuantiteExecutee(new BigDecimal("50"));
        ligne.setStatut("PARTIEL");

        assertThatThrownBy(() -> service.executerLigne(1L, 1L, executionRequest("30", null), "pharma"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("déjà confirmé");
    }

    // ── receptionner (confirmation par le site destinataire) ────────────────────

    @Test
    void reception_du_site_cumule_et_clot_la_ligne_quand_tout_est_recu() {
        LignePlan ligne = preparerLigne("100");
        siteConnecte(10L);

        service.receptionner(1L, 1L, reception("40", false, null), "gest");
        assertThat(ligne.getStatut()).isEqualTo("PARTIEL");
        assertThat(ligne.getQuantiteExecutee()).isEqualByComparingTo("40");

        service.receptionner(1L, 1L, reception("60", false, null), "gest");
        assertThat(ligne.getStatut()).isEqualTo("EXECUTE");
        assertThat(ligne.getQuantiteExecutee()).isEqualByComparingTo("100");
        verify(notificationService, times(2)).notifierReception(any(), any(), any());
    }

    @Test
    void reception_refuse_un_cumul_superieur_a_la_quantite_prevue() {
        LignePlan ligne = preparerLigne("100");
        ligne.setQuantiteExecutee(new BigDecimal("80"));
        ligne.setStatut("PARTIEL");
        siteConnecte(10L);

        assertThatThrownBy(() -> service.receptionner(1L, 1L, reception("30", false, null), "gest"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("plus que la quantité prévue");
    }

    @Test
    void reception_close_avec_ecart_exige_un_motif() {
        preparerLigne("100");
        siteConnecte(10L);

        assertThatThrownBy(() -> service.receptionner(1L, 1L, reception("70", true, null), "gest"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("motif");
    }

    @Test
    void reception_close_avec_ecart_passe_a_EXECUTE_et_garde_le_motif() {
        LignePlan ligne = preparerLigne("100");
        siteConnecte(10L);

        service.receptionner(1L, 1L, reception("70", true, "casse"), "gest");

        assertThat(ligne.getStatut()).isEqualTo("EXECUTE");
        assertThat(ligne.getQuantiteExecutee()).isEqualByComparingTo("70");
        assertThat(ligne.getMotifEcart()).isEqualTo("CASSE");
    }

    @Test
    void reception_refusee_pour_un_autre_site_que_le_destinataire() {
        preparerLigne("100");
        siteConnecte(99L);

        assertThatThrownBy(() -> service.receptionner(1L, 1L, reception("10", false, null), "gest"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("site destinataire");
    }

    @Test
    void reception_refuse_une_date_future_ou_anterieure_a_la_validation() {
        preparerLigne("100");
        siteConnecte(10L);
        ReceptionRequest futur = reception("10", false, null);
        futur.setDateReception(LocalDate.now().plusDays(1));
        ReceptionRequest avant = reception("10", false, null);
        avant.setDateReception(LocalDate.now().minusDays(30));

        assertThatThrownBy(() -> service.receptionner(1L, 1L, futur, "gest")).hasMessageContaining("futur");
        assertThatThrownBy(() -> service.receptionner(1L, 1L, avant, "gest")).hasMessageContaining("précéder");
    }

    @Test
    void reception_refusee_sur_une_ligne_deja_close() {
        LignePlan ligne = preparerLigne("100");
        ligne.setStatut("EXECUTE");
        siteConnecte(10L);

        assertThatThrownBy(() -> service.receptionner(1L, 1L, reception("10", false, null), "gest"))
                .hasMessageContaining("déjà close");
    }

    // ── verifierCloturePlan : auto-clôture ───────────────────────────────────────

    @Test
    void plan_passe_a_CLOTURE_quand_toutes_les_lignes_sont_executees() {
        LignePlan l1 = preparerLigne("100");
        LignePlan l2 = ligneAvecStatut("EXECUTE");
        when(ligneRepo.findByPlanId(1L)).thenReturn(List.of(l1, l2));
        when(planRepo.save(any(PlanReattribution.class))).thenAnswer(inv -> inv.getArgument(0));

        service.executerLigne(1L, 1L, executionRequest("100", null), "pharma");

        ArgumentCaptor<PlanReattribution> planCaptor = ArgumentCaptor.forClass(PlanReattribution.class);
        verify(planRepo).save(planCaptor.capture());
        assertThat(planCaptor.getValue().getStatut()).isEqualTo("CLOTURE");
    }

    @Test
    void plan_reste_valide_si_au_moins_une_ligne_non_terminee() {
        LignePlan l1 = preparerLigne("100");
        LignePlan l2 = ligneAvecStatut("EN_ATTENTE"); // pas encore terminée
        when(ligneRepo.findByPlanId(1L)).thenReturn(List.of(l1, l2));

        service.executerLigne(1L, 1L, executionRequest("100", null), "pharma");

        // planRepo.save ne doit pas être appelé (pas de clôture)
        verify(planRepo, never()).save(any());
    }

    /** Plan validé il y a 10 jours, ligne en attente vers le site 10. */
    private LignePlan preparerLigne(String prevu) {
        PlanReattribution plan = planAvecStatut("VALIDE");
        plan.setDateValidation(LocalDateTime.now().minusDays(10));
        LignePlan ligne = ligneAvecQuantiteProposee(prevu);
        ligne.setPlan(plan);
        Structure cible = new Structure();
        cible.setId(10L);
        cible.setNom("CSB destinataire");
        ligne.setStructureCible(cible);
        Produit produit = new Produit();
        produit.setNom("Produit test");
        produit.setUnite("boîte");
        ligne.setProduit(produit);
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));
        lenient().when(ligneRepo.findById(1L)).thenReturn(Optional.of(ligne));
        lenient().when(ligneRepo.save(any(LignePlan.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(ligneRepo.findByPlanId(1L)).thenReturn(List.of(ligne));
        return ligne;
    }

    /** Gestionnaire connecté, rattaché à la structure donnée. */
    private void siteConnecte(Long structureId) {
        Utilisateur u = utilisateurAvecRole("GESTIONNAIRE");
        Structure s = new Structure();
        s.setId(structureId);
        u.setStructure(s);
        lenient().when(utilisateurRepo.findByUsername("gest")).thenReturn(Optional.of(u));
    }

    private ReceptionRequest reception(String quantite, boolean terminee, String motif) {
        ReceptionRequest r = new ReceptionRequest();
        r.setQuantite(new BigDecimal(quantite));
        r.setDateReception(LocalDate.now());
        r.setTerminee(terminee);
        r.setMotifEcart(motif);
        return r;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private PlanReattribution planAvecStatut(String statut) {
        PlanReattribution plan = new PlanReattribution();
        plan.setId(1L);
        plan.setStatut(statut);
        return plan;
    }

    private LignePlan ligneDuPlan(Long id) {
        LignePlan l = new LignePlan();
        l.setId(id);
        l.setPlan(planAvecStatut("BROUILLON"));
        return l;
    }

    private LignePlan ligneAvecQuantiteProposee(String qt) {
        LignePlan l = new LignePlan();
        l.setId(1L);
        l.setPlan(planAvecStatut("VALIDE"));
        l.setStatut("EN_ATTENTE");
        l.setQuantiteProposee(new BigDecimal(qt));
        l.setQuantiteExecutee(BigDecimal.ZERO);
        return l;
    }

    private LignePlan ligneAvecStatut(String statut) {
        LignePlan l = new LignePlan();
        l.setId(1L);
        l.setPlan(planAvecStatut("VALIDE"));
        l.setStatut(statut);
        l.setQuantiteProposee(new BigDecimal("100"));
        l.setQuantiteExecutee(statut.equals("EXECUTE") ? new BigDecimal("100") : BigDecimal.ZERO);
        return l;
    }

    private Utilisateur utilisateurAvecRole(String roleName) {
        Role role = new Role();
        role.setName(roleName);
        Utilisateur u = new Utilisateur();
        u.setUsername("fake_user_for_test");
        u.setRole(role);
        return u;
    }

    private ExecutionRequest executionRequest(String quantite, String notes) {
        ExecutionRequest req = new ExecutionRequest();
        req.setQuantiteExecutee(new BigDecimal(quantite));
        req.setNotes(notes);
        return req;
    }
}
