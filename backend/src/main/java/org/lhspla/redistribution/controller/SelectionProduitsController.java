package org.lhspla.redistribution.controller;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.request.ToggleSelectionRequest;
import org.lhspla.redistribution.dto.response.ProduitSelectionDTO;
import org.lhspla.redistribution.dto.response.ProgrammeDTO;
import org.lhspla.redistribution.service.SelectionProduitsService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/selection-produits")
@RequiredArgsConstructor
public class SelectionProduitsController {

    private final SelectionProduitsService selectionService;

    @GetMapping("/programmes")
    public List<ProgrammeDTO> getProgrammesActifs(@RequestParam Long structureId) {
        return selectionService.getProgrammesActifs(structureId);
    }

    @GetMapping
    public List<ProduitSelectionDTO> getSelection(
            @RequestParam Long structureId,
            @RequestParam Long programmeId) {
        return selectionService.getSelection(structureId, programmeId);
    }

    @PutMapping
    public ProduitSelectionDTO toggle(@RequestBody ToggleSelectionRequest req) {
        return selectionService.toggleProduit(
            req.getStructureId(), req.getProgrammeId(), req.getProduitId(), req.getActif());
    }
}
