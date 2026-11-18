package org.lhspla.redistribution.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.request.LigneSaisieRequest;
import org.lhspla.redistribution.dto.request.SaisieStockRequest;
import org.lhspla.redistribution.dto.response.AnalyseResultatDTO;
import org.lhspla.redistribution.dto.response.EtatStockDTO;
import org.lhspla.redistribution.dto.response.EtatStockSummaryDTO;
import org.lhspla.redistribution.dto.response.ImportResultatDTO;
import org.lhspla.redistribution.dto.response.LigneSaisieDTO;
import org.lhspla.redistribution.dto.response.SaisieStockDTO;
import org.lhspla.redistribution.entity.Utilisateur;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.lhspla.redistribution.service.AnalyseStockService;
import org.lhspla.redistribution.service.ImportExcelService;
import org.lhspla.redistribution.service.StockService;
import org.lhspla.redistribution.security.Perimetre;
import org.lhspla.redistribution.security.PerimetreService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/stocks")
@RequiredArgsConstructor
public class StockController {

    private final StockService stockService;
    private final ImportExcelService importExcelService;
    private final AnalyseStockService analyseStockService;
    private final UtilisateurRepository utilisateurRepository;
    private final PerimetreService perimetreService;

    // ─── Workflow état SUGGESTED / SUBMITTED ─────────────────────────────────

    @GetMapping("/etat")
    public ResponseEntity<EtatStockDTO> getEtat(
            @RequestParam Long periodeId,
            @RequestParam Long programmeId,
            @RequestParam Long structureId,
            @AuthenticationPrincipal UserDetails user) {
        // Gestionnaire : sa structure ; pharmacien / superviseur : les sites de leurs régions
        perimetreService.exigerStructure(structureId);
        return ResponseEntity.ok(stockService.getEtat(periodeId, programmeId, structureId));
    }

    @PostMapping("/etat/init")
    @PreAuthorize("hasRole('GESTIONNAIRE')")
    public ResponseEntity<EtatStockDTO> initEtat(
            @RequestParam Long periodeId,
            @RequestParam Long programmeId,
            @RequestParam Long structureId,
            @AuthenticationPrincipal UserDetails user) {
        perimetreService.exigerStructure(structureId);
        return ResponseEntity.ok(stockService.getOrCreateEtat(periodeId, programmeId, structureId, user.getUsername()));
    }

    @PostMapping("/etat/ligne")
    @PreAuthorize("hasRole('GESTIONNAIRE')")
    public ResponseEntity<LigneSaisieDTO> saveLigne(
            @RequestBody LigneSaisieRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(stockService.saveLigne(req, user.getUsername()));
    }

    @PostMapping("/etat/{etatId}/submit")
    @PreAuthorize("hasRole('GESTIONNAIRE')")
    public ResponseEntity<EtatStockDTO> submitEtat(
            @PathVariable Long etatId,
            @AuthenticationPrincipal UserDetails user) {
        perimetreService.exigerStructure(stockService.structureDeLEtat(etatId));
        return ResponseEntity.ok(stockService.submitEtat(etatId, user.getUsername()));
    }

    @PostMapping("/etat/{etatId}/reopen")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<EtatStockDTO> reopenEtat(
            @PathVariable Long etatId,
            @AuthenticationPrincipal UserDetails user) {
        perimetreService.exigerStructure(stockService.structureDeLEtat(etatId));
        return ResponseEntity.ok(stockService.reopenEtat(etatId, user.getUsername()));
    }

