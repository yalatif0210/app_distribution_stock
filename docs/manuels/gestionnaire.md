# Manuel du gestionnaire de site

Vous gérez les stocks d'**une structure sanitaire** : hôpital, centre de santé, dispensaire ou dépôt. Chaque mois, vous déclarez l'état de vos stocks par programme. Ces déclarations permettent au pharmacien de région de répartir les produits entre les sites : vous pouvez être expéditeur d'un produit en excès et destinataire d'un produit qui vous manque.

Vous ne voyez que **votre structure**.

## Se connecter

Ouvrez l'adresse de l'application, saisissez votre identifiant et votre mot de passe. Le menu à gauche contient :

- **Stocks** : Sélection des produits gérés, Saisie de stock, Import Excel, Historique ;
- **Plans** : Suivi des plans.

La cloche en haut de l'écran affiche vos notifications : relances de saisie et transferts à réaliser.

## 1. Choisir les produits que vous gérez

**Stocks → Sélection des produits gérés**

Pour chaque programme suivi par votre structure, cochez les produits que vous gérez réellement. Seuls ces produits apparaissent dans votre saisie et dans votre gabarit Excel. Vous pouvez modifier cette sélection à tout moment ; elle s'appliquera aux saisies suivantes.

## 2. Déclarer l'état de vos stocks

Une **période** correspond à une date d'état de stock (la date « RAS »), ouverte par le pharmacien de région. Vous déclarez un état par programme et par période.

### À l'écran

**Stocks → Saisie de stock**

1. Choisissez la **période** et le **programme**.
2. Pour chaque produit, saisissez :
   - le **stock disponible** (0 en cas de rupture) ;
   - la **CMM**, votre consommation moyenne mensuelle ;
   - la **date de péremption** du lot qui périme le premier. Elle est obligatoire dès que le stock est supérieur à 0, et doit être postérieure à aujourd'hui.
3. Chaque ligne est **enregistrée automatiquement** quand vous quittez le champ. Le MSD et le statut s'affichent aussitôt (voir le [guide des indicateurs](indicateurs.md)).
4. Quand tout est saisi, cliquez sur **Soumettre**.

Un état soumis ne se modifie plus. En cas d'erreur, demandez au pharmacien de région de le **rouvrir**.

### Par fichier Excel

**Stocks → Import Excel**

1. Choisissez la **période** et le **programme**.
2. **Étape 1** : cliquez sur **Télécharger le modèle**. Le fichier `gabarit_stocks_<PROGRAMME>.xlsx` contient déjà vos produits.
3. Remplissez les colonnes **Stock Disponible**, **CMM** et **Date Péremption** (JJ/MM/AAAA). Les colonnes du produit sont protégées. Excel refuse un nombre négatif ou une date passée. L'onglet « Mode d'emploi » rappelle les règles.
4. **Importez** le fichier.
   - En cas d'erreur, **rien n'est enregistré**. Corrigez les lignes signalées (un rapport CSV est téléchargeable), puis importez à nouveau.
   - Un gabarit ne s'importe que pour son programme. Utilisez celui du bon programme.
5. Vérifiez votre saisie, puis **soumettez**.

## 3. Suivre les plans de redistribution

**Plans → Suivi des plans**

Vous consultez les plans de votre région :
- leur statut (brouillon, validé, clôturé) ;
- leur avancement, sous la forme **n/m** : n mouvements exécutés au moins en partie sur m ;
- le détail des mouvements : produit, site expéditeur, site destinataire, quantité.

Pour une version papier, cliquez sur l'icône 🖨 d'un plan. Le document A4 comporte des colonnes vides « Visa expédition » et « Visa réception » à signer lors du transfert.

Quand votre site doit expédier un produit, une notification **« Transfert à réaliser »** vous prévient. Préparez la quantité indiquée. Le pharmacien de région enregistre ensuite la quantité réellement livrée.

## 4. Consulter l'historique

**Stocks → Historique** : vos états de stock des périodes précédentes, avec le nombre de produits en rupture, en tension, bien stockés et en surstock.

## Questions fréquentes

**La date de péremption est refusée.** Elle doit être postérieure à aujourd'hui. Un lot déjà périmé ne doit pas être déclaré en stock disponible.

**Un produit manque dans ma saisie.** Ajoutez-le dans « Sélection des produits gérés ». S'il n'existe pas du tout, demandez à l'administrateur de l'ajouter au catalogue.

**Je me suis trompé après avoir soumis.** Demandez au pharmacien de région de rouvrir votre état.
