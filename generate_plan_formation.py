"""
Génère le fichier Plan_Formation_Redistribution.docx
à la racine du projet Weekly_report_v2.
"""
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import os

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "Plan_Formation_Redistribution.docx")

# ── Palette couleurs ────────────────────────────────────────────────────────
BLEU_ENTETE   = RGBColor(0x1E, 0x40, 0xAF)   # bleu foncé (titres de section)
BLEU_TABLE    = RGBColor(0x1E, 0x40, 0xAF)   # en-têtes de tableaux
VERT_MODULE   = RGBColor(0x06, 0x60, 0x32)   # modules communs mutualisés
ORANGE_ALERTE = RGBColor(0x92, 0x40, 0x0E)   # règles critiques
GRIS_FOND     = "D9E1F2"                      # fond cellules en-tête
VERT_FOND     = "C6EFCE"                      # fond récap vert
BLEU_FOND     = "BDD7EE"                      # fond récap bleu


# ── Helpers ─────────────────────────────────────────────────────────────────

def set_cell_bg(cell, hex_color: str):
    tc   = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd  = OxmlElement("w:shd")
    shd.set(qn("w:val"),   "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"),  hex_color)
    tcPr.append(shd)


def bold_cell(cell, text: str, size: int = 10, color: RGBColor | None = None, bg: str | None = None):
    cell.text = ""
    p   = cell.paragraphs[0]
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(size)
    if color:
        run.font.color.rgb = color
    if bg:
        set_cell_bg(cell, bg)


def add_table(doc, headers: list[str], rows: list[list[str]],
              col_widths: list[float] | None = None) -> None:
    """Ajoute un tableau formaté avec en-têtes bleus."""
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.LEFT

    # En-têtes
    hdr_row = table.rows[0]
    for i, h in enumerate(headers):
        cell = hdr_row.cells[i]
        bold_cell(cell, h, size=10, color=RGBColor(0xFF, 0xFF, 0xFF), bg="1E40AF")
        cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Données
    for r_idx, row_data in enumerate(rows):
        row = table.rows[r_idx + 1]
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            cell.text = val
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9.5)

    # Largeurs de colonnes
    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = Cm(w)

    doc.add_paragraph()


def h1(doc, text: str):
    p = doc.add_heading(text, level=1)
    p.runs[0].font.color.rgb = BLEU_ENTETE


def h2(doc, text: str):
    p = doc.add_heading(text, level=2)
    p.runs[0].font.color.rgb = BLEU_ENTETE


def h3(doc, text: str):
    p = doc.add_heading(text, level=3)
    p.runs[0].font.color.rgb = BLEU_ENTETE


def h4(doc, text: str):
    p = doc.add_heading(text, level=4)


def body(doc, text: str):
    doc.add_paragraph(text)


def bullet(doc, text: str, level: int = 0):
    p = doc.add_paragraph(text, style="List Bullet")
    p.paragraph_format.left_indent = Cm(0.5 * (level + 1))


def critiq(doc, text: str):
    """Paragraphe 'Règle critique' en orange gras."""
    p   = doc.add_paragraph()
    run = p.add_run("⚠ Règle critique : ")
    run.bold = True
    run.font.color.rgb = ORANGE_ALERTE
    run2 = p.add_run(text)
    run2.font.color.rgb = ORANGE_ALERTE
    run2.italic = True


def info_box(doc, text: str):
    """Bloc d'information mutualisé en vert."""
    p   = doc.add_paragraph()
    run = p.add_run(text)
    run.font.color.rgb = VERT_MODULE
    run.italic = True


def duree_line(doc, label: str, duree: str, bold_label: bool = False):
    p    = doc.add_paragraph()
    run1 = p.add_run(f"{label} : ")
    run1.bold = bold_label
    run2 = p.add_run(duree)
    run2.bold = True


def module_header(doc, code: str, titre: str, objectif: str, modalite: str, duree: str):
    h3(doc, f"{code} — {titre}")
    p   = doc.add_paragraph()
    run = p.add_run("Objectif pédagogique : ")
    run.bold = True
    p.add_run(objectif)
    doc.add_paragraph()


