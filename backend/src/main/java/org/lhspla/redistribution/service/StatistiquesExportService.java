package org.lhspla.redistribution.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfPageEventHelper;
import com.lowagie.text.pdf.PdfWriter;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.lhspla.redistribution.dto.response.StatistiquesDTO;
import org.lhspla.redistribution.exception.BusinessException;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/** Exports Excel et PDF des statistiques des plans de redéploiement. */
@Service
public class StatistiquesExportService {

    private static final DateTimeFormatter JOUR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter HORODATAGE = DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm");

    // ── Lignes communes aux deux exports ─────────────────────────────────────

    private static List<String[]> synthese(StatistiquesDTO d) {
        StatistiquesDTO.Synthese s = d.getSynthese();
        List<String[]> l = new ArrayList<>();
        l.add(new String[]{"Plans validés", String.valueOf(s.getNbPlans()), "dont " + s.getNbPlansClotures() + " clôturé(s), " + s.getNbRegions() + " région(s)"});
        l.add(new String[]{"Mouvements", String.valueOf(s.getNbMouvements()), s.getNbExecutes() + " exécuté(s), " + s.getNbPartiels() + " partiel(s), " + s.getNbEnAttente() + " en attente"});
        l.add(new String[]{"Taux d'exécution des mouvements", pct(s.getTauxExecutionMouvements()), "mouvements exécutés au moins en partie / mouvements"});
        l.add(new String[]{"Taux d'exécution des quantités", pct(s.getTauxExecutionQuantites()), "quantités exécutées / quantités prévues"});
        l.add(new String[]{"Délai moyen entre validation et exécution", jours(s.getDelaiMoyenJours()), "médiane : " + jours(s.getDelaiMedianJours())});
        l.add(new String[]{"Ruptures résorbées", String.valueOf(s.getNbRupturesResorbees()), "sites en rupture qui ont reçu le produit"});
        l.add(new String[]{"Destinataires servis", String.valueOf(s.getNbCiblesServies()), "couples site/produit ayant reçu une quantité"});
        return l;
    }

    private static final String[] T_GROUPE = {"", "Plans", "Mouvements", "Exécutés (au moins en partie)", "Taux mouvements", "Taux quantités", "Ruptures résorbées"};

    private static List<String[]> groupes(List<StatistiquesDTO.Groupe> gs) {
        return gs.stream().map(g -> new String[]{g.getLibelle(), String.valueOf(g.getNbPlans()), String.valueOf(g.getNbMouvements()),
                String.valueOf(g.getNbExecutesAuMoinsEnPartie()), pct(g.getTauxExecutionMouvements()), pct(g.getTauxExecutionQuantites()),
                String.valueOf(g.getNbRupturesResorbees())}).toList();
    }

    private static final String[] T_PRODUIT = {"Programme", "Code", "Produit", "Unité", "Mouvements", "Quantité prévue", "Quantité exécutée", "Taux quantités"};

    private static List<String[]> produits(List<StatistiquesDTO.Produit> ps) {
        return ps.stream().map(p -> new String[]{p.getProgramme(), p.getCode(), p.getNom(), p.getUnite(), String.valueOf(p.getNbMouvements()),
                nombre(p.getQuantitePrevue()), nombre(p.getQuantiteExecutee()), pct(p.getTauxExecutionQuantites())}).toList();
    }

    private static String[] tSites(boolean cibles) {
        return cibles
                ? new String[]{"Site destinataire", "Région", "Mouvements", "Exécutés (au moins en partie)", "Produits", "Ruptures résorbées"}
                : new String[]{"Site expéditeur", "Région", "Mouvements", "Exécutés (au moins en partie)", "Produits"};
    }

    private static List<String[]> sites(List<StatistiquesDTO.Site> ss, boolean cibles) {
        return ss.stream().map(s -> cibles
                ? new String[]{s.getNom(), s.getRegion(), String.valueOf(s.getNbMouvements()), String.valueOf(s.getNbExecutesAuMoinsEnPartie()),
                               String.valueOf(s.getNbProduits()), String.valueOf(s.getNbRupturesResorbees())}
                : new String[]{s.getNom(), s.getRegion(), String.valueOf(s.getNbMouvements()), String.valueOf(s.getNbExecutesAuMoinsEnPartie()),
                               String.valueOf(s.getNbProduits())}).toList();
    }

    private static String titre(StatistiquesDTO d) {
        return "Statistiques des plans de redéploiement · " + d.getNiveau();
    }

