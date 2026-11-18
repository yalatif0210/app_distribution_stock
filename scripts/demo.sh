#!/bin/sh
# Jeu de démonstration « Région Démo » : chargement ou suppression.
#
# Usage, depuis la racine du projet :
#   scripts/demo.sh charger     # (re)charge le jeu complet ; environnement local uniquement
#   scripts/demo.sh supprimer   # supprime le jeu et tout ce qui a été créé dedans
#
# Garde-fous :
#   • charger n'est accepté que si la configuration Docker active est celle du mode local
#     (APP_DEMO_ENABLED=true) : jamais sur un serveur ;
#   • les deux actions demandent de retaper un mot de confirmation ;
#   • tout passe en une seule transaction : en cas d'erreur, rien n'est modifié.
set -eu

cd "$(dirname "$0")/.."

ACTION="${1:-}"
case "$ACTION" in
  charger)   FICHIER=charger-demo.sql ;;
  supprimer) FICHIER=supprimer-demo.sql ;;
  *) echo "Usage : scripts/demo.sh charger|supprimer" >&2; exit 2 ;;
esac

PROJET=$(docker compose config --format json 2>/dev/null | sed -n 's/^ *"name": *"\([^"]*\)".*/\1/p' | head -1)
if [ "$ACTION" = charger ] && ! docker compose config 2>/dev/null | grep -q 'APP_DEMO_ENABLED: "true"'; then
  echo "Refusé : le jeu de démonstration ne se charge qu'en environnement local" >&2
  echo "(APP_DEMO_ENABLED=true, fichier docker-compose.local.yml actif)." >&2
  exit 1
fi

echo "Projet Docker : ${PROJET:-inconnu}"
if [ "$ACTION" = charger ]; then
  echo "Le jeu « Région Démo » va être (re)chargé. Les données de démonstration existantes,"
  echo "y compris celles créées pendant vos tests dans la Région Démo, seront remplacées."
else
  echo "Le jeu « Région Démo » va être supprimé, avec tout ce qui a été créé dedans"
  echo "(plans, périodes, saisies, comptes demo_*). Les données réelles ne sont pas touchées."
fi
printf 'Tapez DEMO pour confirmer : '
read -r REPONSE
[ "$REPONSE" = DEMO ] || { echo "Abandon."; exit 1; }

# Les scripts sont copiés dans le conteneur de la base puis exécutés en une transaction
docker compose cp scripts/demo/. db:/tmp/demo >/dev/null
docker compose exec -T db sh -c "psql -v ON_ERROR_STOP=1 --single-transaction -q -U \"\$POSTGRES_USER\" -d redistribution_stocks -f /tmp/demo/$FICHIER; status=\$?; rm -rf /tmp/demo; exit \$status"
if [ "$ACTION" = charger ]; then echo "Terminé : jeu de démonstration chargé."; else echo "Terminé : jeu de démonstration supprimé."; fi
