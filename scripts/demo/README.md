# Jeu de démonstration « Région Démo » et « Région Démo Est »

Données fictives pour tester et présenter l'application de bout en bout, en local. À supprimer
avant toute mise en service réelle ; jamais chargées en production.

```sh
scripts/demo.sh charger     # (re)charge le jeu ; refusé hors environnement local
scripts/demo.sh supprimer   # supprime le jeu et tout ce qui a été créé dedans
```

Les deux commandes demandent de taper `DEMO`. Tout passe en une transaction : en cas
d'erreur, la base reste telle quelle. Recharger remet le jeu à zéro (vos plans, saisies et
périodes de test dans les deux régions de démonstration sont effacés).

Les dates sont calculées depuis le jour du chargement : périodes M-5 à M (mois en cours),
lots qui périment dans 15 jours, 1 mois, etc. Rechargez le jeu le jour d'une démonstration.

Ouvrez l'application par **http://localhost:8086** : une autre adresse (127.0.0.1, nom du
poste) est refusée par le contrôle d'origine du serveur pour les enregistrements.

## Comptes (mot de passe `Admin@2024`)

| Compte | Rôle | Rattachement |
|---|---|---|
| `demo_admin` | Administrateur | National |
| `demo_pharmacien` | Pharmacien de région | Région Démo |
| `demo_pharmacien_est` | Pharmacien de région | Région Démo Est |
| `demo_superviseur` | Superviseur (lecture seule) | Région Démo et Région Démo Est |
| `demo_gest_chr` | Gestionnaire | Centre hospitalier régional Démo |
| `demo_gest_dep` | Gestionnaire | Dépôt régional Démo |
| `demo_gest_fia` | Gestionnaire | CSB Fiadanana |
| `demo_gest_amb` | Gestionnaire | CSB Ambatomena |
| `demo_gest_ant` | Gestionnaire | CSB Antsahabe |
| `demo_gest_mah` | Gestionnaire | CSB Mahasoa |
| `demo_gest_tan` | Gestionnaire | CSB Tanambao |
| `demo_gest_ank` | Gestionnaire | Dispensaire Ankadibe |
| `demo_gest_est_chr` | Gestionnaire | Centre hospitalier Est Démo |
| `demo_gest_est_amr` | Gestionnaire | CSB Ambodirano |
| `demo_gest_est_mav` | Gestionnaire | CSB Mahavelo |
| `demo_gest_est_ats` | Gestionnaire | Dispensaire Antsiraka |

## Contenu

- **Région Démo**, seuil de sécurité 2 mois ; 3 districts ; 9 sites dont le CSB Vohitra,
  inactif (il n'apparaît pas dans les listes).
- **Région Démo Est**, seuil de sécurité 2,5 mois ; 2 districts ; 4 sites, chacun calqué sur
  un site de la Région Démo à une autre échelle.
- **3 programmes** : DEMO-PALU, DEMO-PF, DEMO-SMI ; 13 produits.
- **Produits non suivis** par certains sites : le dépôt ne suit ni l'ACT enfant, ni les
  TDR, ni la pilule, ni la santé maternelle ; l'implant n'est suivi que par le CHR, le
  dépôt, Fiadanana, Ambatomena et deux sites de l'Est ; l'hôpital ne suit pas l'amoxicilline.
- **6 périodes par région** : M-5 à M-1 fermées, tout soumis, avec leurs plans ; M ouverte.
- **26 plans** : clôturés quand tout est reçu, validés et en cours sinon (M-1 : une ligne
  reçue en partie, des lignes en attente depuis plus de 14 jours) ; un plan de la Région
  Démo marqué « généré par l'IA » avec son résumé (M-3, paludisme) ; un brouillon pour la
  période en cours de la Région Démo Est.
- **42 réceptions** confirmées par les sites : les livraisons de 500 et plus arrivent en deux
  fois ; deux réceptions closes avec un écart (casse sur le fer à Mahasoa en M-3, manquant
  sur l'ocytocine au CHR Est en M-3).
- **Délais d'exécution** : 4 à 12 jours dans la Région Démo (moyenne 8,4), 19 à 35 jours
  dans la Région Démo Est (moyenne 26,5) : le comparatif des statistiques le montre.
- **Chroniques** : TDR à Tanambao, fer à Mahasoa et ASAQ adulte à Antsiraka en rupture
  chaque mois ; préservatifs en surstock chaque mois.

## Scénarios de la période en cours

| Produit | Ce qu'on teste |
|---|---|
| ACT adulte | Redistribution **possible** avec les trois sortes de sources : surstock (CHR, cède 400), stock dormant (dépôt, cède 300), site « bien stocké » au-dessus du seuil (Fiadanana, MSD 3, cède 50). Trois cibles. |
| ACT enfant | Sources **insuffisantes** ; Tanambao pile au seuil (MSD 2) ne cède rien. |
| TDR | Sites en tension mais **aucune source** : diagnostic affiché. |
| SP | Aucun site en tension : le produit n'apparaît pas. |
| Artésunate | **Exception péremption** : le CHR (MSD 2,25, lot périmé dans 1 mois) cède 50 au lieu de 10. Ambatomena, en tension et dont le lot périme dans 15 jours, est **à la fois cible et source**. |
| DMPA | Deux ruptures, un gros surstock, un stock dormant. |
| Pilule | Une seule source, juste au-dessus du seuil. |
| Implant | Seule source : le stock dormant du dépôt. |
| Préservatifs | Surstock partout, aucune tension. |
| Ocytocine | Rupture à l'hôpital, trois centres de santé peuvent céder ; Mahasoa pile au seuil. |
| Sulfate de magnésium | Source « à surveiller » (MSD 1,67) qui cède sous le seuil car son lot périme dans 20 jours. |
| Fer | Grandes quantités (milliers d'unités). |
| Amoxicilline | Produit non suivi par l'hôpital. |

**Complétude** de la période en cours :
- Dispensaire Ankadibe : paludisme en cours de saisie (non soumis), santé maternelle pas
  commencée ;
- CSB Tanambao : planification familiale en cours de saisie (non soumise).

Les saisies non soumises n'entrent pas dans l'analyse : Ankadibe et Tanambao n'apparaissent
ni en source ni en cible sur ces programmes tant qu'ils n'ont pas soumis.

**Notifications** : transferts en attente pour les gestionnaires des sites sources du mois
précédent, relances de saisie non lues pour Ankadibe et Tanambao, une relance déjà lue pour
Ambatomena.

## Parcours de test suggéré

1. `demo_gest_ank` : terminer et soumettre la saisie paludisme, puis saisir la santé maternelle.
2. `demo_pharmacien` : suivre la complétude, relancer un site, puis générer le plan du mois
   pour chaque programme (répartition manuelle), valider.
3. `demo_gest_amb` : confirmer la réception des TDR du plan paludisme de M-1, en deux fois,
   la seconde avec un écart.
4. `demo_pharmacien` : tableau de bord et synthèses du plan paludisme de M-1 (ruptures
   chroniques, fiabilité), progression annuelle.
5. `demo_superviseur` : vérifier la lecture seule, la vue sur deux régions et le comparatif
   des délais dans les statistiques.
6. `demo_admin` : référentiel, gabarits d'import, seuils de statut, barèmes des synthèses,
   statistiques nationales.