def synthese_table(doc, rows, total_row):
    headers = ["Module", "Durée"]
    table   = doc.add_table(rows=1 + len(rows) + 1, cols=2)
    table.style = "Table Grid"
    # En-tête
    hdr = table.rows[0]
    bold_cell(hdr.cells[0], "Module",  bg="1E40AF", color=RGBColor(0xFF, 0xFF, 0xFF))
    bold_cell(hdr.cells[1], "Durée",   bg="1E40AF", color=RGBColor(0xFF, 0xFF, 0xFF))
    hdr.cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    # Lignes
    for i, (m, d) in enumerate(rows):
        row = table.rows[i + 1]
        row.cells[0].text = m
        row.cells[1].text = d
        row.cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        for cell in row.cells:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9.5)
    # Total
    tot = table.rows[-1]
    bold_cell(tot.cells[0], total_row[0], bg=GRIS_FOND)
    bold_cell(tot.cells[1], total_row[1], bg=GRIS_FOND)
    tot.cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    # Largeurs
    for row in table.rows:
        row.cells[0].width = Cm(11)
        row.cells[1].width = Cm(4)
    doc.add_paragraph()


# ── Construction du document ────────────────────────────────────────────────

doc = Document()

# Marges
for section in doc.sections:
    section.top_margin    = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin   = Cm(2.5)
    section.right_margin  = Cm(2.5)

# Style par défaut
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(10.5)

# ═══════════════════════════════════════════════════════════════════
# PAGE DE TITRE
# ═══════════════════════════════════════════════════════════════════
doc.add_paragraph()
doc.add_paragraph()
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = title.add_run("Plan de Formation")
r.font.size = Pt(26)
r.bold = True
r.font.color.rgb = BLEU_ENTETE

subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
r2 = subtitle.add_run("Application de Redistribution Pharmaceutique")
r2.font.size = Pt(16)
r2.font.color.rgb = RGBColor(0x37, 0x51, 0x8C)

doc.add_paragraph()
desc = doc.add_paragraph()
desc.alignment = WD_ALIGN_PARAGRAPH.CENTER
r3 = desc.add_run("Formation par niveau d'acteur — Gestionnaire · Pharmacien de région · Superviseur")
r3.font.size = Pt(11)
r3.italic = True

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════
# 0. PRÉAMBULE
# ═══════════════════════════════════════════════════════════════════
h1(doc, "Préambule — Modules mutualisés")
body(doc,
     "Trois modules sont communs à plusieurs rôles. Ils sont organisés en session plénière "
     "avant les parcours spécifiques afin d'éviter les redondances pédagogiques.")

add_table(doc,
    headers=["Code", "Intitulé", "Rôles concernés"],
    rows=[
        ["M0",     "Interface commune — navigation et lecture des statuts", "Tous les rôles"],
        ["M-COM1", "Consultation des stocks et interprétation des statuts", "Pharmacien de région, Superviseur"],
        ["M-COM2", "Génération d'un plan de redistribution par IA",         "Pharmacien de région, Superviseur"],
    ],
    col_widths=[2.5, 9, 5]
)

# ═══════════════════════════════════════════════════════════════════
# MODULE M0
# ═══════════════════════════════════════════════════════════════════
h1(doc, "Module M0 — Interface commune  (tous rôles — session plénière)")
body(doc,
     "Objectif pédagogique : L'acteur sait se connecter, identifier son espace fonctionnel, "
     "lire le tableau de bord et interpréter les indicateurs de statut de stock.")
doc.add_paragraph()

h4(doc, "Contenu")
bullet(doc, "Processus de connexion : JWT, durée de session, déconnexion sécurisée")
bullet(doc, "Structure de la navigation selon le rôle (menus visibles ≠ selon le profil)")
bullet(doc, "Lecture des cinq statuts de stock :")
bullet(doc, "RUPTURE (< 0,5 MSD)", level=1)
bullet(doc, "TENSION (0,5 – 1 MSD)", level=1)
bullet(doc, "SURVEILLER (1 – 2 MSD)", level=1)
bullet(doc, "NORMAL (2 – 4 MSD)", level=1)
bullet(doc, "SURSTOCK (> 4 MSD)", level=1)
bullet(doc, "Définition du MSD : Mois de Stock Disponible = stock disponible ÷ CMM")
bullet(doc, "Badge risque de péremption : surplus en mois affiché en orange")
bullet(doc, "Zones d'accès et d'interdiction selon le rôle")

doc.add_paragraph()
h4(doc, "Modalité")
body(doc, "Démonstration guidée + questions / réponses")
duree_line(doc, "Durée", "30 min", bold_label=True)
doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════════
# PARCOURS GESTIONNAIRE
# ═══════════════════════════════════════════════════════════════════
doc.add_page_break()
h1(doc, "Parcours Gestionnaire")
body(doc,
     "Périmètre fonctionnel : Saisie de stock (formulaire manuel), import Excel, "
     "consultation et suivi des plans de redistribution.")
doc.add_paragraph()

