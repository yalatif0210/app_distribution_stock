package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.*;
import org.lhspla.redistribution.dto.request.SaisieStockRequest;
import org.lhspla.redistribution.dto.response.ImportResultatDTO;
import org.lhspla.redistribution.dto.response.LigneErreurDTO;
import org.lhspla.redistribution.dto.response.SaisieStockDTO;
import org.lhspla.redistribution.entity.*;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImportExcelService {

    private static final String SIGNATURE_PREFIX = "programme:";
    private static final int SIG_COL = 6;

    private final ProduitRepository produitRepo;
    private final StockService stockService;
    private final StructureProgrammeProduitRepository sppRepo;
    private final ProgrammeRepository programmeRepo;

    // ─── Structure interne pour la passe de validation ────────────────────────

    private static class ParsedRow {
        int numLigne;
        String produitCode;
        Long produitId;
        BigDecimal stockDisponible;
        BigDecimal cmm;
        LocalDate expireDate;
        final List<LigneErreurDTO> erreurs = new ArrayList<>();
    }

    // ─── Génération du modèle ────────────────────────────────────────────────

    public byte[] generateTemplate(Long structureId, Long programmeId) {
        List<Produit> produits = sppRepo.findActiveProduits(structureId, programmeId);
        String programmeCode = programmeRepo.findById(programmeId)
                .map(Programme::getCode).orElse("PROG");

        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            XSSFSheet sheet = wb.createSheet("Stock " + programmeCode);

            XSSFCellStyle headerStyle = wb.createCellStyle();
            XSSFFont headerFont = wb.createFont();
            headerFont.setBold(true);
            headerFont.setColor(new XSSFColor(new byte[]{(byte) 255, (byte) 255, (byte) 255}, null));
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 79, (byte) 70, (byte) 229}, null));
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            XSSFCellStyle lockedStyle = wb.createCellStyle();
            lockedStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 241, (byte) 245, (byte) 249}, null));
            lockedStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // En-têtes (ligne 0)
            Row header = sheet.createRow(0);
            String[] headers = {"Code Produit", "Nom Produit", "Unité",
                                 "Stock Disponible", "CMM", "Date Péremption (JJ/MM/AAAA)"};
            for (int i = 0; i < headers.length; i++) {
                Cell c = header.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, i < 3 ? 5500 : 4500);
            }
            // Signature cachée (col SIG_COL)
            Cell sigCell = header.createCell(SIG_COL);
            sigCell.setCellValue(SIGNATURE_PREFIX + programmeId);
            sheet.setColumnHidden(SIG_COL, true);

            // Lignes produits pré-remplies
            int rowIdx = 1;
            for (Produit p : produits) {
                Row row = sheet.createRow(rowIdx++);
                Cell c0 = row.createCell(0); c0.setCellValue(p.getCode());   c0.setCellStyle(lockedStyle);
                Cell c1 = row.createCell(1); c1.setCellValue(p.getNom());    c1.setCellStyle(lockedStyle);
                Cell c2 = row.createCell(2); c2.setCellValue(p.getUnite());  c2.setCellStyle(lockedStyle);
                // Colonnes 3-5 vides (à remplir)
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw BusinessException.badRequest("Erreur génération modèle: " + e.getMessage());
        }
    }

    // ─── Import (deux passes : validation puis écriture) ─────────────────────

    @Transactional
    public ImportResultatDTO parseExcel(MultipartFile file, Long periodeId, Long programmeId,
                                        Long structureId, String username) {
        List<ParsedRow> allRows = new ArrayList<>();
        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            for (int i = 0; i < wb.getNumberOfSheets(); i++) {
                Sheet sheet = wb.getSheetAt(i);
                validateTemplateSignature(sheet, programmeId);
                allRows.addAll(parseAndValidate(sheet));
            }
        } catch (IOException e) {
            throw BusinessException.badRequest("Impossible de lire le fichier Excel: " + e.getMessage());
        }

        // Collecte de toutes les erreurs (toutes feuilles confondues)
        List<LigneErreurDTO> allErrors = allRows.stream()
                .flatMap(r -> r.erreurs.stream())
                .toList();

        if (!allErrors.isEmpty()) {
            return new ImportResultatDTO(false, 0, allErrors, List.of());
        }

        // Aucune erreur → import atomique
        List<SaisieStockDTO> importes = new ArrayList<>();
        for (ParsedRow row : allRows) {
            SaisieStockRequest req = new SaisieStockRequest();
            req.setPeriodeId(periodeId);
            req.setStructureId(structureId);
            req.setProduitId(row.produitId);
            req.setStockDisponible(row.stockDisponible);
            req.setCmm(row.cmm);
            req.setExpireDate(row.expireDate);
            SaisieStockDTO dto = stockService.saisir(req, username);
            dto.setSource("EXCEL");
            importes.add(dto);
        }
        return new ImportResultatDTO(true, importes.size(), List.of(), importes);
    }

    // ─── Passe 1 : lecture + validation (aucune écriture BD) ─────────────────

    private List<ParsedRow> parseAndValidate(Sheet sheet) {
        List<ParsedRow> rows = new ArrayList<>();
        int rowNum = 0;
        for (Row row : sheet) {
            rowNum++;
            if (rowNum == 1) continue; // en-têtes
            if (isRowEmpty(row)) continue;

            ParsedRow parsed = new ParsedRow();
            parsed.numLigne = rowNum;
            parsed.produitCode = getCellString(row, 0);
            parsed.stockDisponible = getCellBigDecimal(row, 3);
            parsed.cmm = getCellBigDecimal(row, 4);
            parsed.expireDate = getCellDate(row, 5);

            // Ligne sans code produit ni stock → ignorer silencieusement
            if (parsed.produitCode == null && parsed.stockDisponible == null) continue;

            // Code produit obligatoire
            if (parsed.produitCode == null) {
                parsed.erreurs.add(new LigneErreurDTO(rowNum, "",
                        "Code produit manquant", "Colonne A vide"));
                rows.add(parsed);
                continue;
            }

            // Stock obligatoire (sinon ligne sans sens)
            if (parsed.stockDisponible == null) {
                parsed.erreurs.add(new LigneErreurDTO(rowNum, parsed.produitCode,
                        "Stock disponible manquant", "Colonne D vide"));
                rows.add(parsed);
                continue;
            }

            // Produit doit exister en base
            Optional<Produit> produitOpt = produitRepo.findByCode(parsed.produitCode);
            if (produitOpt.isEmpty()) {
                parsed.erreurs.add(new LigneErreurDTO(rowNum, parsed.produitCode,
                        "Produit introuvable", "Code: " + parsed.produitCode));
                rows.add(parsed);
                continue;
            }
            parsed.produitId = produitOpt.get().getId();

            // Date de péremption obligatoire si stock > 0
            if (parsed.stockDisponible.compareTo(BigDecimal.ZERO) > 0 && parsed.expireDate == null) {
                parsed.erreurs.add(new LigneErreurDTO(rowNum, parsed.produitCode,
                        "Date de péremption obligatoire si stock > 0",
                        "Stock: " + parsed.stockDisponible + " — Date péremption: non renseignée"));
            }

            // Date de péremption doit être postérieure à la date de saisie (= date système)
            LocalDate dateSaisie = LocalDate.now();
            if (parsed.expireDate != null && !parsed.expireDate.isAfter(dateSaisie)) {
                parsed.erreurs.add(new LigneErreurDTO(rowNum, parsed.produitCode,
                        "La date de péremption doit être postérieure à la date de saisie",
                        "Date péremption: " + parsed.expireDate + " — Date de saisie: " + dateSaisie));
            }

            rows.add(parsed);
        }
        return rows;
    }

    // ─── Signature du modèle ─────────────────────────────────────────────────

    private void validateTemplateSignature(Sheet sheet, Long programmeId) {
        Row header = sheet.getRow(0);
        if (header == null) throw BusinessException.badRequest(
                "Fichier non conforme — utilisez le modèle téléchargé pour ce programme.");
        Cell sigCell = header.getCell(SIG_COL);
        String sig = sigCell != null ? getCellStringRaw(sigCell) : null;
        if (sig == null || !sig.startsWith(SIGNATURE_PREFIX)) {
            throw BusinessException.badRequest(
                    "Fichier non conforme — utilisez le modèle téléchargé pour ce programme.");
        }
        try {
            long fileProgrammeId = Long.parseLong(sig.substring(SIGNATURE_PREFIX.length()));
            if (fileProgrammeId != programmeId) {
                throw BusinessException.badRequest(
                        "Le fichier ne correspond pas au programme sélectionné.");
            }
        } catch (NumberFormatException e) {
            throw BusinessException.badRequest("Fichier non conforme — signature invalide.");
        }
    }

    // ─── Helpers de lecture cellule ───────────────────────────────────────────

    private String getCellString(Row row, int col) {
        Cell cell = row.getCell(col);
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim().isEmpty() ? null : cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            default -> null;
        };
    }

    private BigDecimal getCellBigDecimal(Row row, int col) {
        Cell cell = row.getCell(col);
        if (cell == null || cell.getCellType() != CellType.NUMERIC) return null;
        return BigDecimal.valueOf(cell.getNumericCellValue());
    }

    private LocalDate getCellDate(Row row, int col) {
        Cell cell = row.getCell(col);
        if (cell == null) return null;
        try {
            if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                // Lecture directe OLE → LocalDate sans conversion de fuseau horaire
                return cell.getLocalDateTimeCellValue().toLocalDate();
            }
            if (cell.getCellType() == CellType.STRING) {
                String val = cell.getStringCellValue().trim();
                for (DateTimeFormatter fmt : List.of(
                        DateTimeFormatter.ofPattern("dd/MM/yyyy"),
                        DateTimeFormatter.ofPattern("d/M/yyyy"),
                        DateTimeFormatter.ofPattern("yyyy-MM-dd"))) {
                    try { return LocalDate.parse(val, fmt); } catch (Exception ignored) {}
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String getCellStringRaw(Cell cell) {
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            default -> null;
        };
    }

    private boolean isRowEmpty(Row row) {
        if (row == null) return true;
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK) return false;
        }
        return true;
    }
}
