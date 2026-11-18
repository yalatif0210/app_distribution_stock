#!/bin/sh
# Sauvegarde de la base (pg_dump, format custom) avec rétention.
# Usage, depuis la racine du projet : scripts/sauvegarde.sh [dossier] [jours]
# Cron quotidien à 2 h :
#   0 2 * * * cd /opt/app_distribution_stock && scripts/sauvegarde.sh >> sauvegardes/sauvegarde.log 2>&1
set -eu
# Les sauvegardes contiennent toute la base : lisibles par le seul propriétaire
umask 077

DOSSIER="${1:-sauvegardes}"
JOURS="${2:-14}"
FICHIER="$DOSSIER/redistribution_stocks_$(date +%Y%m%d_%H%M%S).dump"

mkdir -p "$DOSSIER"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc redistribution_stocks' > "$FICHIER.tmp"
mv "$FICHIER.tmp" "$FICHIER"
find "$DOSSIER" -name 'redistribution_stocks_*.dump' -mtime +"$JOURS" -delete

echo "$(date '+%F %T') sauvegarde OK : $FICHIER ($(du -h "$FICHIER" | cut -f1))"
