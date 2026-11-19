# Manuels utilisateur

Application de redistribution des stocks sanitaires. Un manuel par rôle :

| Rôle | Manuel |
|---|---|
| Gestionnaire de site | [gestionnaire.md](gestionnaire.md) |
| Pharmacien de région | [pharmacien-region.md](pharmacien-region.md) |
| Superviseur | [superviseur.md](superviseur.md) |
| Administrateur | [administrateur.md](administrateur.md) |

Pour tous les rôles : [comment sont calculés les indicateurs](indicateurs.md), avec des exemples chiffrés.

**Version PDF** de chaque guide, à distribuer ou imprimer : dossier [pdf/](pdf/). Pour les régénérer après une modification des manuels : `python scripts/manuels-pdf.py 1.2.0`, où le numéro est la version de l'application.

Le cycle mensuel, en bref :

1. **Le pharmacien de région ouvre la période** du mois.
2. **Chaque gestionnaire déclare l'état de ses stocks**, à l'écran ou par import Excel, puis le soumet.
3. **Le pharmacien suit la complétude** et relance les retardataires.
4. **Il construit le plan de redéploiement**, par analyse IA ou en répartition manuelle, et le valide.
5. **Les sites expédient et reçoivent**. Le pharmacien enregistre les quantités livrées. Le plan se clôture quand tout est exécuté.
6. **Tous mesurent l'effet** dans le tableau de bord et les statistiques.
