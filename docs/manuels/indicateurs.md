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

- **A. Évolution MSD** : MSD avant et après de chaque site qui a participé au plan, comme expéditeur ou destinataire, produit par produit.
- **B. Ruptures** : pour chaque produit concerné (au moins une rupture avant ou après), le nombre de sites en rupture avant et après. *Exemple* : Ocytocine 1 → 0, la rupture de l'hôpital est résorbée.
- **C. Proportions de stockage** : pour le produit choisi, la répartition des sites par statut avant et après, en deux camemberts. Les stocks dormants sont comptés avec le surstock.
- **D. Disponibilité** : voir le taux de disponibilité ci-dessus.
- **Exécution** : avancement du plan et détail des mouvements.
- **Analytics** : indicateurs composites et top 5 des mouvements à plus fort impact (gain de MSD chez le destinataire).

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
