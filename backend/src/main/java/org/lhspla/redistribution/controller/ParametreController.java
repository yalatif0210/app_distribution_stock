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
import org.lhspla.redistribution.security.PerimetreService;
import org.lhspla.redistribution.service.SeuilsStatutService;
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
    private final PerimetreService perimetreService;
    private final SeuilsStatutService seuilsStatutService;

    /** Seuils de MSD des statuts de stock. Lisibles par tous : les vues s'en servent pour les couleurs. */
    @GetMapping("/statuts")
    public ResponseEntity<SeuilsStatutService.Seuils> getSeuilsStatut() {
        return ResponseEntity.ok(seuilsStatutService.seuils());
    }

    @PutMapping("/statuts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SeuilsStatutService.Seuils> updateSeuilsStatut(@RequestBody SeuilsStatutService.Seuils req) {
        return ResponseEntity.ok(seuilsStatutService.modifier(req.tension(), req.surveiller(), req.surstock()));
    }

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
        // Un pharmacien ne lit ni ne modifie que les paramètres de sa région
        final Long regionId = perimetreService.courant().regionObligatoire(requestedRegionId);

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
