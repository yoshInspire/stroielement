#!/usr/bin/env bash
# Ждёт делегирования asenagroup.ru и, как только домен зарезолвится,
# сам запускает asena-golive.sh (сертификат + HTTPS + боевой robots.txt).
# Запускается systemd-таймером каждые 10 минут и ВЫКЛЮЧАЕТ САМ СЕБЯ,
# когда отработал.
#
#   лог:     /var/log/asena-golive.log
#   таймер:  asena-cert-watch.timer
#   статус:  /var/lib/asena/
set -uo pipefail

DOMAIN=asenagroup.ru
WWW=www.asenagroup.ru
IP=193.187.94.135
STATE=/var/lib/asena
LOG=/var/log/asena-golive.log
TIMER=asena-cert-watch.timer
MAX_FAILS=5

mkdir -p "$STATE"
log() { echo "$(date '+%F %T') $*" >> "$LOG"; }
stop_timer() { systemctl disable --now "$TIMER" >/dev/null 2>&1 || true; }

# --- уже отработали ---
if [ -f "$STATE/golive.done" ]; then
  log "сертификат уже выпущен, выключаю таймер"
  stop_timer
  exit 0
fi

# --- слишком много неудач подряд: останавливаемся, чтобы не упереться
#     в лимиты Let's Encrypt (5 неудачных проверок в час на домен) ---
fails=$(cat "$STATE/fails" 2>/dev/null || echo 0)
if [ "$fails" -ge "$MAX_FAILS" ]; then
  log "$MAX_FAILS неудачных попыток подряд, останавливаюсь."
  log "разбор в этом же логе; повторить: rm $STATE/fails && systemctl enable --now $TIMER"
  stop_timer
  exit 0
fi

# --- проверка DNS по публичному резолверу ---
ready=1
miss=""
for h in "$DOMAIN" "$WWW"; do
  got=$(dig +short +time=5 +tries=2 @8.8.8.8 "$h" A 2>/dev/null | tr '\n' ' ')
  case " $got " in
    *" $IP "*) ;;
    *) ready=0; miss="$miss $h=${got:-нет}" ;;
  esac
done

if [ "$ready" != 1 ]; then
  log "жду делегирования:$miss"
  exit 0
fi

# локальный кэш systemd-resolved мог запомнить NXDOMAIN - сбрасываем,
# иначе go-live не увидит записи, которые уже видит 8.8.8.8
resolvectl flush-caches >/dev/null 2>&1 || true

log "домен резолвится в $IP, запускаю go-live"
if /usr/local/bin/asena-golive.sh >> "$LOG" 2>&1; then
  touch "$STATE/golive.done"
  rm -f "$STATE/fails"
  log "ГОТОВО: сертификат выпущен, HTTPS включён, таймер выключен"
  stop_timer
else
  fails=$((fails + 1))
  echo "$fails" > "$STATE/fails"
  log "ОШИБКА go-live (попытка $fails из $MAX_FAILS)"
fi