# MG1
h2(doc, "MG1 — Prise en main de l'espace Gestionnaire")
p = doc.add_paragraph()
p.add_run("Objectif pédagogique : ").bold = True
p.add_run("L'acteur identifie les menus accessibles à son rôle, navigue sans assistance "
          "entre les écrans et localise les alertes qui lui sont destinées.")
doc.add_paragraph()
h4(doc, "Contenu")
bullet(doc, "Tour de l'interface : menu latéral, tableau de bord, accès rapide")
bullet(doc, "Différence entre les fonctions visibles (saisie, import, suivi) et celles hors périmètre (génération de plan)")
bullet(doc, "Lecture du contexte affiché dans le header (structure rattachée)")
bullet(doc, "Identification d'un plan en attente dans le tableau de suivi")
doc.add_paragraph()
h4(doc, "Modalité")
body(doc, "Mise en situation guidée sur environnement de démonstration")
duree_line(doc, "Durée", "45 min", bold_label=True)
doc.add_paragraph()

# MG2
h2(doc, "MG2 — Saisie manuelle d'un état de stock")
p = doc.add_paragraph()
p.add_run("Objectif pédagogique : ").bold = True
p.add_run("L'acteur saisit un état de stock complet, ligne par ligne, en respectant "
          "les règles de validation métier, et soumet l'état pour validation.")
doc.add_paragraph()
h4(doc, "Contenu — Initialisation")
bullet(doc, "Création d'un nouvel état de stock : sélection période, programme, structure")
bullet(doc, "Compréhension du statut BROUILLON : l'état n'est pas encore soumis")
doc.add_paragraph()
h4(doc, "Contenu — Saisie d'une ligne produit")
bullet(doc, "Champs obligatoires : stock disponible, CMM, date de péremption")
critiq(doc, "La date de péremption doit être strictement postérieure à la date de saisie "
            "(blocage si non respecté, message d'erreur explicite).")
bullet(doc, "Calcul automatique du MSD affiché en temps réel après saisie stock + CMM")
critiq(doc, "Interprétation du badge 'Risque de péremption' : surplus = MSD résiduel > durée de vie restante. "
            "Que faire en pratique ?")
bullet(doc, "Saisie de plusieurs lignes produits dans le même état")
doc.add_paragraph()
h4(doc, "Contenu — Soumission")
bullet(doc, "Vérification du récapitulatif avant soumission")
bullet(doc, "Soumission de l'état (statut passe en SOUMIS, état verrouillé)")
bullet(doc, "Ce qui se passe après soumission : visible par le Pharmacien de région")
doc.add_paragraph()
h4(doc, "Contenu — Correction d'erreurs")
bullet(doc, "Corriger ou supprimer une ligne avant soumission")
bullet(doc, "Comportement en cas de CMM nulle : statut affiché et conséquences")
doc.add_paragraph()
h4(doc, "Modalité")
body(doc, "Exercice pratique sur jeu de données fictif — au moins 2 produits dont un en risque de "
          "péremption et un avec CMM nulle.")
duree_line(doc, "Durée", "2 h", bold_label=True)
doc.add_paragraph()

# MG3
h2(doc, "MG3 — Import Excel de stock")
p = doc.add_paragraph()
p.add_run("Objectif pédagogique : ").bold = True
p.add_run("L'acteur télécharge le modèle préconfiguré, le remplit correctement "
          "et importe le fichier sans erreur de validation.")
doc.add_paragraph()
h4(doc, "Contenu — Téléchargement du modèle")
bullet(doc, "Sélection obligatoire du programme et de la période avant téléchargement")
bullet(doc, "Structure du fichier : colonnes verrouillées (code, nom, unité) vs colonnes à remplir (stock, CMM, date)")
critiq(doc, "Ne jamais modifier la colonne de signature masquée (ligne 0, colonne H) — "
            "le fichier sera rejeté à l'import si modifié.")
bullet(doc, "Ne pas réutiliser un modèle téléchargé pour un autre programme ou une autre période")
doc.add_paragraph()
h4(doc, "Contenu — Remplissage du modèle")
bullet(doc, "Format attendu pour la date de péremption : JJ/MM/AAAA")
critiq(doc, "La date de péremption doit être postérieure à la date du jour.")
bullet(doc, "Laisser vide les produits non concernés (ne pas supprimer la ligne)")
bullet(doc, "CMM à zéro : laisser vide ou saisir 0 selon les instructions programme")
doc.add_paragraph()
h4(doc, "Contenu — Import du fichier")
bullet(doc, "Interface d'import : sélection programme + période + fichier")
bullet(doc, "Lecture du rapport d'import : lignes acceptées / rejetées / erreurs par ligne")
critiq(doc, "Si le fichier n'est pas issu du modèle téléchargé (mauvais programme, format modifié) "
            "→ rejet total avec message 'fichier non conforme'.")
