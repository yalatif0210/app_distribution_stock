"""Convertit les manuels Markdown (docs/manuels) en PDF, dans docs/manuels/pdf.

Usage, depuis la racine du projet :   python scripts/manuels-pdf.py [version]
Prérequis : Python avec le module « markdown » (pip install markdown) et Microsoft Edge
ou Google Chrome, utilisé sans affichage pour l'impression PDF.
"""
import datetime, pathlib, re, subprocess, sys, tempfile
import markdown

RACINE = pathlib.Path(__file__).resolve().parent.parent
SOURCE = RACINE / "docs" / "manuels"
SORTIE = SOURCE / "pdf"
VERSION = sys.argv[1] if len(sys.argv) > 1 else "1.2.0"
NAVIGATEURS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/microsoft-edge",
]
NAVIGATEUR = next((n for n in NAVIGATEURS if pathlib.Path(n).exists()), None)

GUIDES = [
    ("gestionnaire.md", "Manuel du gestionnaire de site"),
    ("pharmacien-region.md", "Manuel du pharmacien de région"),
    ("superviseur.md", "Manuel du superviseur"),
    ("administrateur.md", "Manuel de l'administrateur"),
    ("indicateurs.md", "Comment sont calculés les indicateurs"),
]

CSS = """
@page { size: A4; margin: 18mm 16mm 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #0f172a; margin: 0; }
.couverture { height: 245mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
.couverture .sur { color: #4f46e5; font-size: 11pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.couverture h1 { font-size: 28pt; line-height: 1.15; margin: .4em 0 .3em; border: none; }
.couverture .ligne { width: 60mm; height: 3px; background: #4f46e5; margin: 6mm 0; }
.couverture .infos { color: #475569; font-size: 10.5pt; }
h1 { font-size: 19pt; color: #1e1b4b; border-bottom: 2px solid #4f46e5; padding-bottom: 3pt; margin: 0 0 10pt; }
h2 { font-size: 14pt; color: #312e81; margin: 18pt 0 6pt; page-break-after: avoid; }
h3 { font-size: 11.5pt; color: #3730a3; margin: 13pt 0 4pt; page-break-after: avoid; }
p, li { orphans: 3; widows: 3; }
a { color: #4338ca; text-decoration: none; }
code { font-family: Consolas, monospace; font-size: 9.5pt; background: #f1f5f9; padding: 0 3px; border-radius: 3px; }
blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #eef2ff; border-left: 3px solid #4f46e5; border-radius: 3px; page-break-inside: avoid; }
blockquote p { margin: 2pt 0; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0 10pt; font-size: 9.5pt; page-break-inside: avoid; }
th { background: #4f46e5; color: #fff; text-align: left; padding: 4pt 6pt; font-weight: 600; }
td { border: 1px solid #cbd5e1; padding: 4pt 6pt; vertical-align: top; }
tr:nth-child(even) td { background: #f8fafc; }
hr { border: none; border-top: 1px solid #cbd5e1; margin: 16pt 0; }
ul, ol { padding-left: 18pt; }
"""

PUCE = re.compile(r"\s*([-*]|\d+\.) ")


def preparer(texte: str) -> str:
    """Adapte le Markdown des manuels aux exigences de Python-Markdown."""
    # Liens entre guides : .md devient .pdf ; le premier titre passe sur la couverture
    texte = re.sub(r"\]\(([a-z\-]+)\.md(#[^)]*)?\)", lambda m: f"]({m.group(1)}.pdf{m.group(2) or ''})", texte)
    texte = re.sub(r"\A# .*\n", "", texte)
    lignes, prec = [], ""
    for l in texte.split("\n"):
        # Sous-listes indentées de 2 ou 3 espaces : Python-Markdown en attend 4
        l = re.sub(r"^ {2,3}(?=([-*]|\d+\.) )", "    ", l)
        # Une ligne vide est nécessaire avant une liste
        if PUCE.match(l) and prec.strip() and not PUCE.match(prec) and not prec.startswith("  ") and not l.startswith("  "):
            lignes.append("")
        # Lignes consécutives d'une citation : saut de ligne explicite
        if l.startswith("> ") and prec.startswith("> "):
            lignes[-1] += "  "
        lignes.append(l)
        prec = l
    return "\n".join(lignes)


def convertir(fichier: str, titre: str) -> pathlib.Path:
    corps = markdown.markdown(preparer((SOURCE / fichier).read_text(encoding="utf-8")),
                              extensions=["tables", "toc", "sane_lists"])
    date = datetime.date.today().strftime("%d/%m/%Y")
    html = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>{titre}</title>
<style>{CSS}</style></head><body>
<section class="couverture">
  <div class="sur">Redistribution des stocks sanitaires</div>
  <h1>{titre}</h1>
  <div class="ligne"></div>
  <div class="infos">Version {VERSION} de l'application · {date}<br>redistribution.lhspla-ci.org</div>
</section>
<h1>{titre}</h1>
{corps}
</body></html>"""
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html)
        source_html = pathlib.Path(f.name)
    pdf = SORTIE / fichier.replace(".md", ".pdf")
    try:
        subprocess.run([NAVIGATEUR, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                        "--run-all-compositor-stages-before-draw", f"--print-to-pdf={pdf}",
                        source_html.as_uri()], check=True, capture_output=True, timeout=120)
    finally:
        source_html.unlink()
    return pdf


if __name__ == "__main__":
    if NAVIGATEUR is None:
        sys.exit("Aucun navigateur Edge ou Chrome trouvé pour l'impression PDF.")
    SORTIE.mkdir(parents=True, exist_ok=True)
    for fichier, titre in GUIDES:
        pdf = convertir(fichier, titre)
        print(f"{pdf.name:28} {pdf.stat().st_size // 1024:4} Ko")
