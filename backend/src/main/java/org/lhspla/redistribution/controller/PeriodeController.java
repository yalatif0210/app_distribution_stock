package org.lhspla.redistribution.controller;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.request.PeriodeRequest;
import org.lhspla.redistribution.dto.response.PeriodeSaisieDTO;
import org.lhspla.redistribution.security.Perimetre;
import org.lhspla.redistribution.security.PerimetreService;
import org.lhspla.redistribution.service.PeriodeService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/periodes")
@RequiredArgsConstructor
public class PeriodeController {

    private final PeriodeService periodeService;
    private final PerimetreService perimetreService;

    @PostMapping
    @PreAuthorize("hasRole('PHARMACIEN_REGION')")
    public ResponseEntity<PeriodeSaisieDTO> createPeriode(@RequestBody PeriodeRequest req) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Long regionId = perimetreService.courant().resoudreRegion(null);
        return ResponseEntity.ok(periodeService.createPeriode(req, regionId, username));
    }

    /** Périodes des régions du périmètre (toutes pour l'ADMIN). */
    @GetMapping
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'GESTIONNAIRE', 'SUPERVISEUR', 'ADMIN')")
    public ResponseEntity<List<PeriodeSaisieDTO>> getPeriodes() {
        return ResponseEntity.ok(periodeService.findVisibles(perimetreService.courant().regionsVisibles()));
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISEUR')")
    public ResponseEntity<List<PeriodeSaisieDTO>> getAllPeriodes() {
        return ResponseEntity.ok(periodeService.findVisibles(perimetreService.courant().regionsVisibles()));
    }

    @PutMapping("/{id}/rouvrir")
    @PreAuthorize("hasRole('PHARMACIEN_REGION')")
    public ResponseEntity<PeriodeSaisieDTO> rouvrirPeriode(@PathVariable Long id) {
        return ResponseEntity.ok(periodeService.rouvrirPeriode(id, perimetreService.courant().resoudreRegion(null)));
    }

    @PutMapping("/{id}/fermer")
    @PreAuthorize("hasRole('PHARMACIEN_REGION')")
    public ResponseEntity<PeriodeSaisieDTO> fermerPeriode(@PathVariable Long id) {
        return ResponseEntity.ok(periodeService.fermerPeriode(id, perimetreService.courant().resoudreRegion(null)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<Void> deletePeriode(@PathVariable Long id) {
        Perimetre p = perimetreService.courant();
        // ADMIN : null = pas de restriction de région ; pharmacien : sa région
        periodeService.deletePeriode(id, p.estAdmin() ? null : p.resoudreRegion(null));
        return ResponseEntity.noContent().build();
    }
}
