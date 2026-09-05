#!/usr/bin/env bash
# Перевод asenagroup.ru на HTTPS. Запускать ОДИН РАЗ, после того как
# домен зарегистрирован и A-записи asenagroup.ru и www.asenagroup.ru
# указывают на 193.187.94.135.
#
#   sudo /usr/local/bin/asena-golive.sh
#
# Скрипт: проверяет DNS -> получает сертификат Let's Encrypt (webroot)
# -> включает 443-й блок и редирект с 80 -> открывает сайт для индексации.
set -euo pipefail

DOMAIN=asenagroup.ru
WWW=www.asenagroup.ru
IP=193.187.94.135
ROOT=/var/www/$DOMAIN
EMAIL="${LE_EMAIL:-stroy.element77@gmail.com}"

[ "$(id -u)" = 0 ] || { echo "Запускать от root: sudo $0"; exit 1; }

echo "==> 1/5 проверка DNS"
fail=0
for h in "$DOMAIN" "$WWW"; do
  got=$(getent ahostsv4 "$h" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ')
  echo "    $h -> ${got:-<нет записи>}"
  case " $got " in *" $IP "*) ;; *) fail=1 ;; esac
done
if [ "$fail" = 1 ]; then
  echo "ОШИБКА: домен ещё не указывает на $IP. Пропишите A-записи и повторите."
  exit 1
fi

echo "==> 2/5 сертификат Let's Encrypt"
certbot certonly --webroot -w /var/www/letsencrypt \
  -d "$DOMAIN" -d "$WWW" \
  --agree-tos --no-eff-email -m "$EMAIL" \
  --non-interactive --keep-until-expiring

echo "==> 3/5 конфигурация nginx с HTTPS"
# страховка: если новый конфиг не пройдёт проверку, возвращаем рабочий,
# иначе на диске останется битый файл и следующий deploy.sh тоже упадёт
BAK=/etc/nginx/sites-available/asenagroup.ru.conf.before-ssl
cp -a /etc/nginx/sites-available/asenagroup.ru.conf "$BAK"
cat > /etc/nginx/snippets/asena-site.conf <<'EOF'
    root /var/www/asenagroup.ru;
    index index.html;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    location ~* \.(?:css|js|jpg|jpeg|png|gif|webp|avif|svg|ico|woff2?|ttf|eot)$ {
        expires 30d;
        access_log off;
        try_files $uri =404;
    }
    location ~* \.html$ {
        expires -1;
        try_files $uri =404;
    }
    location = /robots.txt { access_log off; log_not_found off; }
    location = /favicon.ico { access_log off; log_not_found off; }
    location ~ /\.(?!well-known) { deny all; }
    location / { expires -1; try_files $uri $uri/ $uri.html =404; }
EOF

cat > /etc/nginx/sites-available/asenagroup.ru.conf <<'EOF'
# asenagroup.ru - боевая конфигурация (HTTPS)

# 80: ACME + редирект домена на HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name asenagroup.ru www.asenagroup.ru;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
    }
    location / { return 301 https://asenagroup.ru$request_uri; }
}

# 80 по IP / чужому Host: отдаём сайт как есть, без редиректа на HTTPS
# (сертификата на IP нет, редирект дал бы ошибку в браузере)
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    access_log /var/log/nginx/asenagroup.access.log;
    error_log  /var/log/nginx/asenagroup.error.log;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
    }
    include /etc/nginx/snippets/asena-site.conf;
}

# 443: www -> апекс
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.asenagroup.ru;

    ssl_certificate     /etc/letsencrypt/live/asenagroup.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/asenagroup.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://asenagroup.ru$request_uri;
}

# 443: основной сайт
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name asenagroup.ru;

    ssl_certificate     /etc/letsencrypt/live/asenagroup.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/asenagroup.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    access_log /var/log/nginx/asenagroup.access.log;
    error_log  /var/log/nginx/asenagroup.error.log;

    include /etc/nginx/snippets/asena-site.conf;
}
EOF

[ -f /etc/letsencrypt/options-ssl-nginx.conf ] || \
  curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    -o /etc/letsencrypt/options-ssl-nginx.conf
[ -f /etc/letsencrypt/ssl-dhparams.pem ] || \
  openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048

if nginx -t; then
  systemctl reload nginx
  echo "    конфиг применён, копия прежнего: $BAK"
else
  echo "ОШИБКА: новый конфиг не прошёл проверку, откатываю на прежний"
  cp -a "$BAK" /etc/nginx/sites-available/asenagroup.ru.conf
  rm -f /etc/nginx/snippets/asena-site.conf
  nginx -t && systemctl reload nginx
  echo "Сайт остался на HTTP. Сертификат выпущен и лежит в /etc/letsencrypt."
  exit 1
fi

echo "==> 4/5 открываем сайт для поисковых систем"
cat > "$ROOT/robots.txt" <<EOF
User-agent: *
Allow: /

Sitemap: https://$DOMAIN/sitemap.xml
EOF
chown deploy:www-data "$ROOT/robots.txt"; chmod 644 "$ROOT/robots.txt"
# и в исходнике деплоя, чтобы следующий deploy.sh не вернул preview-версию
echo "ВНИМАНИЕ: не забудьте обновить robots.txt в репозитории — иначе следующий deploy.sh вернёт preview-версию с Disallow."

echo "==> 5/5 проверка"
systemctl list-timers certbot.timer --no-pager | head -3
curl -sI "https://$DOMAIN/" | head -1
echo "Готово. Сайт: https://$DOMAIN/"