    // ─── Tableau de bord / lecture ────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<SaisieStockDTO>> getSaisies(
            @RequestParam Long periodeId,
            @RequestParam(required = false) Long programmeId,
            @AuthenticationPrincipal UserDetails user) {
        Perimetre p = perimetreService.courant();
        if (p.estGestionnaire()) {
            if (p.structureId() == null) return ResponseEntity.ok(List.of());
            return ResponseEntity.ok(stockService.findSaisies(periodeId, programmeId, p.structureId()));
        }
        List<SaisieStockDTO> saisies = stockService.findSaisies(periodeId, programmeId, null);
        Set<Long> regions = p.regionsVisibles();
        if (regions == null) return ResponseEntity.ok(saisies);
        return ResponseEntity.ok(saisies.stream()
                .filter(s -> s.getStructureRegionId() != null && regions.contains(s.getStructureRegionId()))
                .toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SaisieStockDTO> getSaisie(@PathVariable Long id) {
        SaisieStockDTO saisie = stockService.findById(id);
        perimetreService.exigerStructure(saisie.getStructureId());
        return ResponseEntity.ok(saisie);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('GESTIONNAIRE')")
    public ResponseEntity<SaisieStockDTO> modifier(
            @PathVariable Long id,
            @Valid @RequestBody SaisieStockRequest req,
            @AuthenticationPrincipal UserDetails user) {
        perimetreService.exigerStructure(stockService.findById(id).getStructureId());
        return ResponseEntity.ok(stockService.modifier(id, req, user.getUsername()));
    }

    @GetMapping("/import/template")
    @PreAuthorize("hasRole('GESTIONNAIRE')")
    public ResponseEntity<byte[]> downloadTemplate(
            @RequestParam Long programmeId,
            @AuthenticationPrincipal UserDetails user) {
        Long structureId = utilisateurRepository.findByUsername(user.getUsername())
                .map(u -> u.getStructure() != null ? u.getStructure().getId() : null)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        byte[] content = importExcelService.generateTemplate(structureId, programmeId);
        String nom = "gabarit_stocks_" + importExcelService.codeFichier(structureId, programmeId) + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nom + "\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(content);
    }

    @PostMapping("/import")
    @PreAuthorize("hasRole('GESTIONNAIRE')")
    public ResponseEntity<ImportResultatDTO> importExcel(
            @RequestParam("file") MultipartFile file,
            @RequestParam Long periodeId,
            @RequestParam Long programmeId,
            @AuthenticationPrincipal UserDetails user) {
        Long structureId = utilisateurRepository.findByUsername(user.getUsername())
                .map(u -> u.getStructure() != null ? u.getStructure().getId() : null)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        return ResponseEntity.ok(importExcelService.parseExcel(file, periodeId, programmeId, structureId, user.getUsername()));
    }

    @GetMapping("/analyse")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'SUPERVISEUR', 'ADMIN')")
    public ResponseEntity<AnalyseResultatDTO> analyser(
            @RequestParam Long periodeId,
            @RequestParam Long programmeId,
            @RequestParam(required = false) Long regionId) {
        Long resolvedRegionId = resolveRegionId(regionId);
        return ResponseEntity.ok(analyseStockService.analyserStocks(periodeId, programmeId, resolvedRegionId));
    }

    private Long resolveRegionId(Long provided) {
        return perimetreService.courant().resoudreRegion(provided);
    }

    @GetMapping("/etats")
    public ResponseEntity<List<EtatStockSummaryDTO>> listEtats(
            @RequestParam Long periodeId,
            @RequestParam(required = false) Long programmeId,
            @RequestParam(required = false) Long regionId,
            @AuthenticationPrincipal UserDetails user) {
        Perimetre p = perimetreService.courant();
        if (p.estGestionnaire()) {
            // Un gestionnaire ne voit que ses propres états
            if (p.structureId() == null) return ResponseEntity.ok(List.of());
            return ResponseEntity.ok(stockService.listEtats(periodeId, programmeId, null, p.structureId()));
        }
        // Pharmacien : tous les sites de sa région ; superviseur : une de ses régions ; ADMIN : null = toutes
        Long resolvedRegionId = p.resoudreRegion(regionId);
        return ResponseEntity.ok(stockService.listEtats(periodeId, programmeId, resolvedRegionId, null));
    }

    @DeleteMapping("/etat/{etatId}")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<Void> deleteEtat(
            @PathVariable Long etatId,
            @AuthenticationPrincipal UserDetails user) {
        perimetreService.exigerStructure(stockService.structureDeLEtat(etatId));
        stockService.deleteEtat(etatId, user.getUsername());
        return ResponseEntity.noContent().build();
    }
}