bullet(doc, "Actions correctives selon le type d'erreur (date invalide, valeur manquante, mauvais fichier)")
doc.add_paragraph()
h4(doc, "Modalité")
body(doc, "Exercice pratique : télécharger le modèle PNLS d'une période fictive, le remplir dans Excel, "
          "l'importer — inclure volontairement une erreur de date pour tester le rejet.")
duree_line(doc, "Durée", "1 h 30", bold_label=True)
doc.add_paragraph()

# MG4
h2(doc, "MG4 — Consultation et suivi des plans de redistribution")
p = doc.add_paragraph()
p.add_run("Objectif pédagogique : ").bold = True
p.add_run("L'acteur lit les plans qui concernent sa structure, comprend les lignes "
          "qui le concernent et suit l'état d'avancement de l'exécution.")
doc.add_paragraph()
h4(doc, "Contenu")
bullet(doc, "Accès au module Suivi des plans")
bullet(doc, "Cycle de vie d'un plan : BROUILLON → VALIDE → EN_COURS → CLOTURE")
bullet(doc, "Statuts d'une ligne : EN_ATTENTE, EXECUTE, PARTIEL, ANNULE")
bullet(doc, "Identifier les lignes où sa structure est impliquée (source ou destination)")
critiq(doc, "PARTIEL : livraison partielle enregistrée, la ligne reste ouverte jusqu'à finalisation.")
bullet(doc, "Ce que le Gestionnaire ne peut pas faire : valider, générer, modifier les quantités d'un plan validé")
doc.add_paragraph()
h4(doc, "Modalité")
body(doc, "Démonstration sur données simulées + lecture commentée de 3 scénarios de plans.")
duree_line(doc, "Durée", "45 min", bold_label=True)
doc.add_paragraph()

# Synthèse Gestionnaire
h2(doc, "Synthèse Gestionnaire")
synthese_table(doc,
    rows=[
        ("M0 — Interface commune (mutualisé)",        "30 min"),
        ("MG1 — Prise en main de l'espace Gestionnaire", "45 min"),
        ("MG2 — Saisie manuelle d'un état de stock",  "2 h"),
        ("MG3 — Import Excel de stock",               "1 h 30"),
        ("MG4 — Consultation et suivi des plans",     "45 min"),
    ],
    total_row=("Total", "5 h 30")
)
body(doc, "Nombre de jours : 1 journée (base 7 h/j — marge de 1 h 30 pour questions, récapitulatif, évaluation pratique).")

# ═══════════════════════════════════════════════════════════════════
# PARCOURS PHARMACIEN DE RÉGION
# ═══════════════════════════════════════════════════════════════════
doc.add_page_break()
h1(doc, "Parcours Pharmacien de région")
body(doc,
     "Périmètre fonctionnel : Consultation des stocks, paramétrage du seuil région, "
     "génération des plans IA, suivi des plans.")
doc.add_paragraph()

# MP1
h2(doc, "MP1 — Prise en main de l'espace Pharmacien de région")
p = doc.add_paragraph()
p.add_run("Objectif pédagogique : ").bold = True
p.add_run("L'acteur identifie ses menus, comprend le contexte affiché (région rattachée) "
          "et différencie son périmètre de celui du Gestionnaire et du Superviseur.")
doc.add_paragraph()
h4(doc, "Contenu")
bullet(doc, "Navigation : tableau de bord, stocks, plans, paramètres")
bullet(doc, "Lecture du contexte dans le header (nom de la région)")
bullet(doc, "Ce que le Pharmacien voit que le Gestionnaire ne voit pas (vue agrégée région)")
bullet(doc, "Ce que le Pharmacien ne peut pas faire (saisie directe, import)")
bullet(doc, "Alerte tableau de bord : structures en RUPTURE ou TENSION dans sa région")
doc.add_paragraph()
h4(doc, "Modalité")
body(doc, "Démonstration guidée")
duree_line(doc, "Durée", "45 min", bold_label=True)
doc.add_paragraph()

# M-COM1
h2(doc, "M-COM1 — Consultation des stocks et interprétation des statuts  (mutualisé Pharmacien + Superviseur)")
info_box(doc, "⟳ Ce module est organisé en session conjointe avec le groupe Superviseur.")
p = doc.add_paragraph()
p.add_run("Objectif pédagogique : ").bold = True
p.add_run("L'acteur lit les états de stock soumis par les Gestionnaires, filtre par programme / "
          "période / structure et identifie les situations nécessitant une redistribution.")
