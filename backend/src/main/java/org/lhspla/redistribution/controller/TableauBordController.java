package org.lhspla.redistribution.controller;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.response.TableauBordDTO;
import org.lhspla.redistribution.entity.Utilisateur;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.lhspla.redistribution.service.TableauBordService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tableau-bord")
@RequiredArgsConstructor
public class TableauBordController {

    private final TableauBordService tableauBordService;
    private final UtilisateurRepository utilisateurRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<TableauBordDTO> getTableauBord(
            @RequestParam Long periodeId,
            @RequestParam Long programmeId,
            @RequestParam(required = false) Long regionId,
            @RequestParam Long planId) {

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Utilisateur user = utilisateurRepository.findByUsername(username).orElseThrow();

        Long resolvedRegionId = regionId;

        boolean isAdmin = user.getRole() != null && "ADMIN".equals(user.getRole().getName());

        if (isAdmin) {
            if (resolvedRegionId == null) {
                throw BusinessException.badRequest("Le paramètre regionId est obligatoire pour un ADMIN");
            }
        } else {
            // PHARMACIEN_REGION: utiliser sa propre région si regionId absent
            if (resolvedRegionId == null) {
                if (user.getRegion() == null) {
                    throw BusinessException.badRequest("L'utilisateur n'est associé à aucune région");
                }
                resolvedRegionId = user.getRegion().getId();
            }
        }

        return ResponseEntity.ok(tableauBordService.calculer(periodeId, programmeId, resolvedRegionId, planId));
    }
}
