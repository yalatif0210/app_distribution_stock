# Manuel de l'administrateur

Vous administrez l'application pour **toutes les régions** :
- le référentiel : régions, districts, sites, programmes, produits ;
- les comptes des utilisateurs ;
- les seuils de statut.

Vous avez aussi la vue **nationale** des plans et des statistiques.

## Le menu

- **Tableau de bord** : effet d'un plan, toutes régions.
- **Analyse** : États de stock.
- **Plans** : Suivi des plans, Statistiques.
- **Administration** : Référentiel, Base de données, Paramètres région.

## 1. Le référentiel

**Administration → Référentiel** : un onglet par type d'élément. Vous pouvez y créer, modifier et supprimer.

| Élément | À savoir |
|---|---|
| Régions | le nom est unique |
| Districts | rattachés à une région ; nom unique dans la région |
| Sites (structures) | code unique de 20 caractères au plus ; type : HOPITAL, CENTRE_SANTE, DISPENSAIRE ou DEPOT ; un site inactif disparaît des listes |
| Programmes | code unique |
| Produits | rattachés à un programme ; code unique dans le programme |

Un doublon est refusé avec un message explicite.

### Imports Excel

Les boutons **Import Géo** et **Import Catalogue** chargent un fichier Excel. Sous chaque bouton, **« Télécharger le gabarit »** fournit le fichier à remplir :
- la feuille à remplir, avec les bons en-têtes et sans ligne d'exemple ;
- des listes déroulantes, par exemple pour le type de site ;
- un onglet **Mode d'emploi** ;
- un onglet avec le **référentiel existant**, pour reprendre l'orthographe exacte et éviter les doublons.

**Import Géo** : région, district, nom du site (obligatoires), puis code et type. Les régions et districts absents sont créés. Un site est retrouvé par son code, ou à défaut par son nom dans le district : il est alors mis à jour, sinon créé.

**Import Catalogue** : programme et produit (obligatoires), puis codes et unité. Renseignez le **code produit** : c'est lui qu'utilisent les gabarits de saisie des stocks.

Après chaque import, un message indique les éléments créés et mis à jour, ainsi que les lignes en erreur avec leur motif.

### Les utilisateurs

Onglet **Utilisateurs** : identifiant, mot de passe, nom, rôle, puis le rattachement, qui dépend du rôle :

| Rôle | Rattachement | Voit |
|---|---|---|
| Gestionnaire | **un site** (liste avec recherche) | son site |
| Pharmacien de région | **une région** | les sites de sa région |
| Superviseur | **une ou plusieurs régions** | ses régions, en lecture seule |
| Administrateur | aucun | tout |

Un compte désactivé ne peut plus se connecter.

## 2. Les paramètres

**Administration → Paramètres région** :
- **Seuil de sécurité d'une région** : choisissez la région, puis le nombre de mois de stock qu'un site expéditeur doit garder. Le pharmacien de région peut aussi le régler pour sa région.
- **Seuils des statuts de stock**, communs à toutes les régions : tension, à surveiller, surstock (1, 2 et 4 mois par défaut). Ils colorent les écrans et alimentent les proportions. À l'enregistrement, le statut de **toutes les saisies existantes**, périodes passées comprises, est recalculé.
- **Barèmes des synthèses**, communs à toutes les régions : ils fixent à partir de quand l'onglet « Synthèses » du tableau de bord juge un résultat bon ou mauvais, et donc ses encadrés « Lecture » et « À faire ». Ils ne modifient aucune donnée ni aucun plan. Valeurs par défaut :
    - équilibrage net à partir de 20 % de resserrement, modéré à partir de 5 % ;
    - site fragile à partir de 30 % de produits en tension ou rupture ;
    - horizon d'alerte de 30 jours ;
    - 3 périodes examinées, chronique à partir de 3 fois ;
    - fiabilité bonne à partir de 90 % livré, faible sous 60 % ;
    - retard au-delà de 14 jours.

Voir le [guide des indicateurs](indicateurs.md#statut-du-stock) et, pour les barèmes, [l'onglet Synthèses](indicateurs.md#g-longlet-syntheses).

## 3. Les plans

**Plans → Suivi des plans** : les plans validés et clôturés de toutes les régions, avec impression d'un plan ou d'une période. Vous seul pouvez **supprimer un mouvement ou un plan déjà validé**. Faites-le avec précaution, l'opération est définitive.

**Tableau de bord** et **Analyse → États de stock** : mêmes écrans que le pharmacien de région, pour toutes les régions.

## 4. Les statistiques nationales

**Plans → Statistiques** : choisissez une plage de **dates de validation**.
- Le niveau **« National »** couvre toutes les régions, avec un tableau **« Par région »** pour les comparer.
- Choisissez une région pour la regarder seule.

Exports **Excel** (un onglet par tableau) et **PDF**.

## 5. Base de données

**Administration → Base de données** : accès direct aux tables (périodes, états, utilisateurs…) pour des corrections ponctuelles. Préférez les écrans métier, qui contrôlent les règles de gestion.

## Bonnes pratiques

- Changez le mot de passe du compte `admin` dès la première connexion.
- N'ajoutez jamais de données de démonstration en production.
- Avant une modification massive par import, téléchargez le gabarit : son onglet « référentiel existant » sert aussi de sauvegarde lisible de l'existant.

Le calcul de chaque indicateur est détaillé, avec des exemples, dans le [guide des indicateurs](indicateurs.md).
