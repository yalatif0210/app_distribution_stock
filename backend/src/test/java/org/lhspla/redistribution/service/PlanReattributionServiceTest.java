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

    // ── supprimerLigne — plan BROUILLON ──────────────────────────────────────────

    @Test
    void supprimerLigne_accepte_tout_role_si_plan_est_brouillon() {
        PlanReattribution plan = planAvecStatut("BROUILLON");
        when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        when(ligneRepo.findByPlanId(1L)).thenReturn(List.of());

        service.supprimerLigne(1L, 99L, "gestionnaire01");

        verify(ligneRepo).deleteById(99L);
    }

    // ── supprimerLigne — plan VALIDE, restriction de rôle ───────────────────────

    @Test
    void supprimerLigne_interdit_au_gestionnaire_sur_plan_valide() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        when(utilisateurRepo.findByUsername("gestionnaire01"))
                .thenReturn(Optional.of(utilisateurAvecRole("GESTIONNAIRE")));

        assertThatThrownBy(() -> service.supprimerLigne(1L, 99L, "gestionnaire01"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("superviseur");
    }

    @Test
    void supprimerLigne_autorise_le_superviseur_sur_plan_valide() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        when(utilisateurRepo.findByUsername("superviseur01"))
                .thenReturn(Optional.of(utilisateurAvecRole("SUPERVISEUR")));
        when(ligneRepo.findByPlanId(1L)).thenReturn(List.of());

        service.supprimerLigne(1L, 99L, "superviseur01");

        verify(ligneRepo).deleteById(99L);
    }

    @Test
    void supprimerLigne_autorise_l_admin_sur_plan_valide() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        when(utilisateurRepo.findByUsername("admin_sys"))
                .thenReturn(Optional.of(utilisateurAvecRole("ADMIN")));
        when(ligneRepo.findByPlanId(1L)).thenReturn(List.of());

        service.supprimerLigne(1L, 99L, "admin_sys");

        verify(ligneRepo).deleteById(99L);
    }

    // ── supprimerLigne — plan CLOTURE ────────────────────────────────────────────

    @Test
    void supprimerLigne_refuse_si_plan_est_cloture() {
        PlanReattribution plan = planAvecStatut("CLOTURE");
        when(planRepo.findById(1L)).thenReturn(Optional.of(plan));

        assertThatThrownBy(() -> service.supprimerLigne(1L, 99L, "n_importe_qui"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("clôturé");
    }

    // ── executerLigne — préconditions ────────────────────────────────────────────

    @Test
    void executerLigne_refuse_si_plan_est_en_brouillon() {
        PlanReattribution plan = planAvecStatut("BROUILLON");
        when(planRepo.findById(1L)).thenReturn(Optional.of(plan));

        ExecutionRequest req = executionRequest("80", null);

        assertThatThrownBy(() -> service.executerLigne(1L, 1L, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("validé");
    }

    // ── executerLigne — transitions de statut ────────────────────────────────────

    @Test
    void executerLigne_passe_a_EXECUTE_quand_quantite_atteint_proposee() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        LignePlan ligne = ligneAvecQuantiteProposee("100");
        when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
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
        when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
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
        when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
        when(ligneRepo.findById(1L)).thenReturn(Optional.of(ligne));
        when(ligneRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(ligneRepo.findByPlanId(1L)).thenReturn(List.of(ligne));

        ExecutionRequest req = executionRequest("60", "Livraison partielle - rupture de transport");
        service.executerLigne(1L, 1L, req);

        ArgumentCaptor<LignePlan> captor = ArgumentCaptor.forClass(LignePlan.class);
        verify(ligneRepo).save(captor.capture());
        assertThat(captor.getValue().getStatut()).isEqualTo("PARTIEL");
    }

    // ── verifierCloturePlan — auto-clôture ───────────────────────────────────────

    @Test
    void plan_passe_a_CLOTURE_quand_toutes_les_lignes_sont_executees() {
        PlanReattribution plan = planAvecStatut("VALIDE");
        LignePlan l1 = ligneAvecStatut("EXECUTE");
        LignePlan l2 = ligneAvecStatut("EXECUTE");

        when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
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

        when(planRepo.findById(1L)).thenReturn(Optional.of(plan));
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

    private LignePlan ligneAvecQuantiteProposee(String qt) {
        LignePlan l = new LignePlan();
        l.setId(1L);
        l.setStatut("EN_ATTENTE");
        l.setQuantiteProposee(new BigDecimal(qt));
        l.setQuantiteExecutee(BigDecimal.ZERO);
        return l;
    }

    private LignePlan ligneAvecStatut(String statut) {
        LignePlan l = new LignePlan();
        l.setId(1L);
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
