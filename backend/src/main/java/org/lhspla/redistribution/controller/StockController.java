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

@RestController
@RequestMapping("/api/stocks")
@RequiredArgsConstructor
public class StockController {

    private final StockService stockService;
    private final ImportExcelService importExcelService;
    private final AnalyseStockService analyseStockService;
    private final UtilisateurRepository utilisateurRepository;

    // ─── Workflow état SUGGESTED / SUBMITTED ─────────────────────────────────

    @GetMapping("/etat")
    public ResponseEntity<EtatStockDTO> getEtat(
            @RequestParam Long periodeId,
            @RequestParam Long programmeId,
            @RequestParam Long structureId,
            @AuthenticationPrincipal UserDetails user) {
        if (user != null) {
            Utilisateur u = utilisateurRepository.findByUsername(user.getUsername())
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
            if ("GESTIONNAIRE".equals(u.getRole().getName())) {
                Long myStructureId = u.getStructure() != null ? u.getStructure().getId() : null;
                if (!structureId.equals(myStructureId)) {
                    throw new org.springframework.security.access.AccessDeniedException(
                            "Accès refusé : vous ne pouvez consulter que l'état de stock de votre propre structure.");
                }
            }
        }
        return ResponseEntity.ok(stockService.getEtat(periodeId, programmeId, structureId));
    }

    @PostMapping("/etat/init")
    @PreAuthorize("hasRole('GESTIONNAIRE')")
    public ResponseEntity<EtatStockDTO> initEtat(
            @RequestParam Long periodeId,
            @RequestParam Long programmeId,
            @RequestParam Long structureId,
            @AuthenticationPrincipal UserDetails user) {
        Utilisateur u = utilisateurRepository.findByUsername(user.getUsername())
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        Long myStructureId = u.getStructure() != null ? u.getStructure().getId() : null;
        if (!structureId.equals(myStructureId)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Accès refusé : vous ne pouvez initialiser que l'état de stock de votre propre structure.");
        }
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
        return ResponseEntity.ok(stockService.submitEtat(etatId, user.getUsername()));
    }

    @PostMapping("/etat/{etatId}/reopen")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<EtatStockDTO> reopenEtat(
            @PathVariable Long etatId,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(stockService.reopenEtat(etatId, user.getUsername()));
    }

    // ─── Tableau de bord / lecture ────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<SaisieStockDTO>> getSaisies(
            @RequestParam Long periodeId,
            @RequestParam(required = false) Long programmeId,
            @AuthenticationPrincipal UserDetails user) {
        Long structureId = null;
        if (user != null) {
            Utilisateur u = utilisateurRepository.findByUsername(user.getUsername())
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
            if ("GESTIONNAIRE".equals(u.getRole().getName())) {
                structureId = u.getStructure() != null ? u.getStructure().getId() : null;
            }
        }
        return ResponseEntity.ok(stockService.findSaisies(periodeId, programmeId, structureId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SaisieStockDTO> getSaisie(@PathVariable Long id) {
        return ResponseEntity.ok(stockService.findById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SaisieStockDTO> modifier(
            @PathVariable Long id,
            @Valid @RequestBody SaisieStockRequest req,
            @AuthenticationPrincipal UserDetails user) {
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
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=template_stocks.xlsx")
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
    public ResponseEntity<AnalyseResultatDTO> analyser(
            @RequestParam Long periodeId,
            @RequestParam Long programmeId,
            @RequestParam(required = false) Long regionId) {
        Long resolvedRegionId = resolveRegionId(regionId);
        return ResponseEntity.ok(analyseStockService.analyserStocks(periodeId, programmeId, resolvedRegionId));
    }

    private Long resolveRegionId(Long provided) {
        if (provided != null) return provided;
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return utilisateurRepository.findByUsername(username)
                .map(u -> u.getRegion() != null ? u.getRegion().getId() : null)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
    }

    @GetMapping("/etats")
    public ResponseEntity<List<EtatStockSummaryDTO>> listEtats(
            @RequestParam Long periodeId,
            @RequestParam(required = false) Long programmeId,
            @RequestParam(required = false) Long regionId,
            @AuthenticationPrincipal UserDetails user) {
        Utilisateur u = utilisateurRepository.findByUsername(user.getUsername())
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        String role = u.getRole().getName();

        if ("GESTIONNAIRE".equals(role)) {
            // Un gestionnaire ne voit que ses propres états
            Long structureId = u.getStructure() != null ? u.getStructure().getId() : null;
            return ResponseEntity.ok(stockService.listEtats(periodeId, programmeId, null, structureId));
        }

        // PHARMACIEN_REGION, SUPERVISEUR, ADMIN : filtrage par région ou tout voir
        Long resolvedRegionId;
        if (regionId != null) {
            resolvedRegionId = regionId;
        } else if (u.getRegion() != null) {
            resolvedRegionId = u.getRegion().getId();
        } else if (u.getStructure() != null && u.getStructure().getDistrict() != null
                && u.getStructure().getDistrict().getRegion() != null) {
            resolvedRegionId = u.getStructure().getDistrict().getRegion().getId();
        } else {
            resolvedRegionId = null; // ADMIN → toutes les régions
        }
        return ResponseEntity.ok(stockService.listEtats(periodeId, programmeId, resolvedRegionId, null));
    }

    @DeleteMapping("/etat/{etatId}")
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<Void> deleteEtat(
            @PathVariable Long etatId,
            @AuthenticationPrincipal UserDetails user) {
        stockService.deleteEtat(etatId, user.getUsername());
        return ResponseEntity.noContent().build();
    }
}
