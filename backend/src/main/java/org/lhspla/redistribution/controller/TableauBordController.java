package org.lhspla.redistribution.controller;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.response.TableauBordDTO;
import org.lhspla.redistribution.security.PerimetreService;
import org.lhspla.redistribution.service.PlanReattributionService;
import org.lhspla.redistribution.service.TableauBordService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tableau-bord")
@RequiredArgsConstructor
public class TableauBordController {

    private final TableauBordService tableauBordService;
    private final PlanReattributionService planService;
    private final PerimetreService perimetreService;

    /**
     * Tableau de bord d'un plan. La région est celle du plan (le paramètre regionId
     * est ignoré) et doit appartenir au périmètre de l'utilisateur.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'SUPERVISEUR', 'ADMIN')")
    public ResponseEntity<TableauBordDTO> getTableauBord(
            @RequestParam Long periodeId,
            @RequestParam Long programmeId,
            @RequestParam(required = false) Long regionId,
            @RequestParam Long planId) {
        Long regionDuPlan = perimetreService.courant().regionObligatoire(planService.regionDuPlan(planId));
        return ResponseEntity.ok(tableauBordService.calculer(periodeId, programmeId, regionDuPlan, planId));
    }
}
