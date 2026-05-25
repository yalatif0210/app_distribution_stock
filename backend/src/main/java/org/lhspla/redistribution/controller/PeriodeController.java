package org.lhspla.redistribution.controller;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.request.PeriodeRequest;
import org.lhspla.redistribution.dto.response.PeriodeSaisieDTO;
import org.lhspla.redistribution.entity.Utilisateur;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.lhspla.redistribution.service.PeriodeService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/periodes")
@RequiredArgsConstructor
public class PeriodeController {

    private final PeriodeService periodeService;
    private final UtilisateurRepository utilisateurRepository;

    @PostMapping
    @PreAuthorize("hasRole('PHARMACIEN_REGION')")
    public ResponseEntity<PeriodeSaisieDTO> createPeriode(@RequestBody PeriodeRequest req) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Utilisateur user = utilisateurRepository.findByUsername(username).orElseThrow();
        if (user.getRegion() == null) {
            throw BusinessException.badRequest("L'utilisateur n'est associé à aucune région");
        }
        return ResponseEntity.ok(periodeService.createPeriode(req, user.getRegion().getId(), username));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'GESTIONNAIRE', 'SUPERVISEUR', 'ADMIN')")
    public ResponseEntity<List<PeriodeSaisieDTO>> getPeriodes() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Utilisateur user = utilisateurRepository.findByUsername(username).orElseThrow();
        String role = user.getRole().getName();

        if ("ADMIN".equals(role) || "SUPERVISEUR".equals(role)) {
            return ResponseEntity.ok(periodeService.findAll());
        }

        Long regionId;
        if (user.getRegion() != null) {
            regionId = user.getRegion().getId();
        } else if (user.getStructure() != null
                && user.getStructure().getDistrict() != null
                && user.getStructure().getDistrict().getRegion() != null) {
            regionId = user.getStructure().getDistrict().getRegion().getId();
        } else {
            throw BusinessException.badRequest("Impossible de déterminer la région de l'utilisateur");
        }

        return ResponseEntity.ok(periodeService.findByRegion(regionId));
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISEUR')")
    public ResponseEntity<List<PeriodeSaisieDTO>> getAllPeriodes() {
        return ResponseEntity.ok(periodeService.findAll());
    }

    @PutMapping("/{id}/rouvrir")
    @PreAuthorize("hasRole('PHARMACIEN_REGION')")
    public ResponseEntity<PeriodeSaisieDTO> rouvrirPeriode(@PathVariable Long id) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Utilisateur user = utilisateurRepository.findByUsername(username).orElseThrow();
        if (user.getRegion() == null) {
            throw BusinessException.badRequest("L'utilisateur n'est associé à aucune région");
        }
        return ResponseEntity.ok(periodeService.rouvrirPeriode(id, user.getRegion().getId()));
    }

    @PutMapping("/{id}/fermer")
    @PreAuthorize("hasRole('PHARMACIEN_REGION')")
    public ResponseEntity<PeriodeSaisieDTO> fermerPeriode(@PathVariable Long id) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Utilisateur user = utilisateurRepository.findByUsername(username).orElseThrow();
        if (user.getRegion() == null) {
            throw BusinessException.badRequest("L'utilisateur n'est associé à aucune région");
        }
        return ResponseEntity.ok(periodeService.fermerPeriode(id, user.getRegion().getId()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<Void> deletePeriode(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails user) {
        String username = user.getUsername();
        Utilisateur u = utilisateurRepository.findByUsername(username).orElseThrow();
        Long regionId = u.getRegion() != null ? u.getRegion().getId() : null;
        periodeService.deletePeriode(id, regionId);
        return ResponseEntity.noContent().build();
    }
}
