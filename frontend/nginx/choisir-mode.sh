#!/bin/sh
# Exécuté par l'image nginx au démarrage (/docker-entrypoint.d) :
# HTTPS si les certificats sont montés dans /etc/nginx/certs, HTTP sinon.
set -eu
if [ -f /etc/nginx/certs/fullchain.pem ] && [ -f /etc/nginx/certs/privkey.pem ]; then
    cp /etc/nginx/modes/https.conf /etc/nginx/conf.d/default.conf
    echo "choisir-mode: certificats trouvés, mode HTTPS"
else
    cp /etc/nginx/modes/http.conf /etc/nginx/conf.d/default.conf
    echo "choisir-mode: aucun certificat, mode HTTP"
fi
