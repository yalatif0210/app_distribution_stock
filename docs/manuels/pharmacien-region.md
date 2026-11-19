# Manuel du pharmacien de région

Vous pilotez la redistribution des produits entre les sites de **votre région**. Chaque mois, vous :
- ouvrez la période ;
- suivez les saisies des sites ;
- construisez le plan de redéploiement ;
- le validez ;
- enregistrez son exécution ;
- mesurez son effet.

Vous voyez tous les sites de votre région, et seulement eux.

## Le menu

- **Tableau de bord** : effet d'un plan sur les stocks.
- **Saisies** : Périodes, États de stock, Complétude, Programmes.
- **Redistribution** : Générer un plan, Suivi des plans, Statistiques.
- **Paramètres** : seuil de sécurité de votre région.

## 1. Préparer la région (une fois, puis au besoin)

**Saisies → Programmes** : indiquez quels programmes chaque site suit. Seuls ces programmes sont proposés dans les écrans de saisie, de suivi et d'analyse.

**Paramètres** : réglez le **seuil de sécurité** de la région, entre 0,5 et 12 mois (2 par défaut). C'est le nombre de mois de stock qu'un site expéditeur doit toujours garder. Le système refuse toute redistribution qui le ferait passer en dessous, sauf pour la part d'un lot qui périmera avant d'être consommée. Le calcul est détaillé dans le [guide des indicateurs](indicateurs.md#seuil-de-sécurité-de-la-région-et-quantité-cessible).

## 2. Ouvrir une période et suivre les saisies

**Saisies → Périodes** : créez la période du mois avec sa **date d'état de stock** (RAS). Vous pouvez ensuite la fermer ou la rouvrir. Elle se ferme aussi d'elle-même quand chaque programme suivi dans la région a un plan validé.

**Saisies → Complétude** : choisissez la période et le programme pour voir le **taux de complétude** et la liste des sites qui n'ont pas soumis leur état. Le bouton **Relancer** leur envoie une notification. Une même relance n'est pas renvoyée tant que la précédente n'est pas lue.

**Saisies → États de stock** : consultez l'état de chaque site. Un état soumis par erreur peut être **rouvert** pour que le site le corrige.

## 3. Construire le plan de redéploiement

**Redistribution → Générer un plan**

1. Choisissez la **période** et le **programme**.
2. Choisissez le **mode** :
   - **Analyse IA** : l'IA propose un plan complet, que vous révisez ligne par ligne. Si l'IA n'est pas configurée ou ne répond pas, le plan passe automatiquement en répartition manuelle, et un message vous l'indique.
   - **Répartition manuelle** : vous répartissez vous-même, produit par produit.
3. Lancez.

Un seul **brouillon** existe par période, programme et région. Si un brouillon existe déjà, l'application vous propose de le **reprendre** (choix par défaut) ou de le **remplacer**.

### La répartition manuelle

- **En haut**, la liste des produits en tension sur au moins un site, avec ‹ › pour passer de l'un à l'autre. À côté : besoin total, quantité répartie, quantité encore cessible.
- **À gauche**, les **sites en tension ou en rupture**, les plus critiques d'abord. Pour chacun : saisissez une **quantité** et choisissez une **source**. Le MSD après réception s'affiche. **« + Ajouter une source »** permet de servir un site depuis plusieurs expéditeurs.
- **À droite**, les **sources possibles**, les lots qui périment le plus tôt en premier : quantité cessible, **reste** et date de péremption. Le reste baisse à chaque saisie. Une source épuisée devient grise.
- Chaque ligne est **enregistrée automatiquement**. Vider une quantité supprime le mouvement.
- Dans le tableau « Mouvements saisis » en bas, **Annuler** retire un mouvement du plan.

Sont proposés comme sources :
- les sites dont le MSD dépasse le seuil de sécurité de la région ;
- les stocks dormants ;
- les lots qui périmeront avant d'être consommés.

### Valider

Quand le plan est complet, cliquez sur **Valider le plan**. Il n'est plus modifiable. Les sites expéditeurs reçoivent une notification « transfert à réaliser ».

## 4. Enregistrer l'exécution

**Redistribution → Suivi des plans**

Ouvrez le plan, puis **Mettre à jour** sur chaque mouvement, et saisissez la **quantité réellement livrée** :
- égale ou supérieure à la quantité prévue : le mouvement passe en **Exécuté** ;
- inférieure : il passe en **Partiel**.

Quand tous les mouvements sont exécutés ou annulés, le plan est **clôturé** automatiquement.

**Impression** :
- l'icône 🖨 d'un plan l'imprime seul ;
- **« Imprimer les plans de la période »** imprime tous les plans validés de la période choisie, un par page, au format A4 paysage, avec les colonnes de visas et d'observations.

La liste des plans est paginée et filtrable par période, statut ou texte.

## 5. Mesurer l'effet d'un plan

**Tableau de bord** : choisissez la période, le programme et le plan, puis **Analyser**.
- Le sélecteur **« Après le plan »** compare la situation avant le plan à la situation **théorique**, si tout ce qui est prévu était livré, ou **exécutée**, avec ce qui est réellement livré. L'écart entre les deux montre ce qu'il reste à faire.
- Les cartes du haut comparent avant et après le plan : disponibilité, taux bien stockés, indice de risque, score d'impact.
- Les onglets détaillent : évolution du MSD des sites concernés, ruptures, proportions de stockage par produit, disponibilité, exécution et analyses.
- La section **H** montre l'avancement des plans mois par mois sur l'année. Elle suit le programme et la période sélectionnés.

Tous les calculs sont expliqués dans le [guide des indicateurs](indicateurs.md).

## 6. Statistiques de la région

**Redistribution → Statistiques** : choisissez une **plage de dates de validation** et, si besoin, un programme, puis **Calculer**. Vous obtenez :
- les plans, les mouvements, les taux d'exécution, les délais et les ruptures résorbées ;
- le détail par programme, par mois et par produit, et les sites les plus sollicités.

Les boutons **Excel** et **PDF** exportent le tout. Voir le [guide des indicateurs](indicateurs.md#4-les-statistiques-sur-une-période).

## Questions fréquentes

**Un site bien stocké n'apparaît pas comme source.** Son MSD ne dépasse pas le seuil de sécurité de la région. Avec un seuil de 2, un site à 1,8 mois ne cède rien, sauf si son lot va périmer.

**La quantité saisie est refusée.** Elle dépasse ce que la source peut encore céder. Regardez le **reste** dans la colonne de droite.

**Je ne peux plus modifier le plan.** Il est validé. Seul l'administrateur peut supprimer un mouvement ou un plan validé.
