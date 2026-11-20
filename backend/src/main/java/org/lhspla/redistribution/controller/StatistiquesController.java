package org.lhspla.redistribution.controller;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.response.DelaisDTO;
import org.lhspla.redistribution.dto.response.StatistiquesDTO;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.security.Perimetre;
import org.lhspla.redistribution.security.PerimetreService;
import org.lhspla.redistribution.service.StatistiquesExportService;
import org.lhspla.redistribution.service.StatistiquesService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Set;

/**
 * Statistiques des plans de redéploiement validés sur une plage de dates.
 * Niveau : la région demandée, sinon tout le périmètre de l'utilisateur
 * (sa région pour le pharmacien, ses régions pour le superviseur, le niveau national pour l'admin).
 */
@RestController
@RequestMapping("/api/statistiques")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'SUPERVISEUR', 'ADMIN')")
public class StatistiquesController {

    private final StatistiquesService statistiquesService;
    private final StatistiquesExportService exportService;
    private final PerimetreService perimetreService;

    @GetMapping
    public ResponseEntity<StatistiquesDTO> statistiques(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate debut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fin,
            @RequestParam(required = false) Long regionId,
            @RequestParam(required = false) Long programmeId) {
        return ResponseEntity.ok(calculer(debut, fin, regionId, programmeId));
    }

    /**
     * Délais d'exécution des plans validés dans l'année, comparés entre les régions du
     * périmètre, avec une ligne de référence pour l'ensemble des régions.
     */
    @GetMapping("/delais")
    public ResponseEntity<DelaisDTO> delais(
            @RequestParam int annee,
            @RequestParam(required = false) Long programmeId) {
        if (annee < 2000 || annee > 2100) throw BusinessException.badRequest("Année invalide.");
        return ResponseEntity.ok(statistiquesService.delais(annee, perimetreService.courant().regionsVisibles(), programmeId));
    }

    @GetMapping("/export/excel")
    public ResponseEntity<byte[]> excel(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate debut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fin,
            @RequestParam(required = false) Long regionId,
            @RequestParam(required = false) Long programmeId) {
        StatistiquesDTO d = calculer(debut, fin, regionId, programmeId);
        return fichier(exportService.excel(d), nom(debut, fin, "xlsx"),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }

    @GetMapping("/export/pdf")
    public ResponseEntity<byte[]> pdf(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate debut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fin,
            @RequestParam(required = false) Long regionId,
            @RequestParam(required = false) Long programmeId) {
        StatistiquesDTO d = calculer(debut, fin, regionId, programmeId);
        return fichier(exportService.pdf(d), nom(debut, fin, "pdf"), MediaType.APPLICATION_PDF_VALUE);
    }

    private StatistiquesDTO calculer(LocalDate debut, LocalDate fin, Long regionId, Long programmeId) {
        Perimetre p = perimetreService.courant();
        Set<Long> regions;
        if (regionId != null) {
            p.exigerRegion(regionId);
            regions = Set.of(regionId);
        } else {
            regions = p.regionsVisibles();   // null : national (admin)
        }
        return statistiquesService.calculer(debut, fin, regions, programmeId);
    }

    private static String nom(LocalDate debut, LocalDate fin, String extension) {
        DateTimeFormatter f = DateTimeFormatter.BASIC_ISO_DATE;
        return "statistiques_plans_" + debut.format(f) + "_" + fin.format(f) + "." + extension;
    }

    private static ResponseEntity<byte[]> fichier(byte[] contenu, String nom, String type) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nom + "\"")
                .contentType(MediaType.parseMediaType(type))
                .body(contenu);
    }
}
