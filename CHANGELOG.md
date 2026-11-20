# Journal des versions

Numérotation [SemVer](https://semver.org/lang/fr/) : MAJEUR.MINEUR.CORRECTIF.
Le numéro est porté par `backend/pom.xml`, `frontend/package.json`, le tag git `vX.Y.Z`
et l'étiquette des images Docker (`VERSION` dans `.env`).

## [1.4.0] - 2026-11-20

### Modifié
- Saisies (superviseur, admin) : on choisit d'abord la région, puis l'une de ses dates RAS,
  avec leur statut, sur les écrans États de stock et Complétude. « Toutes mes régions »
  propose les dates communes ; une région unique est choisie d'office. États de stock
  affiche la région de chaque état.
- Chargements : un voile avec un spinner se pose par-dessus la page au lieu de remplacer
  son contenu ; l'écran ne saute plus à chaque changement. Les enregistrements automatiques
  et le compteur de notifications restent discrets.

### Ajouté
- **Réceptions** : le site destinataire confirme ce qu'il reçoit (quantité, date, observation),
  en une ou plusieurs fois ; la somme devient la quantité exécutée. Une réception peut être close
  avec un écart motivé (casse, péremption, manquant, autre). Le site est prévenu à la validation
  du plan, le pharmacien à chaque réception. La saisie du pharmacien passe par les mêmes règles :
  plus de quantité supérieure à la quantité prévue (migration `V16`).
- Statistiques : **délais d'exécution par région** sur une année (délai d'un plan, d'un
  mouvement, plans en cours, quantités reçues, écarts), avec une ligne de référence pour
  l'ensemble des régions et l'évolution mois par mois. Les délais partent désormais de la date
  de réception.

### Corrigé
- États de stock : la pagination et le tri du tableau des résultats ne fonctionnaient pas.

## [1.3.1] - 2026-11-20

### Corrigé
- Tableau de bord : le superviseur et l'admin voient la région de chaque période et de chaque
  plan dans les listes, et un bandeau identifie le plan affiché (région, programme, période,
  statut, validation, mode de construction).
- Plus aucun tiret cadratin dans le code, les libellés, les prompts IA et la documentation.

## [1.3.0] - 2026-11-19

### Ajouté
- Tableau de bord, onglet **Synthèses** : carte des statuts sites × produits (avant / après),
  dispersion des MSD entre sites (boîtes à moustaches), péremptions évitées et lots à risque,
  alerte précoce des ruptures à venir, ruptures et surstocks chroniques, fiabilité d'exécution
  par site source, flux entre districts. Chaque analyse a une explication, une **lecture** et
  des actions **« À faire »** calculées par règles.
- **Barèmes des synthèses** réglables par l'administrateur (Paramètres), migration `V15`.
- Graphique MSD « en haltères » avec le seuil de sécurité, barres à 100 % de tous les produits
  (onglet Proportions), courbes de tendance sur les cartes, encart « Ce que montre ce
  graphique » sous chaque graphique.
- Manuels et guide des indicateurs mis à jour.

### Corrigé
- Badges « BIEN_STOCKE » et « STOCK_DORMANT » sans couleur dans le tableau de l'onglet MSD.

## [1.2.0] - 2026-11-19

### Ajouté
- **Statistiques** des plans validés sur une plage de dates (date de validation), par région,
  pour le périmètre d'un superviseur ou au niveau national (admin) : plans, mouvements, taux
  d'exécution, délais, ruptures résorbées, détail par région, programme, mois et produit, sites
  les plus sollicités. Export **Excel** et **PDF**.
- Tableau de bord : choix de la base « après » le plan, **théorique** (quantités prévues) ou
  **exécutée** (quantités livrées) ; camemberts de proportions par produit ; disponibilité en
  sites avec stock / sites gérant le produit ; progression annuelle sur douze mois avec le
  programme comparé.
- Suivi des plans : **impression** d'un plan ou de tous les plans d'une période (A4, visas),
  pagination de la liste.
- États de stock : bouton pour **rouvrir** un état soumis par erreur.
- **Manuels utilisateur** par rôle et guide de calcul des indicateurs (`docs/manuels`), en
  Markdown et en PDF (`scripts/manuels-pdf.py`).

### Modifié
- Indicateurs : « sites dégradés » remplacé par « sources sollicitées » et « passés sous le
  seuil » ; indice de risque ramené à une moyenne de 0 à 3 ; couverture du programme
  redéfinie en produits sans aucun site en rupture.
- Évolution MSD limitée aux sites ayant participé au plan ; ruptures limitées aux produits
  concernés ; « Normal » devient « Bien stocké ».
- Listes de programmes limitées aux programmes gérés sur au moins un site de la région (ou par
  le site pour un gestionnaire).

### Corrigé
- Compteur n/m des plans toujours à 0/0 dans la liste du suivi.
- Graphiques des onglets du tableau de bord vides (construits avant l'ouverture de l'onglet) ;
  progression annuelle effacée par « Analyser ».
- Site sans consommation compté « en rupture » après le plan alors qu'il garde du stock.
- Session ancienne : le profil (région, structure, rôle) est relu à l'ouverture de l'application.

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
