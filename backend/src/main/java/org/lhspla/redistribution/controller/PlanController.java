package org.lhspla.redistribution.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.request.ExecutionRequest;
import org.lhspla.redistribution.dto.request.ReceptionRequest;
import org.lhspla.redistribution.dto.response.ReceptionDTO;
import org.lhspla.redistribution.dto.request.LignePlanRequest;
import org.lhspla.redistribution.dto.request.PlanGenerationRequest;
import org.lhspla.redistribution.dto.response.ExecutionProgressionDTO;
import org.lhspla.redistribution.dto.response.LignePlanDTO;
import org.lhspla.redistribution.dto.response.PlanReattributionDTO;
import org.lhspla.redistribution.dto.response.StockSourceDTO;
import org.lhspla.redistribution.security.Perimetre;
import org.lhspla.redistribution.security.PerimetreService;
import org.lhspla.redistribution.service.PlanReattributionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

/**
 * Plans de réattribution. Lecture : tout rôle, limitée aux régions de son périmètre.
 * Écriture : PHARMACIEN_REGION (sa région) et ADMIN. Le SUPERVISEUR est en lecture seule.
 */
@RestController
@RequestMapping("/api/plans")
@RequiredArgsConstructor
public class PlanController {

    private final PlanReattributionService planService;
    private final PerimetreService perimetreService;

    @PostMapping("/generer")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<PlanReattributionDTO> generer(
            @Valid @RequestBody PlanGenerationRequest req,
            @AuthenticationPrincipal UserDetails user) {
        req.setRegionId(perimetreService.courant().regionObligatoire(req.getRegionId()));
        return ResponseEntity.ok(planService.generer(req, user.getUsername()));
    }

    /** L'analyse IA est-elle configurée ? L'écran de génération ne la propose que si oui. */
    @GetMapping("/ia-disponible")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<java.util.Map<String, Boolean>> iaDisponible() {
        return ResponseEntity.ok(java.util.Map.of("disponible", planService.iaConfiguree()));
    }

    /** Brouillon déjà en cours pour ce périmètre (204 s'il n'y en a pas). */
    @GetMapping("/brouillon")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<PlanReattributionDTO> getBrouillon(
            @RequestParam Long periodeId,
            @RequestParam(required = false) Long programmeId,
            @RequestParam(required = false) Long regionId) {
        Long region = perimetreService.courant().regionObligatoire(regionId);
        return planService.brouillonExistant(periodeId, programmeId, region)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping
    public ResponseEntity<List<PlanReattributionDTO>> getPlans(
            @RequestParam(required = false) Long periodeId,
            @RequestParam(required = false) String statut) {
        Set<Long> regions = perimetreService.courant().regionsVisibles();
        List<PlanReattributionDTO> plans = planService.findAll(periodeId, statut);
        if (regions == null) return ResponseEntity.ok(plans);
        return ResponseEntity.ok(plans.stream()
                .filter(p -> p.getRegionId() != null && regions.contains(p.getRegionId()))
                .toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlanReattributionDTO> getPlan(@PathVariable Long id) {
        exigerPlan(id);
        return ResponseEntity.ok(planService.findById(id));
    }

    @PostMapping("/{id}/valider")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<PlanReattributionDTO> valider(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails user) {
        exigerPlan(id);
        return ResponseEntity.ok(planService.valider(id, user.getUsername()));
    }

    @PostMapping("/{id}/lignes")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<LignePlanDTO> ajouterLigne(
            @PathVariable Long id,
            @Valid @RequestBody LignePlanRequest req) {
        exigerPlan(id);
        return ResponseEntity.ok(planService.ajouterLigne(id, req));
    }

    @PutMapping("/{id}/lignes/{ligneId}")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<LignePlanDTO> modifierLigne(
            @PathVariable Long id,
            @PathVariable Long ligneId,
            @Valid @RequestBody LignePlanRequest req) {
        exigerPlan(id);
        return ResponseEntity.ok(planService.modifierLigne(id, ligneId, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<Void> supprimerPlan(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails user) {
        exigerPlan(id);
        planService.supprimerPlan(id, user.getUsername());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/lignes/{ligneId}")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<Void> supprimerLigne(
            @PathVariable Long id,
            @PathVariable Long ligneId,
            @AuthenticationPrincipal UserDetails user) {
        exigerPlan(id);
        planService.supprimerLigne(id, ligneId, user.getUsername());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/lignes/{ligneId}/execution")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<LignePlanDTO> executerLigne(
            @PathVariable Long id,
            @PathVariable Long ligneId,
            @Valid @RequestBody ExecutionRequest req,
            @AuthenticationPrincipal UserDetails user) {
        exigerPlan(id);
        return ResponseEntity.ok(planService.executerLigne(id, ligneId, req, user.getUsername()));
    }

    /** Réception confirmée par le site destinataire (le service vérifie qu'il s'agit bien de lui). */
    @PostMapping("/{id}/lignes/{ligneId}/receptions")
    @PreAuthorize("hasAnyRole('GESTIONNAIRE', 'PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<LignePlanDTO> receptionner(
            @PathVariable Long id,
            @PathVariable Long ligneId,
            @Valid @RequestBody ReceptionRequest req,
            @AuthenticationPrincipal UserDetails user) {
        exigerPlan(id);
        return ResponseEntity.ok(planService.receptionner(id, ligneId, req, user.getUsername()));
    }

    @GetMapping("/{id}/lignes/{ligneId}/receptions")
    public ResponseEntity<List<ReceptionDTO>> receptions(@PathVariable Long id, @PathVariable Long ligneId) {
        exigerPlan(id);
        return ResponseEntity.ok(planService.receptions(id, ligneId));
    }

    @GetMapping("/stock-source")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<StockSourceDTO> getStockSource(
            @RequestParam Long periodeId,
            @RequestParam Long produitId,
            @RequestParam Long structureSourceId,
            @RequestParam Long planId,
            @RequestParam(required = false) Long excludeLigneId) {
        exigerPlan(planId);
        perimetreService.exigerStructure(structureSourceId);
        return ResponseEntity.ok(planService.calculerStockSource(
                periodeId, produitId, structureSourceId, planId, excludeLigneId));
    }

    @GetMapping("/execution/progression")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'SUPERVISEUR', 'ADMIN')")
    public ResponseEntity<ExecutionProgressionDTO> getProgressionAnnee(
            @RequestParam int annee,
            @RequestParam(required = false) Long regionId,
            @RequestParam(required = false) Long programmeId) {
        Perimetre p = perimetreService.courant();
        Set<Long> regions;
        if (regionId != null) {
            p.exigerRegion(regionId);
            regions = Set.of(regionId);
        } else {
            regions = p.regionsVisibles();      // null = toutes (ADMIN)
        }
        return ResponseEntity.ok(planService.getProgressionAnnee(annee, regions, programmeId));
    }

    private void exigerPlan(Long planId) {
        perimetreService.courant().exigerRegion(planService.regionDuPlan(planId));
    }
}
