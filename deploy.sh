#!/usr/bin/env bash
# Деплой статики asenagroup.ru на прод-сервер.
# Запуск из корня репозитория:  bash deploy.sh
set -euo pipefail

HOST="${DEPLOY_HOST:-193.187.94.135}"
USER="${DEPLOY_USER:-deploy}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/asenagroup_ed25519}"
ROOT="/var/www/asenagroup.ru"
STAGE="/home/$USER/.deploy-stage"

cd "$(dirname "$0")"

SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$USER@$HOST")

echo "==> upload -> $USER@$HOST:$STAGE"
"${SSH[@]}" "rm -rf $STAGE && mkdir -p $STAGE"
tar czf - index.html residential.html robots.txt assets \
  | "${SSH[@]}" "tar xzf - -C $STAGE"

echo "==> sync -> $ROOT"
"${SSH[@]}" "sudo rsync -a --delete --chown=deploy:www-data $STAGE/ $ROOT/ \
  && sudo find $ROOT -type d -exec chmod 755 {} + \
  && sudo find $ROOT -type f -exec chmod 644 {} + \
  && rm -rf $STAGE \
  && sudo nginx -t && sudo systemctl reload nginx"

echo "==> smoke test"
code=$(curl -s -o /dev/null -w '%{http_code}' "http://$HOST/")
echo "GET http://$HOST/ -> $code"
[ "$code" = "200" ] || { echo "FAILED"; exit 1; }
echo "==> done"
