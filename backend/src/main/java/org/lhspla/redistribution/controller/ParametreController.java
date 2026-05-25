package org.lhspla.redistribution.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.request.ParametreRegionRequest;
import org.lhspla.redistribution.dto.response.ParametreRegionDTO;
import org.lhspla.redistribution.entity.Region;
import org.lhspla.redistribution.entity.Utilisateur;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.RegionRepository;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/parametres")
@RequiredArgsConstructor
public class ParametreController {

    private final RegionRepository regionRepo;
    private final UtilisateurRepository utilisateurRepo;

    @GetMapping("/region")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<ParametreRegionDTO> getParametres(
            @RequestParam(required = false) Long regionId,
            @AuthenticationPrincipal UserDetails user) {
        Region region = resolveRegion(user.getUsername(), regionId);
        return ResponseEntity.ok(toDTO(region));
    }

    @PutMapping("/region")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<ParametreRegionDTO> updateParametres(
            @Valid @RequestBody ParametreRegionRequest req,
            @AuthenticationPrincipal UserDetails user) {
        Region region = resolveRegion(user.getUsername(), req.getRegionId());
        region.setSeuilStockSecuriteMsd(req.getSeuilStockSecuriteMsd());
        regionRepo.save(region);
        return ResponseEntity.ok(toDTO(region));
    }

    private Region resolveRegion(String username, Long requestedRegionId) {
        Utilisateur utilisateur = utilisateurRepo.findByUsername(username)
                .orElseThrow(() -> BusinessException.notFound("Utilisateur", -1L));

        final Long regionId;
        if (requestedRegionId != null) {
            regionId = requestedRegionId;
        } else {
            if (utilisateur.getRegion() == null)
                throw BusinessException.badRequest("Aucune région associée à cet utilisateur. Précisez un regionId.");
            regionId = utilisateur.getRegion().getId();
        }

        return regionRepo.findById(regionId)
                .orElseThrow(() -> BusinessException.notFound("Région", regionId));
    }

    private ParametreRegionDTO toDTO(Region region) {
        ParametreRegionDTO dto = new ParametreRegionDTO();
        dto.setRegionId(region.getId());
        dto.setRegionNom(region.getNom());
        dto.setSeuilStockSecuriteMsd(region.getSeuilStockSecuriteMsd());
        return dto;
    }
}
