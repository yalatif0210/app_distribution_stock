package org.lhspla.redistribution.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.lhspla.redistribution.dto.request.ExecutionRequest;
import org.lhspla.redistribution.entity.*;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.*;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
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

    // ── executerLigne : préconditions ────────────────────────────────────────────

    @Test
    void executerLigne_refuse_si_plan_est_en_brouillon() {
        PlanReattribution plan = planAvecStatut("BROUILLON");
        lenient().when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));

        ExecutionRequest req = executionRequest("80", null);

        assertThatThrownBy(() -> service.executerLigne(1L, 1L, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("validé");
    }

    // ── executerLigne : transitions de statut ────────────────────────────────────

    @Test
    void executerLigne_passe_a_EXECUTE_quand_quantite_atteint_proposee() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        LignePlan ligne = ligneAvecQuantiteProposee("100");
        lenient().when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));
        when(ligneRepo.findById(1L)).thenReturn(Optional.of(ligne));
        when(ligneRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(ligneRepo.findByPlanId(1L)).thenReturn(List.of(ligne));

        ExecutionRequest req = executionRequest("100", "Livraison complète");
        service.executerLigne(1L, 1L, req);

        ArgumentCaptor<LignePlan> captor = ArgumentCaptor.forClass(LignePlan.class);
        verify(ligneRepo).save(captor.capture());
        assertThat(captor.getValue().getStatut()).isEqualTo("EXECUTE");
    }

    @Test
    void executerLigne_passe_a_EXECUTE_quand_quantite_depasse_proposee() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        LignePlan ligne = ligneAvecQuantiteProposee("100");
        lenient().when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));
        when(ligneRepo.findById(1L)).thenReturn(Optional.of(ligne));
        when(ligneRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(ligneRepo.findByPlanId(1L)).thenReturn(List.of(ligne));

        ExecutionRequest req = executionRequest("110", null);
        service.executerLigne(1L, 1L, req);

        ArgumentCaptor<LignePlan> captor = ArgumentCaptor.forClass(LignePlan.class);
        verify(ligneRepo).save(captor.capture());
        assertThat(captor.getValue().getStatut()).isEqualTo("EXECUTE");
    }

    @Test
    void executerLigne_passe_a_PARTIEL_quand_quantite_inferieure_a_proposee() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        LignePlan ligne = ligneAvecQuantiteProposee("100");
        lenient().when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));
        when(ligneRepo.findById(1L)).thenReturn(Optional.of(ligne));
        when(ligneRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(ligneRepo.findByPlanId(1L)).thenReturn(List.of(ligne));

        ExecutionRequest req = executionRequest("60", "Livraison partielle - rupture de transport");
        service.executerLigne(1L, 1L, req);

        ArgumentCaptor<LignePlan> captor = ArgumentCaptor.forClass(LignePlan.class);
        verify(ligneRepo).save(captor.capture());
        assertThat(captor.getValue().getStatut()).isEqualTo("PARTIEL");
    }

    // ── verifierCloturePlan : auto-clôture ───────────────────────────────────────

    @Test
    void plan_passe_a_CLOTURE_quand_toutes_les_lignes_sont_executees() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        LignePlan l1 = ligneAvecStatut("EXECUTE");
        LignePlan l2 = ligneAvecStatut("EXECUTE");

        lenient().when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));
        when(ligneRepo.findById(1L)).thenReturn(Optional.of(l1));
        when(ligneRepo.save(any(LignePlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(ligneRepo.findByPlanId(1L)).thenReturn(List.of(l1, l2));
        when(planRepo.save(any(PlanReattribution.class))).thenAnswer(inv -> inv.getArgument(0));

        ExecutionRequest req = executionRequest("100", null);
        l1.setQuantiteProposee(new BigDecimal("100"));
        service.executerLigne(1L, 1L, req);

        ArgumentCaptor<PlanReattribution> planCaptor = ArgumentCaptor.forClass(PlanReattribution.class);
        verify(planRepo).save(planCaptor.capture());
        assertThat(planCaptor.getValue().getStatut()).isEqualTo("CLOTURE");
    }

    @Test
    void plan_reste_valide_si_au_moins_une_ligne_non_terminee() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        plan.setId(1L);
        LignePlan l1 = ligneAvecStatut("EXECUTE");
        LignePlan l2 = ligneAvecStatut("EN_ATTENTE"); // pas encore terminée

        lenient().when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        lenient().when(planRepo.verrouiller(1L)).thenReturn(Optional.of(plan));
        when(ligneRepo.findById(1L)).thenReturn(Optional.of(l1));
        when(ligneRepo.save(any(LignePlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(ligneRepo.findByPlanId(1L)).thenReturn(List.of(l1, l2));

        l1.setQuantiteProposee(new BigDecimal("100"));
        ExecutionRequest req = executionRequest("100", null);
        service.executerLigne(1L, 1L, req);

        // planRepo.save ne doit pas être appelé (pas de clôture)
        verify(planRepo, never()).save(any());
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
