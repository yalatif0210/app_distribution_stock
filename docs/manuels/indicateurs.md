# Comment sont calculés les indicateurs

Ce guide explique, avec des exemples chiffrés, chaque nombre affiché par l'application. Les exemples reprennent les chiffres du jeu de démonstration « Région Démo ».

Vocabulaire :
- un **site** est une structure sanitaire (hôpital, centre de santé, dispensaire, dépôt) ;
- un **couple site/produit** est la situation d'un produit dans un site : c'est l'unité de calcul de la plupart des indicateurs ;
- la **CMM** est la consommation moyenne mensuelle saisie par le site ;
- un **mouvement** est une ligne de plan : une quantité d'un produit, d'un site expéditeur vers un site destinataire.

---

## 1. Les indicateurs de stock

### MSD : mois de stock disponible

> **MSD = stock disponible ÷ CMM**

*Exemple* : 300 plaquettes en stock, 100 consommées par mois, soit un MSD de 3. Le site peut tenir 3 mois.

Un site sans consommation (CMM nulle ou vide) n'a pas de MSD. Il est en **stock dormant** s'il a du stock, en **rupture** sinon.

### Statut du stock

Le statut se lit sur le MSD. L'administrateur règle les seuils dans **Paramètres**. Les valeurs par défaut sont :

| Statut | Condition (par défaut) | Exemple |
|---|---|---|
| Rupture | MSD = 0 | 0 en stock |
| Tension | MSD inférieur à 1 | 45 en stock pour 60 par mois : MSD 0,75 |
| À surveiller | MSD de 1 à moins de 2 | 100 pour 60 : MSD 1,67 |
| Bien stocké | MSD de 2 à 4 inclus | 150 pour 50 : MSD 3 |
| Surstock | MSD supérieur à 4 | 600 pour 100 : MSD 6 |
| Stock dormant | CMM nulle, stock positif | 300 en stock, aucune consommation |

Les statuts sont **qualitatifs** : ils colorent les tableaux et alimentent les proportions. Ils ne décident pas quels sites peuvent céder du stock (voir le seuil de sécurité ci-dessous).

### Seuil de sécurité de la région et quantité cessible

