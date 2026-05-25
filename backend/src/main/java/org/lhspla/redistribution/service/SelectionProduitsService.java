package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.response.ProduitSelectionDTO;
import org.lhspla.redistribution.dto.response.ProgrammeDTO;
import org.lhspla.redistribution.entity.*;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SelectionProduitsService {

    private final StructureProgrammeRepository strProgRepo;
    private final StructureProgrammeProduitRepository selectionRepo;
    private final ProduitRepository produitRepo;
    private final StructureRepository structureRepo;
    private final ProgrammeRepository programmeRepo;

    public List<ProgrammeDTO> getProgrammesActifs(Long structureId) {
        return strProgRepo.findByStructureId(structureId).stream()
            .filter(sp -> Boolean.TRUE.equals(sp.getActif()))
            .map(sp -> toProgrammeDTO(sp.getProgramme()))
            .sorted(Comparator.comparing(ProgrammeDTO::getNom))
            .toList();
    }

    public List<ProduitSelectionDTO> getSelection(Long structureId, Long programmeId) {
        List<Produit> produits = produitRepo.findByProgrammeId(programmeId).stream()
            .filter(p -> Boolean.TRUE.equals(p.getActif()))
            .sorted(Comparator.comparing(Produit::getNom))
            .toList();

        Map<Long, Boolean> selectionMap = selectionRepo
            .findByStructureIdAndProgrammeId(structureId, programmeId)
            .stream()
            .collect(Collectors.toMap(r -> r.getProduit().getId(), StructureProgrammeProduit::getActif));

        return produits.stream().map(p -> {
            ProduitSelectionDTO dto = new ProduitSelectionDTO();
            dto.setProduitId(p.getId());
            dto.setProduitCode(p.getCode());
            dto.setProduitNom(p.getNom());
            dto.setProduitUnite(p.getUnite());
            dto.setActif(selectionMap.getOrDefault(p.getId(), false));
            return dto;
        }).toList();
    }

    @Transactional
    public ProduitSelectionDTO toggleProduit(Long structureId, Long programmeId, Long produitId, Boolean actif) {
        Structure structure = structureRepo.findById(structureId)
            .orElseThrow(() -> BusinessException.notFound("Structure", structureId));
        Programme programme = programmeRepo.findById(programmeId)
            .orElseThrow(() -> BusinessException.notFound("Programme", programmeId));
        Produit produit = produitRepo.findById(produitId)
            .orElseThrow(() -> BusinessException.notFound("Produit", produitId));

        StructureProgrammeProduit row = selectionRepo
            .findByStructureIdAndProduitId(structureId, produitId)
            .orElse(new StructureProgrammeProduit());
        row.setStructure(structure);
        row.setProgramme(programme);
        row.setProduit(produit);
        row.setActif(actif);
        row.setUpdatedAt(LocalDateTime.now());
        selectionRepo.save(row);

        ProduitSelectionDTO dto = new ProduitSelectionDTO();
        dto.setProduitId(produitId);
        dto.setProduitCode(produit.getCode());
        dto.setProduitNom(produit.getNom());
        dto.setProduitUnite(produit.getUnite());
        dto.setActif(actif);
        return dto;
    }

    private ProgrammeDTO toProgrammeDTO(Programme p) {
        ProgrammeDTO dto = new ProgrammeDTO();
        dto.setId(p.getId());
        dto.setCode(p.getCode());
        dto.setNom(p.getNom());
        dto.setDescription(p.getDescription());
        dto.setActive(p.getActive());
        return dto;
    }
}
