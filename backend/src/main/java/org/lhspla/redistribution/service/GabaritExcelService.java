package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.*;
import org.lhspla.redistribution.entity.District;
import org.lhspla.redistribution.entity.Produit;
import org.lhspla.redistribution.entity.Programme;
import org.lhspla.redistribution.entity.Structure;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.DistrictRepository;
import org.lhspla.redistribution.repository.ProduitRepository;
import org.lhspla.redistribution.repository.ProgrammeRepository;
import org.lhspla.redistribution.repository.StructureRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Comparator;
import java.util.List;

/**
 * Gabarits Excel des imports du référentiel (Géo et Catalogue).
 *
 * La première feuille est celle que l'import lit : en-têtes exacts, aucune ligne
 * d'exemple (un exemple oublié deviendrait une donnée réelle), contrôles de saisie
 * (listes, longueurs). Suivent un mode d'emploi et le référentiel existant, pour
 * reprendre la même orthographe et éviter les doublons.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GabaritExcelService {

    /** Types de structure acceptés (mêmes valeurs que le formulaire du référentiel). */
    public static final List<String> TYPES_STRUCTURE = List.of("HOPITAL", "CENTRE_SANTE", "DISPENSAIRE", "DEPOT");
    /** Unités proposées ; d'autres restent possibles (simple avertissement). */
    private static final String[] UNITES = {"comprimé", "gélule", "plaquette", "flacon", "ampoule", "sachet",
            "tube", "test", "pièce", "unité", "boîte", "kit", "dose"};
    /** Lignes couvertes par les contrôles de saisie. */
    private static final int LIGNES = 2000;

    private final DistrictRepository districtRepo;
    private final StructureRepository structureRepo;
    private final ProgrammeRepository programmeRepo;
    private final ProduitRepository produitRepo;

    // ── Import Géo ───────────────────────────────────────────────────────────

    public byte[] gabaritGeo() {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Styles st = new Styles(wb);

            XSSFSheet f = wb.createSheet("Structures");
            entetes(f, st, new String[]{"Région *", "District *", "Nom de la structure *", "Code structure", "Type"},
                    new int[]{28, 28, 40, 18, 18});
            DataValidationHelper dv = f.getDataValidationHelper();
            liste(f, dv, 4, TYPES_STRUCTURE.toArray(String[]::new), true,
                    "Type de structure", "Choisissez dans la liste : HOPITAL, CENTRE_SANTE, DISPENSAIRE ou DEPOT.");
            longueur(f, dv, 0, 1, 100, "Région", "Obligatoire, 100 caractères au plus.");
            longueur(f, dv, 1, 1, 100, "District", "Obligatoire, 100 caractères au plus.");
            longueur(f, dv, 2, 1, 150, "Nom de la structure", "Obligatoire, 150 caractères au plus.");
            longueur(f, dv, 3, 1, 20, "Code structure", "Facultatif, 20 caractères au plus. Identifie la structure : "
                    + "un code déjà connu met à jour la structure au lieu d'en créer une nouvelle.");

            modeEmploi(wb, st, "Import Géo : régions, districts et structures", new String[]{
                    "Une ligne par structure, à partir de la ligne 2 de la feuille « Structures ». Ne modifiez pas les en-têtes.",
                    "Région, District et Nom de la structure sont obligatoires (colonnes marquées *).",
                    "Une région ou un district absent est créé ; s'il existe déjà (même nom, majuscules ignorées), il est réutilisé.",
                    "Code structure : facultatif. S'il correspond à une structure existante, celle-ci est mise à jour ; sans code, "
                            + "la structure est retrouvée par son nom dans le district, sinon un code est généré.",
                    "Type : HOPITAL, CENTRE_SANTE, DISPENSAIRE ou DEPOT (liste déroulante). Vide : CENTRE_SANTE.",
                    "Reprenez l'orthographe exacte des noms déjà présents (onglet « Référentiel existant ») pour éviter les doublons.",
                    "Exemple de ligne : Région Nord | District de Korhogo | Centre de santé urbain de Korhogo | CSU-KOR | CENTRE_SANTE",
            });

            XSSFSheet r = wb.createSheet("Référentiel existant");
            entetes(r, st, new String[]{"Région", "District", "Structure", "Code", "Type", "Active"},
                    new int[]{28, 28, 40, 18, 18, 10});
            int i = 1;
            List<District> districts = districtRepo.findAll().stream()
                    .sorted(Comparator.comparing((District d) -> d.getRegion() != null ? d.getRegion().getNom() : "")
                            .thenComparing(District::getNom)).toList();
            for (District d : districts) {
                List<Structure> structures = structureRepo.findByDistrictId(d.getId()).stream()
                        .sorted(Comparator.comparing(Structure::getNom)).toList();
                String region = d.getRegion() != null ? d.getRegion().getNom() : "";
                if (structures.isEmpty()) {
                    ligne(r, i++, region, d.getNom(), "", "", "", "");
                }
                for (Structure s : structures) {
                    ligne(r, i++, region, d.getNom(), s.getNom(), s.getCode(), s.getType(),
                            Boolean.FALSE.equals(s.getActive()) ? "non" : "oui");
                }
            }
            if (i == 1) ligne(r, 1, "(aucune donnée pour l'instant)");
            r.protectSheet("");
            return ecrire(wb);
        } catch (IOException e) {
            throw BusinessException.badRequest("Erreur de génération du gabarit : " + e.getMessage());
        }
    }

    // ── Import Catalogue ─────────────────────────────────────────────────────

    public byte[] gabaritCatalogue() {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Styles st = new Styles(wb);

            XSSFSheet f = wb.createSheet("Produits");
            entetes(f, st, new String[]{"Programme *", "Code programme", "Produit *", "Code produit", "Unité"},
                    new int[]{40, 18, 45, 18, 16});
            DataValidationHelper dv = f.getDataValidationHelper();
            longueur(f, dv, 0, 1, 100, "Programme", "Obligatoire, 100 caractères au plus.");
            longueur(f, dv, 1, 1, 50, "Code programme", "Facultatif, 50 caractères au plus.");
            longueur(f, dv, 2, 1, 200, "Produit", "Obligatoire, 200 caractères au plus.");
            longueur(f, dv, 3, 1, 30, "Code produit", "Facultatif mais recommandé, 30 caractères au plus. "
                    + "C'est ce code que les gabarits de saisie des stocks utilisent.");
            liste(f, dv, 4, UNITES, false, "Unité",
                    "Choisissez dans la liste ou saisissez une autre unité. Vide : « unité ».");

            modeEmploi(wb, st, "Import Catalogue : programmes et produits", new String[]{
                    "Une ligne par produit, à partir de la ligne 2 de la feuille « Produits ». Ne modifiez pas les en-têtes.",
                    "Programme et Produit sont obligatoires (colonnes marquées *).",
                    "Le programme est retrouvé par son nom (majuscules ignorées) ; absent, il est créé avec le code indiqué.",
                    "Le produit est retrouvé par son code dans le programme (ou par son nom si le code est vide) : "
                            + "il est alors mis à jour, sinon il est créé.",
                    "Renseignez le code produit : il sert ensuite à la saisie des stocks par import Excel.",
                    "Unité : liste déroulante (comprimé, flacon, ampoule…), d'autres valeurs restent possibles.",
                    "Reprenez l'orthographe exacte des programmes existants (onglet « Catalogue existant »).",
                    "Exemple de ligne : Programme National de Lutte contre le Paludisme | PNLP | Artéméther/Luméfantrine 20/120 mg | ACT-AL-20 | comprimé",
            });

            XSSFSheet r = wb.createSheet("Catalogue existant");
            entetes(r, st, new String[]{"Programme", "Code programme", "Produit", "Code produit", "Unité", "Actif"},
                    new int[]{40, 18, 45, 18, 16, 10});
            int i = 1;
            for (Programme p : programmeRepo.findAll().stream().sorted(Comparator.comparing(Programme::getNom)).toList()) {
                List<Produit> produits = produitRepo.findByProgrammeId(p.getId()).stream()
                        .sorted(Comparator.comparing(Produit::getNom)).toList();
                if (produits.isEmpty()) ligne(r, i++, p.getNom(), p.getCode(), "", "", "", "");
                for (Produit pr : produits) {
                    ligne(r, i++, p.getNom(), p.getCode(), pr.getNom(), pr.getCode(), pr.getUnite(),
                            Boolean.FALSE.equals(pr.getActif()) ? "non" : "oui");
                }
            }
            if (i == 1) ligne(r, 1, "(aucune donnée pour l'instant)");
            r.protectSheet("");
            return ecrire(wb);
        } catch (IOException e) {
            throw BusinessException.badRequest("Erreur de génération du gabarit : " + e.getMessage());
        }
    }

    // ── Outils communs (aussi utilisés par le gabarit des stocks) ────────────

    /** Styles partagés des gabarits. */
    public static final class Styles {
        public final XSSFCellStyle entete, texte, verrouille, titre, saisie, date;

        public Styles(XSSFWorkbook wb) {
            entete = wb.createCellStyle();
            XSSFFont blanc = wb.createFont();
            blanc.setBold(true);
            blanc.setColor(new XSSFColor(new byte[]{(byte) 255, (byte) 255, (byte) 255}, null));
            entete.setFont(blanc);
            entete.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 79, (byte) 70, (byte) 229}, null));
            entete.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            entete.setVerticalAlignment(VerticalAlignment.CENTER);

            texte = wb.createCellStyle();
            texte.setWrapText(true);
            texte.setVerticalAlignment(VerticalAlignment.TOP);

            titre = wb.createCellStyle();
            XSSFFont gras = wb.createFont();
            gras.setBold(true);
            gras.setFontHeightInPoints((short) 13);
            titre.setFont(gras);

            verrouille = wb.createCellStyle();
            verrouille.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 241, (byte) 245, (byte) 249}, null));
            verrouille.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            verrouille.setLocked(true);

            saisie = wb.createCellStyle();
            saisie.setLocked(false);

            date = wb.createCellStyle();
            date.setLocked(false);
            date.setDataFormat(wb.getCreationHelper().createDataFormat().getFormat("dd/mm/yyyy"));
        }
    }

    public static void entetes(XSSFSheet f, Styles st, String[] titres, int[] largeurs) {
        Row h = f.createRow(0);
        h.setHeightInPoints(22);
        for (int c = 0; c < titres.length; c++) {
            Cell cell = h.createCell(c);
            cell.setCellValue(titres[c]);
            cell.setCellStyle(st.entete);
            f.setColumnWidth(c, largeurs[c] * 256);
        }
        f.createFreezePane(0, 1);
    }

    public static void modeEmploi(XSSFWorkbook wb, Styles st, String titre, String[] lignes) {
        XSSFSheet m = wb.createSheet("Mode d'emploi");
        m.setColumnWidth(0, 120 * 256);
        Cell t = m.createRow(0).createCell(0);
        t.setCellValue(titre);
        t.setCellStyle(st.titre);
        for (int i = 0; i < lignes.length; i++) {
            Cell c = m.createRow(i + 2).createCell(0);
            c.setCellValue("• " + lignes[i]);
            c.setCellStyle(st.texte);
        }
        m.protectSheet("");
    }

    public static void liste(XSSFSheet f, DataValidationHelper dv, int col, String[] valeurs, boolean stricte,
                             String titre, String aide) {
        DataValidation v = dv.createValidation(dv.createExplicitListConstraint(valeurs),
                new CellRangeAddressList(1, LIGNES, col, col));
        v.setErrorStyle(stricte ? DataValidation.ErrorStyle.STOP : DataValidation.ErrorStyle.WARNING);
        v.createErrorBox(titre, aide);
        v.createPromptBox(titre, aide);
        v.setShowErrorBox(true);
        v.setShowPromptBox(true);
        f.addValidationData(v);
    }

    public static void longueur(XSSFSheet f, DataValidationHelper dv, int col, int min, int max, String titre, String aide) {
        DataValidation v = dv.createValidation(
                dv.createTextLengthConstraint(DataValidationConstraint.OperatorType.BETWEEN, String.valueOf(min), String.valueOf(max)),
                new CellRangeAddressList(1, LIGNES, col, col));
        v.setErrorStyle(DataValidation.ErrorStyle.STOP);
        v.createErrorBox(titre, aide);
        v.createPromptBox(titre, aide);
        v.setShowErrorBox(true);
        v.setShowPromptBox(true);
        f.addValidationData(v);
    }

    private static void ligne(XSSFSheet f, int i, String... valeurs) {
        Row r = f.createRow(i);
        for (int c = 0; c < valeurs.length; c++) r.createCell(c).setCellValue(valeurs[c] != null ? valeurs[c] : "");
    }

    public static byte[] ecrire(XSSFWorkbook wb) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        return out.toByteArray();
    }
}
