package org.lhspla.redistribution.controller;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.request.ToggleSelectionRequest;
import org.lhspla.redistribution.dto.response.ProduitSelectionDTO;
import org.lhspla.redistribution.dto.response.ProgrammeDTO;
import org.lhspla.redistribution.service.SelectionProduitsService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Produits gérés par une structure. Lecture : selon le périmètre. Écriture :
 * gestionnaire (sa structure), pharmacien (sites de sa région), admin.
 */
@RestController
@RequestMapping("/api/selection-produits")
@RequiredArgsConstructor
public class SelectionProduitsController {

    private final SelectionProduitsService selectionService;
    private final org.lhspla.redistribution.security.PerimetreService perimetreService;

    @GetMapping("/programmes")
    public List<ProgrammeDTO> getProgrammesActifs(@RequestParam Long structureId) {
        perimetreService.exigerStructure(structureId);
        return selectionService.getProgrammesActifs(structureId);
    }

    @GetMapping
    public List<ProduitSelectionDTO> getSelection(
            @RequestParam Long structureId,
            @RequestParam Long programmeId) {
        perimetreService.exigerStructure(structureId);
        return selectionService.getSelection(structureId, programmeId);
    }

    @PutMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('GESTIONNAIRE', 'PHARMACIEN_REGION', 'ADMIN')")
    public ProduitSelectionDTO toggle(@RequestBody ToggleSelectionRequest req) {
        perimetreService.exigerStructure(req.getStructureId());
        return selectionService.toggleProduit(
            req.getStructureId(), req.getProgrammeId(), req.getProduitId(), req.getActif());
    }
}
