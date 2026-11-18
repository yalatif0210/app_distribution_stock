# Jeu de démonstration « Région Démo »

Données fictives pour tester l'application de bout en bout, en local. À supprimer avant
toute mise en service réelle.

```sh
scripts/demo.sh charger     # (re)charge le jeu ; refusé hors environnement local
scripts/demo.sh supprimer   # supprime le jeu et tout ce qui a été créé dedans
```

Les deux commandes demandent de taper `DEMO`. Tout passe en une transaction : en cas
d'erreur, la base reste telle quelle. Recharger remet le jeu à zéro (vos plans, saisies et
périodes de test dans la Région Démo sont effacés).

Les dates sont calculées depuis le jour du chargement : périodes M-2, M-1 et M (mois en
cours), lots qui périment dans 15 jours, 1 mois, etc. Rechargez le jeu si vous testez
longtemps après.

## Comptes (mot de passe `Admin@2024`)

| Compte | Rôle | Rattachement |
|---|---|---|
| `demo_pharmacien` | Pharmacien de région | Région Démo |
| `demo_superviseur` | Superviseur (lecture seule) | Région Démo + la première région existante |
| `demo_gest_chr` | Gestionnaire | Centre hospitalier régional Démo |
| `demo_gest_dep` | Gestionnaire | Dépôt régional Démo |
| `demo_gest_fia` | Gestionnaire | CSB Fiadanana |
| `demo_gest_amb` | Gestionnaire | CSB Ambatomena |
| `demo_gest_ant` | Gestionnaire | CSB Antsahabe |
| `demo_gest_mah` | Gestionnaire | CSB Mahasoa |
| `demo_gest_tan` | Gestionnaire | CSB Tanambao |
| `demo_gest_ank` | Gestionnaire | Dispensaire Ankadibe |

## Contenu

- **Région Démo**, seuil de sécurité 2 mois ; 3 districts ; 9 sites dont le CSB Vohitra,
  inactif (il n'apparaît pas dans les listes).
- **3 programmes** : DEMO-PALU, DEMO-PF, DEMO-SMI ; 13 produits.
- **Produits non suivis** par certains sites : le dépôt ne suit ni l'ACT enfant, ni les
  TDR, ni la pilule, ni la santé maternelle ; l'implant n'est suivi que par le CHR, le
  dépôt, Fiadanana et Ambatomena ; l'hôpital ne suit pas l'amoxicilline.
- **M-2** (fermée) : tout est soumis, trois plans clôturés.
- **M-1** (fermée) : tout est soumis ; plans paludisme et PF validés et en cours
  d'exécution (une ligne exécutée, une partielle, des lignes en attente depuis plus de
  14 jours), plan santé maternelle clôturé.
- **M** (ouverte) : la période à traiter, sans plan.

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
3. Gestionnaires des sites sources : enregistrer les exécutions ; voir la clôture automatique
   du plan et de la période.
4. `demo_superviseur` : vérifier la lecture seule et la vue sur deux régions.
5. `admin` : modifier les seuils de statut ou le seuil de sécurité de la région et voir
   l'effet sur les sources proposées.