doc.add_paragraph()
h4(doc, "Contenu")
bullet(doc, "Navigation dans la vue stocks : filtres programme, période, structure, statut")
bullet(doc, "Lecture du détail d'une structure : liste produits, MSD, statut, CMM, stock disponible")
critiq(doc, "Badge risque de péremption : surplus (mois) = MSD calculé − durée de vie restante (en mois).")
bullet(doc, "Identifier les structures en SURSTOCK susceptibles de céder des produits")
bullet(doc, "Identifier les structures en TENSION ou RUPTURE prioritaires à recevoir")
bullet(doc, "Différence entre état BROUILLON (non finalisé) et SOUMIS (exploitable pour un plan)")
critiq(doc, "CMM nulle : l'impact sur le statut calculé (MSD non calculable → statut INCONNU).")
doc.add_paragraph()
h4(doc, "Modalité")
body(doc, "Mise en situation sur jeu de données multi-structures (au moins une structure par statut).")
duree_line(doc, "Durée", "1 h", bold_label=True)
doc.add_paragraph()

# MP2
h2(doc, "MP2 — Paramétrage du seuil de stock de sécurité  (Pharmacien de région uniquement)")
p = doc.add_paragraph()
p.add_run("Objectif pédagogique : ").bold = True
p.add_run("L'acteur comprend le rôle du seuil MSD, sait le modifier depuis le menu Paramètres "
          "et évalue l'impact d'un changement de valeur.")
doc.add_paragraph()
h4(doc, "Contenu")
bullet(doc, "Accès au menu Paramètres → Paramètres région")
bullet(doc, "Définition du seuil : MSD résiduel minimum qu'une source doit conserver après redistribution")
bullet(doc, "Valeur par défaut : 2,0 MSD — plage autorisée : 0,5 à 12")
critiq(doc, "Si le seuil est relevé (ex. 2 → 3 MSD), les sources peuvent céder moins de stock — "
            "l'IA en tient compte à la prochaine génération de plan.")
bullet(doc, "Exemple : structure 5 MSD, seuil 2 → cède 3 MSD ; seuil 3 → cède 2 MSD seulement")
bullet(doc, "Enregistrement, confirmation snackbar, vérification de la nouvelle valeur affichée")
critiq(doc, "Valeur hors plage (< 0,5 ou > 12) → message de validation bloquant, enregistrement impossible.")
doc.add_paragraph()
h4(doc, "Modalité")
body(doc, "Exercice pratique : modifier le seuil, observer l'impact dans le panneau d'aide contextuel, "
          "restaurer la valeur initiale.")
duree_line(doc, "Durée", "30 min", bold_label=True)
doc.add_paragraph()

# M-COM2
h2(doc, "M-COM2 — Génération d'un plan de redistribution par IA  (mutualisé Pharmacien + Superviseur)")
info_box(doc, "⟳ Ce module est organisé en session conjointe avec le groupe Superviseur.")
p = doc.add_paragraph()
p.add_run("Objectif pédagogique : ").bold = True
p.add_run("L'acteur génère un plan de redistribution, comprend les propositions de l'IA, "
          "identifie les cas de fallback manuel et sait interpréter le résultat.")
doc.add_paragraph()
h4(doc, "Contenu — Pré-requis avant génération")
bullet(doc, "Vérifier que les états de stock de la période sont à l'état SOUMIS")
bullet(doc, "Sélectionner le programme et la période visés")
doc.add_paragraph()
h4(doc, "Contenu — Lancement de la génération")
bullet(doc, "Déclenchement de la génération IA — indicateur de chargement pendant l'appel API")
critiq(doc, "L'IA ne lit jamais les dates de péremption depuis sa propre réponse — "
            "elles sont toujours issues des données saisies par le Gestionnaire (principe FEFO).")
doc.add_paragraph()
h4(doc, "Contenu — Lecture du plan généré")
bullet(doc, "Structure d'un plan : entête (période, programme, statut) + liste de lignes (source → destination, produit, quantité)")
bullet(doc, "Logique de la règle R1 : une source ne cède que ce qui dépasse son seuil de sécurité MSD")
bullet(doc, "Lignes en statut BROUILLON : non encore validées")
critiq(doc, "Stock disponible dynamique : la quantité affichée pour une source se réduit au fur et à mesure "
            "que des lignes du même plan lui sont affectées.")
doc.add_paragraph()
h4(doc, "Contenu — Cas de fallback IA")
critiq(doc, "Si l'API IA est indisponible, le système bascule en mode manuel — un plan vide est créé, "
            "l'acteur doit saisir les lignes manuellement.")