    private static String sousTitre(StatistiquesDTO d) {
        return "Plans validés du " + d.getDebut().format(JOUR) + " au " + d.getFin().format(JOUR) + " · " + d.getProgramme();
    }

    // ── Excel ────────────────────────────────────────────────────────────────

    public byte[] excel(StatistiquesDTO d) {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            GabaritExcelService.Styles st = new GabaritExcelService.Styles(wb);

            XSSFSheet f = wb.createSheet("Synthèse");
            f.setColumnWidth(0, 40 * 256); f.setColumnWidth(1, 16 * 256); f.setColumnWidth(2, 60 * 256);
            ecrire(f, 0, st.titre, titre(d));
            ecrire(f, 1, null, sousTitre(d));
            ecrire(f, 2, null, "Généré le " + LocalDateTime.now().format(HORODATAGE));
            Row h = f.createRow(4);
            String[] th = {"Indicateur", "Valeur", "Détail"};
            for (int c = 0; c < th.length; c++) { Cell cell = h.createCell(c); cell.setCellValue(th[c]); cell.setCellStyle(st.entete); }
            int i = 5;
            for (String[] l : synthese(d)) ligne(f, i++, l);

            feuille(wb, st, "Par région", T_GROUPE, groupes(d.getParRegion()), "Région");
            feuille(wb, st, "Par programme", T_GROUPE, groupes(d.getParProgramme()), "Programme");
            feuille(wb, st, "Par produit", T_PRODUIT, produits(d.getParProduit()), null);
            feuille(wb, st, "Sites expéditeurs", tSites(false), sites(d.getSitesSources(), false), null);
            feuille(wb, st, "Sites destinataires", tSites(true), sites(d.getSitesCibles(), true), null);
            feuille(wb, st, "Par mois", T_GROUPE, groupes(d.getParMois()), "Mois de validation");
            return GabaritExcelService.ecrire(wb);
        } catch (IOException e) {
            throw BusinessException.badRequest("Export Excel impossible : " + e.getMessage());
        }
    }

    private static void feuille(XSSFWorkbook wb, GabaritExcelService.Styles st, String nom, String[] entetes,
                                List<String[]> lignes, String premiereColonne) {
        String[] t = entetes.clone();
        if (premiereColonne != null) t[0] = premiereColonne;
        XSSFSheet f = wb.createSheet(nom);
        int[] largeurs = new int[t.length];
        for (int c = 0; c < t.length; c++) largeurs[c] = c == 0 || (t.length == 8 && c == 2) ? 40 : 18;
        GabaritExcelService.entetes(f, st, t, largeurs);
        int i = 1;
        for (String[] l : lignes) ligne(f, i++, l);
        if (lignes.isEmpty()) ecrire(f, 1, null, "Aucune donnée sur la période.");
    }

    private static void ligne(XSSFSheet f, int i, String[] valeurs) {
        Row r = f.createRow(i);
        for (int c = 0; c < valeurs.length; c++) {
            String v = valeurs[c];
            Cell cell = r.createCell(c);
            // Nombres écrits comme nombres, pour les calculs dans Excel
            try {
                if (v != null && v.matches("-?\\d+(\\.\\d+)?")) { cell.setCellValue(Double.parseDouble(v)); continue; }
            } catch (NumberFormatException ignored) { }
            cell.setCellValue(v != null ? v : "");
        }
    }

    private static void ecrire(XSSFSheet f, int i, org.apache.poi.ss.usermodel.CellStyle style, String texte) {
        Cell c = f.createRow(i).createCell(0);
        c.setCellValue(texte);
        if (style != null) c.setCellStyle(style);
    }

    // ── PDF ──────────────────────────────────────────────────────────────────

    private static final Font F_TITRE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15, new Color(15, 23, 42));
    private static final Font F_SOUS = FontFactory.getFont(FontFactory.HELVETICA, 9.5f, new Color(71, 85, 105));
    private static final Font F_SECTION = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11.5f, new Color(79, 70, 229));
    private static final Font F_ENTETE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.WHITE);
    private static final Font F_CELLULE = FontFactory.getFont(FontFactory.HELVETICA, 8, new Color(15, 23, 42));
    private static final Font F_PIED = FontFactory.getFont(FontFactory.HELVETICA, 7, new Color(148, 163, 184));

    public byte[] pdf(StatistiquesDTO d) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4.rotate(), 32, 32, 32, 40);
        try {
            PdfWriter writer = PdfWriter.getInstance(doc, out);
            String genere = "Généré le " + LocalDateTime.now().format(HORODATAGE);
            writer.setPageEvent(new PdfPageEventHelper() {
                @Override
                public void onEndPage(PdfWriter w, Document document) {
                    var cb = w.getDirectContent();
                    com.lowagie.text.pdf.ColumnText.showTextAligned(cb, Element.ALIGN_LEFT,
                            new Phrase(genere, F_PIED), document.left(), document.bottom() - 18, 0);
                    com.lowagie.text.pdf.ColumnText.showTextAligned(cb, Element.ALIGN_RIGHT,
                            new Phrase("Page " + w.getPageNumber(), F_PIED), document.right(), document.bottom() - 18, 0);
                }
            });
            doc.open();
            doc.add(new Paragraph(titre(d), F_TITRE));
            Paragraph st = new Paragraph(sousTitre(d), F_SOUS);
            st.setSpacingAfter(10);
            doc.add(st);

            doc.add(tableau("Synthèse", new String[]{"Indicateur", "Valeur", "Détail"}, synthese(d), new float[]{3, 1.2f, 5}));
            doc.add(tableau("Par région", remplacer(T_GROUPE, "Région"), groupes(d.getParRegion()), null));
            doc.add(tableau("Par programme", remplacer(T_GROUPE, "Programme"), groupes(d.getParProgramme()), null));
            doc.add(tableau("Par mois de validation", remplacer(T_GROUPE, "Mois"), groupes(d.getParMois()), null));
            doc.add(tableau("Par produit", T_PRODUIT, produits(d.getParProduit()), new float[]{2.4f, 1.3f, 3.2f, 1, 1, 1.2f, 1.2f, 1}));
            doc.add(tableau("Sites expéditeurs les plus sollicités", tSites(false), sites(d.getSitesSources(), false), null));
            doc.add(tableau("Sites destinataires les plus servis", tSites(true), sites(d.getSitesCibles(), true), null));
            doc.close();
            return out.toByteArray();
        } catch (DocumentException e) {
            throw BusinessException.badRequest("Export PDF impossible : " + e.getMessage());
        }
    }

    private static String[] remplacer(String[] t, String premiere) {
        String[] r = t.clone();
        r[0] = premiere;
        return r;
    }

    /** Tableau précédé de son titre ; titre et en-têtes se répètent en haut de chaque page. */
    private static PdfPTable tableau(String titre, String[] entetes, List<String[]> lignes, float[] largeurs) throws DocumentException {
        PdfPTable t = new PdfPTable(entetes.length);
        t.setWidthPercentage(100);
        t.setSpacingBefore(12);
        t.setHeaderRows(2);
        if (largeurs != null) t.setWidths(largeurs);
        PdfPCell titreCellule = new PdfPCell(new Phrase(titre, F_SECTION));
        titreCellule.setColspan(entetes.length);
        titreCellule.setBorder(0);
        titreCellule.setPaddingBottom(5);
        t.addCell(titreCellule);
        for (String e : entetes) {
            PdfPCell c = new PdfPCell(new Phrase(e, F_ENTETE));
            c.setBackgroundColor(new Color(79, 70, 229));
            c.setPadding(4);
            t.addCell(c);
        }
        if (lignes.isEmpty()) {
            PdfPCell c = new PdfPCell(new Phrase("Aucune donnée sur la période.", F_CELLULE));
            c.setColspan(entetes.length);
            c.setPadding(4);
            t.addCell(c);
        }
        boolean pair = false;
        for (String[] l : lignes) {
            for (int i = 0; i < l.length; i++) {
                PdfPCell c = new PdfPCell(new Phrase(l[i] != null ? l[i] : "", F_CELLULE));
                c.setPadding(3.5f);
                if (i > 0 && l[i] != null && l[i].matches("[-\\d.,% j]+")) c.setHorizontalAlignment(Element.ALIGN_RIGHT);
                if (pair) c.setBackgroundColor(new Color(241, 245, 249));
                t.addCell(c);
            }
            pair = !pair;
        }
        return t;
    }

    // ── Formats ──────────────────────────────────────────────────────────────

    private static String pct(double v) {
        return String.format(java.util.Locale.FRANCE, "%.1f %%", v);
    }

    private static String jours(Double v) {
        return v == null ? "-" : String.format(java.util.Locale.FRANCE, "%.1f j", v);
    }

    private static String nombre(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v);
    }
}