Chaque région a un **seuil de sécurité**, réglé par le pharmacien de région dans **Paramètres** (2 mois dans l'exemple). Un site expéditeur doit garder au moins ce nombre de mois de stock.

> **Quantité cessible = stock − (seuil × CMM) − quantités déjà prévues dans le plan**

*Exemple* : 150 en stock, CMM 50, seuil 2. Le site garde 2 × 50 = 100 et peut céder **50**.

Deux cas particuliers :
- **Stock dormant** : tout le stock est cessible, puisqu'aucune consommation n'est à couvrir.
- **Exception péremption** : si le lot périmera avant d'être consommé, la part qui périmera peut être cédée, même sous le seuil.
  > Part périmable = stock − (mois restants avant péremption × CMM)

  *Exemple* : 90 flacons, CMM 40, lot périmé dans 1 mois, seuil 2. Au-dessus du seuil, le site ne pourrait céder que 90 − 80 = 10. Mais il ne consommera que 40 flacons avant la péremption : 90 − 40 = **50** peuvent partir. La quantité cessible est la plus grande des deux, soit 50.

Le système refuse toute quantité supérieure à la quantité cessible, y compris quand c'est l'IA qui la propose.

### Besoin d'un site destinataire

> **Besoin = (seuil « à surveiller » × CMM) − stock**

C'est ce qui manque pour sortir de la tension. *Exemple* : CMM 80, stock 20, seuil « à surveiller » 2, soit 2 × 80 − 20 = **140**. Le besoin sert à classer les priorités. Il ne limite pas la quantité qu'on peut envoyer.

### Complétude de la saisie

> **Taux de complétude = états de stock soumis ÷ états attendus**

Un état est attendu pour chaque site qui suit le programme. *Exemple* : 7 sites suivent la santé maternelle, 6 ont soumis leur état, soit 6 ÷ 7 = **85,7 %**. Le site manquant est listé et peut être relancé.

---

## 2. Le tableau de bord d'un plan

Le tableau de bord compare la situation **avant** le plan (les états de stock soumis) et **après** le plan. Un sélecteur en haut du tableau de bord choisit la base de « après » :
- **Théorique (prévu)** : la situation si toutes les quantités prévues par le plan étaient livrées. C'est ce que le plan doit apporter.
- **Exécuté (réel)** : la situation avec les quantités réellement livrées à ce jour. C'est ce que le plan a apporté.

Pour un plan validé, le tableau de bord s'ouvre sur « Exécuté ». Un brouillon n'a que la base théorique, puisque rien n'y est encore livré. Comparer les deux bases montre ce qu'il reste à exécuter : si le score d'impact théorique est de 3,5 mois et l'exécuté de 2, il manque 1,5 mois de couverture non livrée.

Tous les indicateurs « après » ci-dessous suivent la base choisie.

> **Stock après = stock avant − quantités cédées + quantités reçues**
> **MSD après = stock après ÷ CMM**

*Exemple* : le centre de santé d'Ambatomena a 20 plaquettes pour une CMM de 80 (MSD 0,25, en tension). Il reçoit 120 plaquettes : 140 ÷ 80 = MSD **1,75**, et passe « à surveiller ».

### Taux de disponibilité

> **Disponibilité d'un produit = sites avec un stock supérieur à 0 ÷ sites qui gèrent ce produit**

Un site « gère » un produit quand le produit fait partie de sa sélection. Un site qui le gère sans avoir soumis son état compte comme non disponible : il apparaît en « sans saisie ».

*Exemple* : 7 sites gèrent les tests de diagnostic rapide ; 6 en ont en stock avant le plan, ce qui donne 6/7 = 85,7 %. Après le plan, le site qui était en rupture en a reçu : 7/7 = 100 %.

Le **taux global** additionne tous les produits du programme : total des sites avec stock ÷ total des sites gérant.

### Taux bien stockés

> **Taux bien stockés = couples site/produit au statut « Bien stocké » ÷ couples saisis**

*Exemple* : 40 couples saisis, dont 12 bien stockés avant le plan, soit **30 %**.

### Indice de risque

Chaque couple site/produit reçoit une note : rupture = 3, tension = 2, surstock = 1, autres = 0. L'indice est la **moyenne** de ces notes : de 0 (aucun risque) à 3 (tout en rupture).

*Exemple* : 10 couples, dont 1 en rupture, 2 en tension et 1 en surstock. (3 + 2 + 2 + 1) ÷ 10 = **0,80**. Si le plan résorbe la rupture et une tension, l'indice tombe à (2 + 1) ÷ 10 = **0,30**. Plus bas, c'est mieux.

### Score d'impact global

> **Score d'impact = somme des gains de MSD des couples dont le MSD augmente**

*Exemple* : une cible passe de 0,25 à 1,75 (gain 1,5), une autre de 0 à 2 (gain 2). Score = **3,5 mois** de couverture apportés. Les baisses de MSD des expéditeurs ne sont pas retranchées : elles sont voulues et encadrées par le seuil de sécurité.

### Sites améliorés, sources sollicitées, passés sous le seuil

- **Sites améliorés** : couples site/produit dont le MSD augmente, autrement dit les destinataires servis.
- **Sources sollicitées** : couples site/produit qui ont cédé du stock.
- **Passés sous le seuil** : expéditeurs dont le MSD après le plan est inférieur au seuil de sécurité de la région. Seule l'exception péremption le permet. Un nombre différent de 0 n'est donc pas une erreur, mais mérite un coup d'œil.

### Produits sans rupture (couverture du programme)

> **Produits sans rupture = produits sans aucun site en rupture ÷ produits suivis**

Un produit est « suivi » quand au moins un site a soumis son état de stock pour ce produit. Un produit sans aucun état soumis est écarté, puisqu'on ne sait pas s'il est en rupture.

*Exemple* : un programme de 5 produits, tous suivis. Avant le plan, 3 produits ont au moins un site en rupture : 2 produits sans rupture, soit 2/5 = **40 %**. Le plan résorbe les ruptures de deux d'entre eux : 4/5 = **80 %** après le plan.

### Complétude d'exécution

> **Complétude d'exécution = mouvements exécutés au moins en partie ÷ mouvements du plan**

*Exemple* : 3 mouvements, dont 1 exécuté, 1 partiel et 1 en attente : 2 ÷ 3 = **66,7 %**.

### Les onglets

- **Courbes des cartes** : sous la disponibilité, le taux bien stockés et l'indice de risque, une petite courbe retrace l'indicateur, situation avant plan, sur les dernières périodes de la région (jusqu'à 6). Elle dit si le plan agit sur une situation qui se dégrade ou qui s'améliore déjà.
- **A. Évolution MSD** : MSD avant et après de chaque site qui a participé au plan, comme expéditeur ou destinataire, produit par produit. Le graphique « en haltères » relie, pour chaque couple produit / site, le point avant (gris) au point après : trait vert si le site gagne du stock, rouge s'il en cède. La ligne pointillée marque le seuil de sécurité de la région.
- **B. Ruptures** : pour chaque produit concerné (au moins une rupture avant ou après), le nombre de sites en rupture avant et après. *Exemple* : Ocytocine 1 → 0, la rupture de l'hôpital est résorbée.
- **C. Proportions de stockage** : en haut, des barres à 100 % comparent tous les produits d'un coup (une barre avant et une barre après par produit, découpées par statut) ; en dessous, pour le produit choisi, la répartition des sites par statut avant et après, en deux camemberts. Les stocks dormants sont comptés avec le surstock.
- **D. Disponibilité** : voir le taux de disponibilité ci-dessus.
- **Exécution** : avancement du plan et détail des mouvements.
- **Analytics** : indicateurs composites et top 5 des mouvements à plus fort impact (gain de MSD chez le destinataire).
- **Synthèses** : six analyses approfondies et les flux entre districts, décrits ci-dessous.

Chaque graphique a un encart repliable **« Ce que montre ce graphique »** qui en donne la lecture.

### G. L'onglet Synthèses

Chaque analyse se présente en trois temps : une explication repliable (« Ce que montre cette analyse »), une visualisation, puis deux encadrés produits par le Système :

- **Lecture** : ce qu'il faut retenir, en phrases ;
- **À faire** : les actions conseillées.

Ces textes sont calculés par des **règles fixes**, à partir de **barèmes** réglés par l'administrateur (valeurs par défaut entre parenthèses ci-dessous). Ils suivent la base « après » choisie (théorique ou exécutée).

#### 1. Carte des statuts sites × produits

Un tableau coloré : une ligne par site, une colonne par produit, la couleur du statut dans chaque case et le MSD en chiffre. On bascule entre « avant » et « après » ; les cases encadrées changent de statut avec le plan.

> **Site fragile = site dont au moins X % des produits restent en tension ou en rupture après le plan** (barème « site fragile », 30 %)

*Exemple* : le CSB de Mahasoa gère 5 produits ; après le plan, 2 sont encore en tension. 2 ÷ 5 = 40 %, au moins 30 % : il est signalé fragile, et l'encadré « À faire » propose de vérifier sa CMM et sa dotation. La lecture cite aussi le produit le plus tendu, celui dont la part de sites en tension ou rupture après le plan est la plus forte.

#### 2. Dispersion des MSD entre sites

Pour chaque produit consommé par au moins 3 sites, une **boîte à moustaches** avant et une après :

- les moustaches vont du site le moins stocké au plus stocké ;
- la boîte contient la moitié centrale des sites, du 1er quartile (Q1) au 3e quartile (Q3) ;
- le trait dans la boîte est la médiane.

> **Écart interquartile = Q3 − Q1**
> **Variation = (écart après − écart avant) ÷ écart avant**

Verdict :

- resserrement d'au moins 20 % : **équilibrage net** (barème « équilibrage net ») ;
- resserrement d'au moins 5 % : **équilibrage modéré** (barème « équilibrage modéré ») ;
- élargissement de plus de 5 % : **déséquilibre** ; l'encadré « À faire » propose de revoir les mouvements du produit ;
- entre les deux : **sans effet** ; si un site reste sous 1 mois, l'encadré propose de chercher d'autres sources ;
- écart avant nul : **déjà équilibré**.

*Exemple* : pour l'ASAQ adulte, l'écart passe de 1,6 à 0,8 mois, soit −48 % : équilibrage net.

#### 3. Péremptions évitées et lots à risque

La **quantité périmable** d'un site est la part de son stock qu'il ne consommera pas avant la date de péremption : ce qui dépasse CMM × mois restants. Pour un site qui ne consomme plus le produit (CMM nulle), tout le stock est périmable.

> **Évitée = la plus petite valeur entre la quantité périmable et la quantité cédée par le plan**
> **À risque = quantité périmable − quantité évitée**

*Exemple* : un dépôt a 500 plaquettes qui périment dans 3 mois, pour une CMM de 100. Il en consommera 300 : 200 sont périmables. Le plan lui en fait céder 150 : 150 évitées, 50 encore à risque. L'encadré « À faire » liste les 5 premiers lots à risque, pour leur trouver un destinataire.

#### 4. Alerte précoce : ruptures à venir

> **Jours restants = MSD × 30,4 − jours écoulés depuis la date de l'état de stock**

L'analyse compte les couples site/produit dont les jours restants sont inférieurs à l'horizon (barème « horizon d'alerte », 30 jours), sans le plan puis avec le plan, et liste ceux que le plan ne prévient pas.

*Exemple* : état de stock du 1er octobre, analyse le 19 novembre, 49 jours plus tard. Un site à 2 mois de stock a 2 × 30,4 − 49 = **12 jours** restants : il est en alerte. Au-delà de 45 jours d'ancienneté, la lecture prévient que l'estimation suppose une consommation régulière et qu'un nouvel état est souhaitable.

#### 5. Ruptures et surstocks chroniques

L'analyse examine les dernières périodes de la région (barème « périodes examinées », 3), jusqu'à la période du plan.

- Un couple site/produit en rupture au moins N fois (barème « chronique à partir de », 3) est une **rupture chronique** : ce n'est plus un problème de redistribution, mais de dotation ou de CMM sous-estimée. L'encadré propose de le signaler au programme.
- Un site en surstock ou dormant au moins N fois sur un produit est en **surstock chronique** pour ce produit. Si c'est le cas d'au moins la moitié des sites qui suivent le produit, la dotation est probablement excessive.

*Exemple* : sur les 3 dernières périodes, le CSB d'Ambatomena a été en rupture de tests de diagnostic 3 fois : rupture chronique. Tant que l'historique compte moins de périodes que le barème « chronique à partir de », la lecture indique qu'il est insuffisant.

#### 6. Fiabilité de l'exécution par site source

Sur les plans validés ces 12 derniers mois pour la même région et le même programme, pour chaque site expéditeur :

> **Taux de livraison = moyenne, sur ses mouvements, de (quantité livrée ÷ quantité prévue), chaque mouvement plafonné à 100 %**

- **En retard** : mouvement non terminé plus de 14 jours après la validation du plan (barème « retard ») ;
- **Délai moyen** : jours entre la validation du plan et l'exécution ;
- **Verdict** : fiabilité bonne à partir de 90 %, faible sous 60 %, moyenne entre les deux (barèmes « fiabilité bonne » et « fiabilité faible »).

*Exemple* : le centre hospitalier a 3 mouvements, livrés à 100 %, 100 % et 0 % : (1 + 1 + 0) ÷ 3 = **66,7 %**, fiabilité moyenne. Comme un mouvement est en retard, l'encadré propose de vérifier ses moyens d'acheminement avant de le solliciter à nouveau.

#### Flux entre districts

Un diagramme de flux : à gauche les districts d'où partent les produits, à droite ceux qui les reçoivent, l'épaisseur des bandes proportionnelle au nombre de mouvements. La lecture donne la part des mouvements internes à un district et le flux principal. Si un trajet entre deux districts différents concentre au moins 40 % des mouvements, l'encadré « À faire » propose un transport groupé.

### H. Progression annuelle

Pour chaque mois de l'année, la **moyenne de l'avancement des plans validés** de ce mois. L'avancement d'un plan est sa part de mouvements exécutés au moins en partie. Deux courbes : tous les plans, et le programme sélectionné.

*Exemple* : en octobre, deux plans avancés à 66,7 % et 100 % donnent une moyenne de **83,3 %**.

---

## 3. Le suivi des plans

Le compteur **n/m** d'un plan donne le nombre de mouvements exécutés au moins en partie (n) sur le total des mouvements non annulés (m). *Exemple* : 2/3, soit un mouvement exécuté, un partiel et un en attente.

Statuts d'un mouvement :
- **En attente** : rien n'est encore livré ;
- **Partiel** : une partie de la quantité prévue est livrée ;
- **Exécuté** : la quantité prévue est livrée ;
- **Annulé** : le mouvement est retiré du plan.

Un plan est **clôturé** automatiquement quand tous ses mouvements sont exécutés ou annulés.

---

## 4. Les statistiques sur une période

Seuls les plans **validés, en cours ou clôturés** comptent, **validés entre les deux dates choisies**. Les brouillons sont exclus. Le **niveau** dépend du rôle :

| Rôle | Niveau des statistiques |
|---|---|
| Pharmacien de région | sa région |
| Superviseur | tout son périmètre (ses régions) ou une de ses régions |
| Administrateur | national (toutes les régions) ou une région |

Exemple ci-dessous : la Région Démo, du 1er septembre au 19 novembre 2026.

| Indicateur | Calcul | Exemple |
|---|---|---|
| Plans validés | plans validés dans la période | 6, dont 4 clôturés |
| Mouvements | lignes non annulées de ces plans | 13 : 10 exécutés, 1 partiel, 2 en attente |
| Exécution des mouvements | (exécutés + partiels) ÷ mouvements | (10 + 1) ÷ 13 = 84,6 % |
| Exécution des quantités | quantités exécutées ÷ quantités prévues | 92,7 % |
| Délai d'exécution | jours entre la validation du plan et l'exécution du mouvement, en moyenne et en médiane | 6 jours |
| Ruptures résorbées | couples site/produit en rupture avant le plan qui ont reçu une quantité | 5 |
| Destinataires servis | couples site/produit qui ont reçu une quantité | 11 |

**La médiane** est la valeur du milieu quand on range les délais du plus court au plus long. Elle n'est pas faussée par un mouvement exceptionnellement lent. *Exemple* : délais de 2, 3, 4, 5 et 30 jours. La moyenne vaut 8,8 jours, la médiane 4 jours.

**L'exécution des quantités** additionne des unités différentes (comprimés, flacons…). C'est un ordre de grandeur global. Le tableau **par produit** donne les quantités exactes dans l'unité de chaque produit.

Les tableaux reprennent ces calculs par région, par programme et par mois de validation. Ils listent aussi les produits, ainsi que les 10 sites expéditeurs les plus sollicités et les 10 destinataires les plus servis, classés par nombre de mouvements.