bullet(doc, "Identifier le mode actif : message informatif affiché en haut du formulaire")
bullet(doc, "Saisie manuelle d'une ligne : sélection source, destination, produit, quantité — "
            "même règle de stock disponible dynamique s'applique")
doc.add_paragraph()
h4(doc, "Contenu — Ajustement avant validation")
bullet(doc, "Modifier une quantité proposée par l'IA sur une ligne BROUILLON")
bullet(doc, "Supprimer une ligne non pertinente")
bullet(doc, "Ajouter une ligne manuelle complémentaire")
doc.add_paragraph()
h4(doc, "Modalité")
body(doc, "Exercice complet en deux passes : (1) génération nominale avec IA active, "
          "(2) simulation de fallback avec saisie manuelle de 2 lignes.")
duree_line(doc, "Durée", "2 h", bold_label=True)
doc.add_paragraph()

# MP3
h2(doc, "MP3 — Suivi et pilotage des plans  (Pharmacien de région)")
p = doc.add_paragraph()
p.add_run("Objectif pédagogique : ").bold = True
p.add_run("L'acteur suit l'avancement des plans qu'il a générés, identifie les lignes en retard "
          "et comprend le cycle de vie complet d'un plan jusqu'à sa clôture.")
doc.add_paragraph()
h4(doc, "Contenu")
bullet(doc, "Vue liste des plans : filtrage par statut, période, programme")
bullet(doc, "Cycle de vie d'un plan : BROUILLON → VALIDE → EN_COURS → CLOTURE")
bullet(doc, "Statut d'une ligne : EN_ATTENTE, EXECUTE, PARTIEL, ANNULE")
critiq(doc, "La clôture automatique d'un plan intervient seulement quand toutes les lignes sont EXECUTE. "
            "Si une ligne reste EN_ATTENTE ou PARTIEL, le plan ne se clôture pas automatiquement.")
bullet(doc, "Identifier les plans bloqués (ligne PARTIEL non finalisée)")
bullet(doc, "Actions disponibles en phase de suivi selon les droits du Pharmacien")
doc.add_paragraph()
h4(doc, "Modalité")
body(doc, "Lecture commentée de 3 scénarios de plans simulés (plan clôturé, plan avec PARTIEL bloquant, plan abandonné).")
duree_line(doc, "Durée", "1 h", bold_label=True)
doc.add_paragraph()

# Synthèse Pharmacien
h2(doc, "Synthèse Pharmacien de région")
synthese_table(doc,
    rows=[
        ("M0 — Interface commune (mutualisé)",                 "30 min"),
        ("MP1 — Prise en main de l'espace Pharmacien",         "45 min"),
        ("M-COM1 — Consultation des stocks (mutualisé)",       "1 h"),
        ("MP2 — Paramétrage du seuil de stock de sécurité",    "30 min"),
        ("M-COM2 — Génération plan IA (mutualisé)",            "2 h"),
        ("MP3 — Suivi et pilotage des plans",                  "1 h"),
    ],
    total_row=("Total", "5 h 45")
)
body(doc, "Nombre de jours : 1 journée (base 7 h/j — marge de 1 h 15 pour questions et évaluation).")

# ═══════════════════════════════════════════════════════════════════
# PARCOURS SUPERVISEUR
# ═══════════════════════════════════════════════════════════════════
doc.add_page_break()
h1(doc, "Parcours Superviseur")
body(doc,
     "Périmètre fonctionnel : Consultation des stocks, génération des plans de redistribution, "
     "validation et exécution des lignes, suivi.")
doc.add_paragraph()

# MS1
h2(doc, "MS1 — Prise en main de l'espace Superviseur")
p = doc.add_paragraph()
p.add_run("Objectif pédagogique : ").bold = True
p.add_run("L'acteur identifie ses menus, comprend son positionnement dans le workflow "
          "(valideur / exécuteur) et différencie ses droits de ceux du Pharmacien et du Gestionnaire.")
doc.add_paragraph()
h4(doc, "Contenu")
bullet(doc, "Navigation : tableau de bord, stocks, plans")
bullet(doc, "Lecture du contexte header (région ou périmètre affecté)")
bullet(doc, "Rôle du Superviseur dans le workflow : valider et exécuter les lignes de plans")
critiq(doc, "Un Gestionnaire ne peut pas valider les lignes d'un plan qui le concerne — "
            "seul le Superviseur ou l'administrateur peut le faire sur les plans VALIDE.")
bullet(doc, "Ce que le Superviseur ne peut pas faire : saisie directe, import Excel, paramétrage seuil région")
doc.add_paragraph()
h4(doc, "Modalité")
body(doc, "Démonstration guidée")
duree_line(doc, "Durée", "45 min", bold_label=True)
doc.add_paragraph()

