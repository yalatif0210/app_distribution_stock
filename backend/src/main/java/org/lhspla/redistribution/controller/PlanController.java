package org.lhspla.redistribution.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.request.ExecutionRequest;
import org.lhspla.redistribution.dto.request.LignePlanRequest;
import org.lhspla.redistribution.dto.request.PlanGenerationRequest;
import org.lhspla.redistribution.dto.response.ExecutionProgressionDTO;
import org.lhspla.redistribution.dto.response.LignePlanDTO;
import org.lhspla.redistribution.dto.response.PlanReattributionDTO;
import org.lhspla.redistribution.dto.response.StockSourceDTO;
import org.lhspla.redistribution.service.PlanReattributionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/plans")
@RequiredArgsConstructor
public class PlanController {

    private final PlanReattributionService planService;

    @PostMapping("/generer")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<PlanReattributionDTO> generer(
            @Valid @RequestBody PlanGenerationRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(planService.generer(req, user.getUsername()));
    }

    @GetMapping
    public ResponseEntity<List<PlanReattributionDTO>> getPlans(
            @RequestParam(required = false) Long periodeId,
            @RequestParam(required = false) String statut) {
        return ResponseEntity.ok(planService.findAll(periodeId, statut));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlanReattributionDTO> getPlan(@PathVariable Long id) {
        return ResponseEntity.ok(planService.findById(id));
    }

    @PostMapping("/{id}/valider")
    public ResponseEntity<PlanReattributionDTO> valider(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(planService.valider(id, user.getUsername()));
    }

    @PostMapping("/{id}/lignes")
    public ResponseEntity<LignePlanDTO> ajouterLigne(
            @PathVariable Long id,
            @Valid @RequestBody LignePlanRequest req) {
        return ResponseEntity.ok(planService.ajouterLigne(id, req));
    }

    @PutMapping("/{id}/lignes/{ligneId}")
    public ResponseEntity<LignePlanDTO> modifierLigne(
            @PathVariable Long id,
            @PathVariable Long ligneId,
            @Valid @RequestBody LignePlanRequest req) {
        return ResponseEntity.ok(planService.modifierLigne(id, ligneId, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<Void> supprimerPlan(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails user) {
        planService.supprimerPlan(id, user.getUsername());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/lignes/{ligneId}")
    public ResponseEntity<Void> supprimerLigne(
            @PathVariable Long id,
            @PathVariable Long ligneId,
            @AuthenticationPrincipal UserDetails user) {
        planService.supprimerLigne(id, ligneId, user.getUsername());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/lignes/{ligneId}/execution")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'SUPERVISEUR', 'ADMIN')")
    public ResponseEntity<LignePlanDTO> executerLigne(
            @PathVariable Long id,
            @PathVariable Long ligneId,
            @Valid @RequestBody ExecutionRequest req) {
        return ResponseEntity.ok(planService.executerLigne(id, ligneId, req));
    }

    @GetMapping("/stock-source")
    public ResponseEntity<StockSourceDTO> getStockSource(
            @RequestParam Long periodeId,
            @RequestParam Long produitId,
            @RequestParam Long structureSourceId,
            @RequestParam Long planId,
            @RequestParam(required = false) Long excludeLigneId) {
        return ResponseEntity.ok(planService.calculerStockSource(
                periodeId, produitId, structureSourceId, planId, excludeLigneId));
    }

    @GetMapping("/execution/progression")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<ExecutionProgressionDTO> getProgressionAnnee(
            @RequestParam int annee,
            @RequestParam(required = false) Long regionId,
            @RequestParam(required = false) Long programmeId) {
        return ResponseEntity.ok(planService.getProgressionAnnee(annee, regionId, programmeId));
    }
}
