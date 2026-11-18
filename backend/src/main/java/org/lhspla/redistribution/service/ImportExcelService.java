package org.lhspla.redistribution.service;

import org.apache.poi.ss.util.CellRangeAddressList;

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
        List<Produit> produits = sppRepo.findActiveProduits(structureId, programmeId).stream()
                .sorted(java.util.Comparator.comparing(Produit::getNom)).toList();
        Programme programme = programmeRepo.findById(programmeId).orElse(null);
        String programmeCode = programme != null ? programme.getCode() : "PROG";

        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            GabaritExcelService.Styles st = new GabaritExcelService.Styles(wb);
            // Feuille lue par l'import : la première, signée par le programme
            XSSFSheet sheet = wb.createSheet(nomFeuille("Stock " + programmeCode));
            GabaritExcelService.entetes(sheet, st, new String[]{"Code Produit", "Nom Produit", "Unité",
                    "Stock Disponible *", "CMM", "Date Péremption (JJ/MM/AAAA)"}, new int[]{20, 42, 14, 18, 14, 26});

            // Signature cachée (col SIG_COL) : le fichier ne s'importe que pour ce programme
            Cell sigCell = sheet.getRow(0).createCell(SIG_COL);
            sigCell.setCellValue(SIGNATURE_PREFIX + programmeId);
            sheet.setColumnHidden(SIG_COL, true);

            // Produits suivis par la structure : colonnes A-C verrouillées, D-F à remplir
            int rowIdx = 1;
            for (Produit p : produits) {
                Row row = sheet.createRow(rowIdx++);
                Cell c0 = row.createCell(0); c0.setCellValue(p.getCode());  c0.setCellStyle(st.verrouille);
                Cell c1 = row.createCell(1); c1.setCellValue(p.getNom());   c1.setCellStyle(st.verrouille);
                Cell c2 = row.createCell(2); c2.setCellValue(p.getUnite()); c2.setCellStyle(st.verrouille);
                row.createCell(3).setCellStyle(st.saisie);
                row.createCell(4).setCellStyle(st.saisie);
                row.createCell(5).setCellStyle(st.date);
            }
            int derniere = Math.max(rowIdx - 1, 1);

            // Contrôles de saisie : nombres positifs, date future
            DataValidationHelper dv = sheet.getDataValidationHelper();
            for (int col : new int[]{3, 4}) {
                DataValidation v = dv.createValidation(
                        dv.createDecimalConstraint(DataValidationConstraint.OperatorType.GREATER_OR_EQUAL, "0", null),
                        new CellRangeAddressList(1, derniere, col, col));
                v.setErrorStyle(DataValidation.ErrorStyle.STOP);
                String titre = col == 3 ? "Stock disponible" : "CMM";
                String aide = col == 3 ? "Quantité en stock à la date de l'état (nombre positif ou 0)."
                        : "Consommation moyenne mensuelle (nombre positif ou 0 ; vide si inconnue).";
                v.createErrorBox(titre, aide); v.createPromptBox(titre, aide);
                v.setShowErrorBox(true); v.setShowPromptBox(true);
                sheet.addValidationData(v);
            }
            DataValidation vDate = dv.createValidation(
                    dv.createDateConstraint(DataValidationConstraint.OperatorType.GREATER_THAN, "TODAY()", null, "dd/mm/yyyy"),
                    new CellRangeAddressList(1, derniere, 5, 5));
            vDate.setErrorStyle(DataValidation.ErrorStyle.STOP);
            vDate.createErrorBox("Date de péremption", "Date au format JJ/MM/AAAA, postérieure à aujourd'hui. "
                    + "Obligatoire dès que le stock est supérieur à 0.");
            vDate.createPromptBox("Date de péremption", "JJ/MM/AAAA, postérieure à aujourd'hui. "
                    + "Obligatoire si le stock est supérieur à 0 (lot qui périme le premier).");
            vDate.setShowErrorBox(true); vDate.setShowPromptBox(true);
            sheet.addValidationData(vDate);

            // Les colonnes produit ne se modifient pas par erreur (protection sans mot de passe)
            sheet.protectSheet("");
            sheet.lockFormatColumns(false);
            sheet.lockSort(false);
            sheet.lockAutoFilter(false);

            GabaritExcelService.modeEmploi(wb, st, "Saisie des stocks : programme "
                    + (programme != null ? programme.getNom() : programmeCode), new String[]{
                    "Remplissez la feuille « " + sheet.getSheetName() + " » : une ligne par produit suivi par votre structure.",
                    "Les colonnes Code, Nom et Unité sont fournies et protégées : ne les modifiez pas, n'ajoutez pas de produit.",
                    "Stock Disponible (obligatoire) : quantité en stock, 0 si rupture.",
                    "CMM : consommation moyenne mensuelle. Laissez vide si inconnue.",
                    "Date de péremption : celle du lot qui périme le premier, au format JJ/MM/AAAA, "
                            + "postérieure à aujourd'hui. Obligatoire dès que le stock est supérieur à 0.",
                    "Une ligne laissée vide est ignorée.",
                    "Ce fichier ne s'importe que pour ce programme. Pour un autre programme, téléchargez son propre gabarit.",
                    "En cas d'erreur, rien n'est enregistré : corrigez les lignes signalées puis importez à nouveau.",
            });
            return GabaritExcelService.ecrire(wb);
        } catch (IOException e) {
            throw BusinessException.badRequest("Erreur génération modèle: " + e.getMessage());
        }
    }

    /** « CODEPROGRAMME » pour le nom du fichier téléchargé (caractères sûrs uniquement). */
    public String codeFichier(Long structureId, Long programmeId) {
        String code = programmeRepo.findById(programmeId).map(Programme::getCode).orElse("programme");
        return code.replaceAll("[^A-Za-z0-9_-]", "_");
    }

    /** Nom de feuille Excel valide (31 caractères, sans caractères interdits). */
    private static String nomFeuille(String nom) {
        String n = nom.replaceAll("[\\\\/?*\\[\\]:]", "-");
        return n.length() > 31 ? n.substring(0, 31) : n;
    }

    // ─── Import (deux passes : validation puis écriture) ─────────────────────

    @Transactional
    public ImportResultatDTO parseExcel(MultipartFile file, Long periodeId, Long programmeId,
                                        Long structureId, String username) {
        List<ParsedRow> allRows = new ArrayList<>();
        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            // Seules les feuilles signées sont lues : le mode d'emploi et toute feuille
            // ajoutée par l'utilisateur sont ignorés. Il en faut au moins une.
            int feuillesSignees = 0;
            for (int i = 0; i < wb.getNumberOfSheets(); i++) {
                Sheet sheet = wb.getSheetAt(i);
                if (!estSignee(sheet)) continue;
                validateTemplateSignature(sheet, programmeId);
                allRows.addAll(parseAndValidate(sheet, programmeId));
                feuillesSignees++;
            }
            if (feuillesSignees == 0) {
                throw BusinessException.badRequest(
                        "Fichier non conforme : utilisez le modèle téléchargé pour ce programme.");
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

    private boolean estSignee(Sheet sheet) {
        Row header = sheet.getRow(0);
        String sig = header != null ? getCellStringRaw(header.getCell(SIG_COL)) : null;
        return sig != null && sig.startsWith(SIGNATURE_PREFIX);
    }

    private List<ParsedRow> parseAndValidate(Sheet sheet, Long programmeId) {
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
            Optional<Produit> produitOpt = produitRepo.findByCodeIgnoreCaseAndProgrammeId(parsed.produitCode, programmeId);
            if (produitOpt.isEmpty()) {
                parsed.erreurs.add(new LigneErreurDTO(rowNum, parsed.produitCode,
                        "Produit introuvable dans ce programme", "Code: " + parsed.produitCode));
                rows.add(parsed);
                continue;
            }
            parsed.produitId = produitOpt.get().getId();

            // Date de péremption obligatoire si stock > 0
            if (parsed.stockDisponible.compareTo(BigDecimal.ZERO) > 0 && parsed.expireDate == null) {
                parsed.erreurs.add(new LigneErreurDTO(rowNum, parsed.produitCode,
                        "Date de péremption obligatoire si stock > 0",
                        "Stock: " + parsed.stockDisponible + ", date de péremption : non renseignée"));
            }

            // Date de péremption doit être postérieure à la date de saisie (= date système)
            LocalDate dateSaisie = LocalDate.now();
            if (parsed.expireDate != null && !parsed.expireDate.isAfter(dateSaisie)) {
                parsed.erreurs.add(new LigneErreurDTO(rowNum, parsed.produitCode,
                        "La date de péremption doit être postérieure à la date de saisie",
                        "Date péremption: " + parsed.expireDate + ", date de saisie : " + dateSaisie));
            }

            rows.add(parsed);
        }
        return rows;
    }

    // ─── Signature du modèle ─────────────────────────────────────────────────

    private void validateTemplateSignature(Sheet sheet, Long programmeId) {
        Row header = sheet.getRow(0);
        if (header == null) throw BusinessException.badRequest(
                "Fichier non conforme : utilisez le modèle téléchargé pour ce programme.");
        Cell sigCell = header.getCell(SIG_COL);
        String sig = sigCell != null ? getCellStringRaw(sigCell) : null;
        if (sig == null || !sig.startsWith(SIGNATURE_PREFIX)) {
            throw BusinessException.badRequest(
                    "Fichier non conforme : utilisez le modèle téléchargé pour ce programme.");
        }
        try {
            long fileProgrammeId = Long.parseLong(sig.substring(SIGNATURE_PREFIX.length()));
            if (fileProgrammeId != programmeId) {
                throw BusinessException.badRequest(
                        "Le fichier ne correspond pas au programme sélectionné.");
            }
        } catch (NumberFormatException e) {
            throw BusinessException.badRequest("Fichier non conforme : signature invalide.");
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