info_box(doc, "⟳ Les modules M-COM1 et M-COM2 sont ensuite suivis en session conjointe avec le "
              "groupe Pharmacien de région (voir sections correspondantes ci-dessus).")
doc.add_paragraph()

# MS2
h2(doc, "MS2 — Validation, exécution et suivi des lignes de plan  (Superviseur)")
p = doc.add_paragraph()
p.add_run("Objectif pédagogique : ").bold = True
p.add_run("L'acteur valide les lignes d'un plan, enregistre les exécutions (totales ou partielles), "
          "gère les cas d'exécution incomplète et comprend les conditions de clôture automatique.")
doc.add_paragraph()
h4(doc, "Contenu — Validation des lignes")
bullet(doc, "Accès au plan en statut BROUILLON : lecture des lignes proposées")
bullet(doc, "Valider une ligne : passage en statut VALIDE — la redistribution est approuvée")
bullet(doc, "Valider l'ensemble du plan si toutes les lignes sont acceptées")
bullet(doc, "Supprimer une ligne VALIDE : possible pour le Superviseur, impossible pour le Gestionnaire")
critiq(doc, "Ne valider que les lignes dont le stock disponible source est confirmé comme suffisant "
            "(vérification du stock affiché dynamiquement).")
doc.add_paragraph()
h4(doc, "Contenu — Exécution des lignes")
bullet(doc, "Marquer une ligne comme EXECUTE : la quantité a été physiquement transférée")
bullet(doc, "Enregistrer une exécution partielle (PARTIEL) : saisir la quantité réellement transférée")
critiq(doc, "Une ligne PARTIEL maintient le plan ouvert — elle doit être finalisée ou clôturée manuellement.")
bullet(doc, "Corriger une exécution partielle : compléter la quantité restante")
doc.add_paragraph()
h4(doc, "Contenu — Clôture")
critiq(doc, "La clôture automatique du plan se déclenche uniquement lorsque toutes les lignes "
            "atteignent EXECUTE. Vérifier qu'aucune ligne n'est restée en EN_ATTENTE ou PARTIEL.")
bullet(doc, "Clôture manuelle si une ligne irrémédiable doit être abandonnée : procédure et impact")
bullet(doc, "Plan clôturé : archivé, plus modifiable")
doc.add_paragraph()
h4(doc, "Contenu — Cas particuliers")
bullet(doc, "Ligne refusée par erreur : comment la supprimer et en recréer une corrective")
bullet(doc, "Plan bloqué par une ligne PARTIEL jamais finalisée : escalade recommandée")
doc.add_paragraph()
h4(doc, "Modalité")
body(doc, "Exercice pratique en 3 étapes : (1) valider toutes les lignes d'un plan fictif, "
          "(2) exécuter certaines lignes dont une en PARTIEL, "
          "(3) finaliser la ligne partielle et vérifier la clôture automatique.")
duree_line(doc, "Durée", "1 h 30", bold_label=True)
doc.add_paragraph()

# Synthèse Superviseur
h2(doc, "Synthèse Superviseur")
synthese_table(doc,
    rows=[
        ("M0 — Interface commune (mutualisé)",            "30 min"),
        ("MS1 — Prise en main de l'espace Superviseur",   "45 min"),
        ("M-COM1 — Consultation des stocks (mutualisé)",  "1 h"),
        ("M-COM2 — Génération plan IA (mutualisé)",       "2 h"),
        ("MS2 — Validation, exécution et clôture",        "1 h 30"),
    ],
    total_row=("Total", "5 h 45")
)
body(doc, "Nombre de jours : 1 journée (base 7 h/j — marge de 1 h 15 pour questions et évaluation).")

# ═══════════════════════════════════════════════════════════════════
# ESTIMATION GLOBALE
# ═══════════════════════════════════════════════════════════════════
doc.add_page_break()
h1(doc, "Estimation globale et hypothèses de calcul")

h2(doc, "Hypothèses")
bullet(doc, "Durée journalière effective : 7 heures (pauses comprises dans la marge, déjeuner non compris)")
bullet(doc, "Format sessions : une session par rôle, acteurs de même rôle regroupés ensemble")
bullet(doc, "Modules M-COM1 et M-COM2 : session conjointe Pharmacien + Superviseur avant séparation en sous-groupes")
bullet(doc, "Module M0 : session plénière tous rôles, ou répété en début de chaque session si groupes séparés")
doc.add_paragraph()

