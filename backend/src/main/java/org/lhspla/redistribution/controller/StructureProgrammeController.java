package org.lhspla.redistribution.controller;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.request.StructureProgrammeRequest;
import org.lhspla.redistribution.dto.response.StructureProgrammeDTO;
import org.lhspla.redistribution.entity.Programme;
import org.lhspla.redistribution.entity.Structure;
import org.lhspla.redistribution.entity.StructureProgramme;
import org.lhspla.redistribution.entity.Utilisateur;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.ProgrammeRepository;
import org.lhspla.redistribution.repository.StructureProgrammeRepository;
import org.lhspla.redistribution.repository.StructureRepository;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/structure-programme")
@RequiredArgsConstructor
public class StructureProgrammeController {

    private final StructureProgrammeRepository structureProgrammeRepo;
    private final StructureRepository structureRepo;
    private final ProgrammeRepository programmeRepo;
    private final UtilisateurRepository utilisateurRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<List<StructureProgrammeDTO>> getByRegion(
            @RequestParam(required = false) Long regionId) {
        Long resolvedRegionId = resolveRegionId(regionId);
        List<StructureProgramme> liaisons = structureProgrammeRepo.findAllByRegion(resolvedRegionId);
        List<StructureProgrammeDTO> result = liaisons.stream()
                .map(this::toDTO)
                .toList();
        return ResponseEntity.ok(result);
    }

    private Long resolveRegionId(Long provided) {
        if (provided != null) return provided;
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return utilisateurRepository.findByUsername(username)
                .map(u -> u.getRegion() != null ? u.getRegion().getId() : null)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
    }

    @PostMapping
    @PreAuthorize("hasRole('PHARMACIEN_REGION')")
    @Transactional
    public ResponseEntity<StructureProgrammeDTO> activerLiaison(@RequestBody StructureProgrammeRequest req) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Utilisateur user = utilisateurRepository.findByUsername(username).orElseThrow();

        Structure structure = structureRepo.findById(req.getStructureId())
                .orElseThrow(() -> BusinessException.notFound("Structure", req.getStructureId()));
        Programme programme = programmeRepo.findById(req.getProgrammeId())
                .orElseThrow(() -> BusinessException.notFound("Programme", req.getProgrammeId()));

        Optional<StructureProgramme> existante = structureProgrammeRepo
                .findByStructureIdAndProgrammeId(req.getStructureId(), req.getProgrammeId());

        StructureProgramme liaison;
        if (existante.isPresent()) {
            liaison = existante.get();
            liaison.setActif(true);
            liaison.setConfigurePar(user);
        } else {
            liaison = new StructureProgramme();
            liaison.setStructure(structure);
            liaison.setProgramme(programme);
            liaison.setActif(req.getActif() != null ? req.getActif() : true);
            liaison.setConfigurePar(user);
        }

        return ResponseEntity.ok(toDTO(structureProgrammeRepo.save(liaison)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('PHARMACIEN_REGION')")
    @Transactional
    public ResponseEntity<StructureProgrammeDTO> modifierLiaison(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        StructureProgramme liaison = structureProgrammeRepo.findById(id)
                .orElseThrow(() -> BusinessException.notFound("StructureProgramme", id));

        Boolean actif = body.get("actif");
        if (actif != null) {
            liaison.setActif(actif);
        }

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Utilisateur user = utilisateurRepository.findByUsername(username).orElseThrow();
        liaison.setConfigurePar(user);

        return ResponseEntity.ok(toDTO(structureProgrammeRepo.save(liaison)));
    }

    private StructureProgrammeDTO toDTO(StructureProgramme sp) {
        StructureProgrammeDTO dto = new StructureProgrammeDTO();
        dto.setId(sp.getId());
        dto.setActif(sp.getActif());
        if (sp.getStructure() != null) {
            dto.setStructureId(sp.getStructure().getId());
            dto.setStructureCode(sp.getStructure().getCode());
            dto.setStructureNom(sp.getStructure().getNom());
            dto.setStructureType(sp.getStructure().getType());
        }
        if (sp.getProgramme() != null) {
            dto.setProgrammeId(sp.getProgramme().getId());
            dto.setProgrammeCode(sp.getProgramme().getCode());
            dto.setProgrammeNom(sp.getProgramme().getNom());
        }
        return dto;
    }
}
