# App distribution stock

Redistribution des stocks sanitaires entre structures : suivi des stocks, analyse des tensions et surstocks, plans de réattribution avec aide de l'IA (Mistral).

| Conteneur | Rôle |
|---|---|
| `frontend` | nginx : sert l'interface Angular, relaie `/api/` vers le backend, gère le HTTPS |
| `backend` | API Spring Boot (Java 17). Applique les migrations Flyway au démarrage |
| `db` | PostgreSQL 15, sans port publié |

## Déployer sur un serveur

Prérequis : Linux x86_64, Docker Engine 24+ avec le plugin Compose v2, 4 Go de RAM minimum.

```bash
git clone <dépôt> /opt/app_distribution_stock && cd /opt/app_distribution_stock
cp .env.example .env && chmod 600 .env
nano .env                       # DB_PASSWORD, JWT_SECRET, ADMIN_INITIAL_PASSWORD, MISTRAL_API_KEY
docker compose up -d --build
docker compose ps               # les trois conteneurs doivent être "healthy" / "running"
```

**Aucun jeu de données en production.** Le serveur ne reçoit que le code : copiez-le avec `scripts/archive-deploiement.sh | ssh serveur 'tar -xzf - -C ~/redistribution'`. Ce script n'embarque qu'une liste blanche de fichiers : ni données d'exemple, ni jeu de démonstration, ni fichiers Excel ou Word, ni `.env`. Au premier démarrage, la base ne contient que les rôles, les seuils de statut et le compte `admin`. Les données d'exemple (`backend/demo-db`) et le jeu de démonstration (`scripts/demo`) ne servent qu'en local.

Première connexion : `admin` avec `ADMIN_INITIAL_PASSWORD`. Changez ce mot de passe dans l'administration, puis redéfinissez ceux de `pharmacien1` et `gestionnaire1`. Au premier démarrage, ces deux comptes reçoivent un mot de passe aléatoire, parce que le mot de passe de démo (`Admin@2024`) est public.

### HTTPS

Déposez le certificat et sa clé dans `certs/`, puis redémarrez le frontend :

```
certs/fullchain.pem    # certificat + chaîne intermédiaire
certs/privkey.pem      # clé privée
```

```bash
docker compose restart frontend
docker compose logs frontend | grep choisir-mode    # « mode HTTPS »
```

Avec les certificats, le port 80 redirige vers le 443. Sans eux, l'application est servie en HTTP sur le port 80. Si un reverse proxy de l'hébergeur gère déjà le TLS, laissez `certs/` vide.

### Serveur partagé, derrière le nginx de l'hôte

Quand un nginx installé sur la machine tient déjà les ports 80 et 443 pour d'autres sites, l'application ne publie qu'un port local et c'est ce nginx qui sert le sous-domaine. Dans `.env` :

```
COMPOSE_FILE=docker-compose.yml:docker-compose.proxy.yml
HTTP_PORT=8095
```

`docker compose up -d --build` publie alors le frontend sur `127.0.0.1:8095` seulement, en HTTP. Côté hôte, le site [deploy/nginx/redistribution.conf](deploy/nginx/redistribution.conf) relaie le sous-domaine vers ce port ; `certbot --nginx` y ajoute le HTTPS. Les commandes d'installation sont en tête du fichier.

### Flux réseau

- Entrants : 80 et 443.
- Sortant : `api.mistral.ai:443`. Sans lui, les plans sont générés sans IA.
- La compilation des images a aussi besoin de Docker Hub, Maven Central et npm.

## Mettre à jour

```bash
git pull
docker compose up -d --build
```

Les migrations de base s'appliquent seules au démarrage du backend.

Sans Internet sur le serveur : compilez sur une autre machine avec `docker compose build`, puis `docker save redistribution-backend redistribution-frontend | gzip > images.tar.gz`. Sur le serveur : `docker load < images.tar.gz && docker compose up -d`.

## Sauvegarde et restauration

```bash
scripts/sauvegarde.sh                       # → sauvegardes/redistribution_stocks_<date>.dump, rétention 14 jours
# crontab -e :
0 2 * * * cd /opt/app_distribution_stock && scripts/sauvegarde.sh >> sauvegardes/sauvegarde.log 2>&1
```

Copiez régulièrement `sauvegardes/` hors du serveur.

Restauration. ⚠ Elle **écrase** la base actuelle :

```bash
docker compose stop backend
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d redistribution_stocks --clean --if-exists' < sauvegardes/<fichier>.dump
docker compose start backend
```

## Commandes utiles

| Besoin | Commande |
|---|---|
| État | `docker compose ps` |
| Logs | `docker compose logs -f backend` |
| Santé | `docker compose exec backend wget -qO- localhost:8080/actuator/health` |
| Arrêter (données conservées) | `docker compose down` |

⚠ `docker compose down -v` **supprime la base**.

## Poste de développement

Dans `.env`, décommentez les deux lignes « Poste de développement » : `COMPOSE_FILE` et `HTTP_PORT=8086`. `docker compose up -d --build` applique alors aussi `docker-compose.local.yml`, avec ces effets :

- interface sur http://localhost:8086 seulement ;
- backend sans accès Internet (Mistral neutralisé) ;
- comptes démo `admin`, `pharmacien1`, `gestionnaire1`, tous avec le mot de passe `Admin@2024`.

Hors Docker : `backend/.env.example` (Spring lit `backend/.env`) et `npm start` dans `frontend/`.

### Jeu de démonstration

`scripts/demo.sh charger` charge la « Région Démo » : 9 sites, 3 programmes, 13 produits, 3 périodes avec saisies et plans, 10 comptes `demo_*` (mot de passe `Admin@2024`). Chaque cas de figure de la redistribution y est représenté. Le détail est dans [scripts/demo/README.md](scripts/demo/README.md).

Le chargement est refusé hors environnement local. Avant une mise en service, `scripts/demo.sh supprimer` retire le jeu et tout ce qui a été créé dedans.