h2(doc, "Scénario A — Sessions séparées par rôle (3 groupes indépendants)")
add_table(doc,
    headers=["Session", "Rôle", "Durée", "Jours"],
    rows=[
        ["Session 1", "Gestionnaire",          "5 h 30", "1 j"],
        ["Session 2", "Pharmacien de région",  "5 h 45", "1 j"],
        ["Session 3", "Superviseur",           "5 h 45", "1 j"],
        ["Total planning formateur", "",       "17 h",   "3 j"],
    ],
    col_widths=[4, 5.5, 3, 2.5]
)

h2(doc, "Scénario B — Session conjointe Pharmacien + Superviseur (recommandé)")
body(doc,
     "Les modules M-COM1 et M-COM2 représentent 3 heures d'exercices pratiques identiques pour "
     "les deux rôles. Les former ensemble réduit le temps formateur et favorise la compréhension "
     "mutuelle des responsabilités.")
doc.add_paragraph()
add_table(doc,
    headers=["Séquence", "Contenu", "Groupe", "Durée"],
    rows=[
        ["Matinée J1",    "M0 + MG1 + MG2 (début)",                         "Gestionnaire",               "3 h"],
        ["Après-midi J1", "MG2 (fin) + MG3 + MG4",                          "Gestionnaire",               "3 h"],
        ["Matinée J2",    "M0 + M-COM1 + M-COM2 (début)",                   "Pharmacien + Superviseur",   "4 h"],
        ["Après-midi J2", "M-COM2 (fin) + MP1 / MS1 en sous-groupes",       "Pharmacien + Superviseur",   "3 h"],
        ["Matinée J3",    "MP2 + MP3 // MS2 en sous-groupes simultanés",    "Groupes séparés",            "2 h 30"],
    ],
    col_widths=[3, 7.5, 4, 2.5]
)
p = doc.add_paragraph()
r = p.add_run("Total planning formateur (scénario B) : 2,5 jours")
r.bold = True

# ═══════════════════════════════════════════════════════════════════
# TABLEAU RÉCAPITULATIF FINAL
# ═══════════════════════════════════════════════════════════════════
doc.add_page_break()
h1(doc, "Tableau récapitulatif")

table = doc.add_table(rows=6, cols=5)
table.style = "Table Grid"

headers = ["Rôle", "Nb modules propres", "Modules mutualisés", "Durée totale", "Nombre de jours"]
hdr_row = table.rows[0]
for i, h in enumerate(headers):
    bold_cell(hdr_row.cells[i], h, bg="1E40AF", color=RGBColor(0xFF, 0xFF, 0xFF))
    hdr_row.cells[i].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER

data = [
    ("Gestionnaire",           "4  (MG1–MG4)",        "M0",                  "5 h 30",  "1 j"),
    ("Pharmacien de région",   "3  (MP1, MP2, MP3)",   "M0, M-COM1, M-COM2", "5 h 45",  "1 j"),
    ("Superviseur",            "2  (MS1, MS2)",        "M0, M-COM1, M-COM2", "5 h 45",  "1 j"),
    ("Global — Scénario A",    "9 propres + 3 mutualisés", "—",             "~17 h",   "3 j"),
    ("Global — Scénario B",    "idem",                 "sessions conjointes PHARM+SUPER", "~14 h formateur", "2,5 j"),
]

bg_colors = [None, None, None, GRIS_FOND, VERT_FOND]

for r_idx, (row_data, bg) in enumerate(zip(data, bg_colors)):
    row = table.rows[r_idx + 1]
    for c_idx, val in enumerate(row_data):
        cell = row.cells[c_idx]
        if bg:
            bold_cell(cell, val, bg=bg)
        else:
            cell.text = val
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9.5)
        cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER if c_idx >= 1 else WD_ALIGN_PARAGRAPH.LEFT

col_widths = [4, 3.5, 4, 2.8, 2.7]
for row in table.rows:
    for i, w in enumerate(col_widths):
        row.cells[i].width = Cm(w)

doc.add_paragraph()

# Note de bas de page
p   = doc.add_paragraph()
run = p.add_run("Note : ")
run.bold = True
p.add_run(
    "Ce plan de formation est conçu pour être utilisé comme base de conception des supports "
    "(diaporamas, fiches exercices, jeux de données fictifs). Chaque module peut être "
    "développé indépendamment. Les règles critiques signalées (⚠) doivent impérativement "
    "faire l'objet d'une mise en situation pratique et d'une vérification en évaluation finale."
)
p.runs[-1].italic = True

# ── Sauvegarde ──────────────────────────────────────────────────────────────
doc.save(OUTPUT_PATH)
print(f"Fichier généré : {OUTPUT_PATH}")
