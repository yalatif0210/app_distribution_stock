package org.lhspla.redistribution.controller;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.response.*;
import org.lhspla.redistribution.service.ImportReferentielService;
import org.lhspla.redistribution.service.ReferentielService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/referentiel")
@RequiredArgsConstructor
public class ReferentielController {

    private final ReferentielService referentielService;
    private final ImportReferentielService importService;

    @GetMapping("/regions")
    public ResponseEntity<List<RegionDTO>> getRegions() {
        return ResponseEntity.ok(referentielService.findAllRegions());
    }

    @GetMapping("/districts")
    public ResponseEntity<List<DistrictDTO>> getDistricts(@RequestParam(required = false) Long regionId) {
        return ResponseEntity.ok(referentielService.findDistrictsByRegion(regionId));
    }

    @GetMapping("/structures")
    public ResponseEntity<List<StructureDTO>> getStructures(
            @RequestParam(required = false) Long regionId,
            @RequestParam(required = false) Long districtId) {
        return ResponseEntity.ok(referentielService.findStructures(regionId, districtId));
    }

    @GetMapping("/structures/{id}")
    public ResponseEntity<StructureDTO> getStructure(@PathVariable Long id) {
        return ResponseEntity.ok(referentielService.findStructureById(id));
    }

    @GetMapping("/programmes")
    public ResponseEntity<List<ProgrammeDTO>> getProgrammes() {
        return ResponseEntity.ok(referentielService.findAllProgrammes());
    }

    @GetMapping("/produits")
    public ResponseEntity<List<ProduitDTO>> getProduits(@RequestParam(required = false) Long programmeId) {
        return ResponseEntity.ok(referentielService.findProduits(programmeId));
    }

    @GetMapping("/periodes")
    public ResponseEntity<List<PeriodeSaisieDTO>> getPeriodes() {
        return ResponseEntity.ok(referentielService.findAllPeriodes());
    }

    // ─── RÉGIONS ─────────────────────────────────────────────────────────────────
    @PostMapping("/regions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RegionDTO> createRegion(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(referentielService.saveRegion(body.get("nom"), null));
    }

    @PutMapping("/regions/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RegionDTO> updateRegion(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(referentielService.saveRegion(body.get("nom"), id));
    }

    @DeleteMapping("/regions/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteRegion(@PathVariable Long id) {
        referentielService.deleteRegion(id);
        return ResponseEntity.noContent().build();
    }

    // ─── DISTRICTS ───────────────────────────────────────────────────────────────
    @PostMapping("/districts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DistrictDTO> createDistrict(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(referentielService.saveDistrict(
            (String) body.get("nom"), ((Number) body.get("regionId")).longValue(), null));
    }

    @PutMapping("/districts/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DistrictDTO> updateDistrict(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(referentielService.saveDistrict(
            (String) body.get("nom"), ((Number) body.get("regionId")).longValue(), id));
    }

    @DeleteMapping("/districts/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteDistrict(@PathVariable Long id) {
        referentielService.deleteDistrict(id);
        return ResponseEntity.noContent().build();
    }

    // ─── STRUCTURES ──────────────────────────────────────────────────────────────
    @PostMapping("/structures")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StructureDTO> createStructure(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(referentielService.saveStructure(
            (String) body.get("code"), (String) body.get("nom"), (String) body.get("type"),
            ((Number) body.get("districtId")).longValue(), null, null));
    }

    @PutMapping("/structures/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StructureDTO> updateStructure(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Boolean active = body.get("active") != null ? (Boolean) body.get("active") : true;
        return ResponseEntity.ok(referentielService.saveStructure(
            (String) body.get("code"), (String) body.get("nom"), (String) body.get("type"),
            ((Number) body.get("districtId")).longValue(), active, id));
    }

    @DeleteMapping("/structures/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteStructure(@PathVariable Long id) {
        referentielService.deleteStructure(id);
        return ResponseEntity.noContent().build();
    }

    // ─── PROGRAMMES ──────────────────────────────────────────────────────────────
    @PostMapping("/programmes")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProgrammeDTO> createProgramme(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(referentielService.saveProgramme(
            (String) body.get("code"), (String) body.get("nom"), (String) body.get("description"), null, null));
    }

    @PutMapping("/programmes/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProgrammeDTO> updateProgramme(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Boolean active = body.get("active") != null ? (Boolean) body.get("active") : true;
        return ResponseEntity.ok(referentielService.saveProgramme(
            (String) body.get("code"), (String) body.get("nom"), (String) body.get("description"), active, id));
    }

    @DeleteMapping("/programmes/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteProgramme(@PathVariable Long id) {
        referentielService.deleteProgramme(id);
        return ResponseEntity.noContent().build();
    }

    // ─── PRODUITS ─────────────────────────────────────────────────────────────────
    @PostMapping("/produits")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProduitDTO> createProduit(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(referentielService.saveProduit(
            (String) body.get("code"), (String) body.get("nom"), (String) body.get("unite"),
            ((Number) body.get("programmeId")).longValue(), null, null));
    }

    @PutMapping("/produits/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProduitDTO> updateProduit(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Boolean actif = body.get("actif") != null ? (Boolean) body.get("actif") : true;
        return ResponseEntity.ok(referentielService.saveProduit(
            (String) body.get("code"), (String) body.get("nom"), (String) body.get("unite"),
            ((Number) body.get("programmeId")).longValue(), actif, id));
    }

    @DeleteMapping("/produits/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteProduit(@PathVariable Long id) {
        referentielService.deleteProduit(id);
        return ResponseEntity.noContent().build();
    }

    // ─── IMPORT EXCEL ─────────────────────────────────────────────────────────────

    @PostMapping("/import/geo")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ImportResultDTO> importGeo(@RequestParam("file") MultipartFile file) {
        var result = importService.importGeo(file);
        return ResponseEntity.ok(new ImportResultDTO(result.created(), result.updated(), result.errors(), result.messages()));
    }

    @PostMapping("/import/catalogue")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ImportResultDTO> importCatalogue(@RequestParam("file") MultipartFile file) {
        var result = importService.importCatalogue(file);
        return ResponseEntity.ok(new ImportResultDTO(result.created(), result.updated(), result.errors(), result.messages()));
    }
}
