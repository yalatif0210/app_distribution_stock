#!/bin/sh
# Archive de déploiement : uniquement ce qu'il faut pour construire et faire tourner
# l'application sur un serveur. Liste BLANCHE : tout ce qui n'est pas nommé ici reste
# en local, en particulier les données (jeu de démonstration, données d'exemple,
# fichiers Excel ou Word) et les secrets (.env).
#
# Usage, depuis la racine du projet :
#   scripts/archive-deploiement.sh > redistribution.tar.gz
#   scripts/archive-deploiement.sh | ssh serveur 'tar -xzf - -C ~/redistribution'
set -eu
cd "$(dirname "$0")/.."

tar -czf - \
  --exclude='.env' --exclude='*.env' \
  --exclude='backend/target' --exclude='backend/demo-db' \
  --exclude='frontend/node_modules' --exclude='frontend/.angular' --exclude='frontend/dist' \
  --exclude='*.xlsx' --exclude='*.xls' --exclude='*.csv' --exclude='*.docx' --exclude='*.sql.gz' \
  backend/pom.xml backend/Dockerfile backend/.dockerignore backend/src/main \
  frontend \
  deploy \
  docker-compose.yml docker-compose.proxy.yml .env.example .gitattributes README.md \
  scripts/sauvegarde.sh

# Contrôle : aucune donnée de démonstration ni d'exemple ne doit sortir
# (fait sur une seconde lecture pour ne pas mélanger le contrôle et l'archive)
if tar -czf - backend/src/main 2>/dev/null | tar -tzf - | grep -qiE 'demo-db|V2_1__|V3_1__|charger-demo'; then
  echo "ERREUR : des données d'exemple sont dans backend/src/main" >&2
  exit 1
fi
