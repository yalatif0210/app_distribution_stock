# Journal des versions

Numérotation [SemVer](https://semver.org/lang/fr/) : MAJEUR.MINEUR.CORRECTIF.
Le numéro est porté par `backend/pom.xml`, `frontend/package.json`, le tag git `vX.Y.Z`
et l'étiquette des images Docker (`VERSION` dans `.env`).

## [1.1.0] - 2026-11-18

### Ajouté
- Gabarits Excel téléchargeables pour l'Import Géo et l'Import Catalogue : en-têtes exacts,
  listes déroulantes (types de structure, unités), longueurs contrôlées, mode d'emploi et
  rappel du référentiel existant. Aucune ligne d'exemple dans la feuille importée.
- Gabarit de saisie des stocks enrichi : colonnes produit protégées, stock et CMM positifs,
  date de péremption future contrôlée dans Excel, mode d'emploi.

### Corrigé
- Import Géo : un type vide créait la valeur inconnue « CS » (désormais CENTRE_SANTE) ;
  type invalide ou code trop long signalés ligne par ligne.
- Import des stocks : un onglet supplémentaire faisait rejeter le fichier ; un code produit
  présent dans deux programmes faisait échouer l'import (recherche dans le programme importé).

## [1.0.0] - 2026-11-18

Première version en production : https://redistribution.lhspla-ci.org

### Redistribution
- Sources éligibles selon le seuil de sécurité de la région : tout site au-dessus du
  seuil, stocks dormants, et exception péremption (la part d'un lot qui périmera avant
  d'être consommée peut être cédée sous le seuil).
- Quantité cessible calculée et imposée par le serveur, y compris sur les propositions
  de l'IA.
- Choix du mode avant la génération : analyse IA ou répartition manuelle ; bascule
  automatique en manuel si l'IA n'est pas configurée ou ne répond pas.
- Écran de répartition manuelle : sites en tension à gauche (quantité, une ou plusieurs
  sources), sources à droite (cessible, reste, péremption), enregistrement automatique,
  annulation d'un mouvement depuis le tableau du plan.
- Un seul brouillon par période, programme et région : reprendre ou remplacer.
- Seuils des statuts de stock administrables par l'admin.

### Rôles et périmètres
- Pharmacien de région : sa région ; gestionnaire : sa structure ; superviseur : ses
  régions, en lecture seule.

### Fiabilité
- Idempotence des écritures : clé UUID par action, unicités en base, verrous,
  validation et soumission rejouables, doublons refusés avec un message clair.
- Relances et alertes non empilées ; suppression d'un plan validé possible.

### Exploitation
- Déploiement derrière le nginx de l'hôte (`docker-compose.proxy.yml`), HTTPS par
  certbot ; en-têtes `X-Forwarded-*` pris en compte.
- Aucune donnée d'exemple en production ; archive de déploiement en liste blanche.
- Sauvegarde quotidienne de la base avec rétention de 14 jours.
