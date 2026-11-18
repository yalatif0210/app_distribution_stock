package org.lhspla.redistribution.controller;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.request.RelanceRequest;
import org.lhspla.redistribution.dto.response.CompletudeDTO;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.lhspla.redistribution.service.CompletudeSaisieService;
import org.lhspla.redistribution.security.PerimetreService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/completude")
@RequiredArgsConstructor
public class CompletudeController {

    private final CompletudeSaisieService completudeSaisieService;
    private final UtilisateurRepository utilisateurRepository;
    private final PerimetreService perimetreService;

    @GetMapping
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN', 'SUPERVISEUR')")
    public ResponseEntity<CompletudeDTO> getCompletude(
            @RequestParam Long periodeId,
            @RequestParam Long programmeId,
            @RequestParam(required = false) Long regionId) {
        Long resolvedRegionId = resolveRegionId(regionId);
        return ResponseEntity.ok(completudeSaisieService.getCompletude(periodeId, programmeId, resolvedRegionId));
    }

    private Long resolveRegionId(Long provided) {
        // Région demandée vérifiée ; sinon région unique du périmètre ; null = toutes (ADMIN)
        return perimetreService.courant().resoudreRegion(provided);
    }

    @PostMapping("/relancer")
    @PreAuthorize("hasRole('PHARMACIEN_REGION')")
    public ResponseEntity<Void> relancer(@RequestBody RelanceRequest req) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        if (req.getStructureIds() != null) req.getStructureIds().forEach(perimetreService::exigerStructure);
        completudeSaisieService.relancer(req, username);
        return ResponseEntity.ok().build();
    }
}
