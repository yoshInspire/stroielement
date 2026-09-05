# asenagroup.ru — сервер и деплой

Рабочая документация по продакшн-серверу сайта АСЕНА ГРУПП.
Пароли и приватный ключ — **не здесь**, а в `SERVER-SECRETS.local.md` (файл в `.gitignore`).

Дата настройки: **5 сентября 2026**.

---

## 1. Что где

| | |
|---|---|
| IP | `193.187.94.135` |
| Обратный DNS хостера | `app.gypsolit.ru` |
| Имя хоста | `vm-nano` |
| ОС | Ubuntu 24.04.4 LTS, ядро 6.8.0-39-generic |
| Ресурсы | 2 vCPU, 1.8 ГБ RAM, 58 ГБ диска (занято ~4 ГБ) |
| Часовой пояс | Europe/Moscow |
| Сайт | **https://asenagroup.ru/** (HTTPS с 5 сентября 2026) |
| Домен | `asenagroup.ru` + `www`, оба на этот IP, см. раздел 7 |
| Корень сайта | `/var/www/asenagroup.ru` |
| Владелец файлов | `deploy:www-data`, каталоги 755, файлы 644 |

Сервер до настройки был пустой: стоял только Docker (без единого контейнера)
и слушал один порт 22. Ничего чужого не затронуто.

---

## 2. Доступ по SSH

Вход **только по ключу**. Аутентификация по паролю выключена на уровне sshd —
сервер отвечает `No supported authentication methods available (server sent: publickey)`.

### Ключ

| | |
|---|---|
| Тип | ed25519, без пароля на ключе, 100 раундов KDF |
| Приватный | `C:\Users\oblik\.ssh\asenagroup_ed25519` |
| Публичный | `C:\Users\oblik\.ssh\asenagroup_ed25519.pub` |
| Отпечаток | `SHA256:uElXqBWtskGfZNbry+CK5Hl15CljgyxYGYFiC1zPobI` |
| Комментарий | `asenagroup-deploy@Home-PC-20260905` |

Один и тот же ключ прописан двум пользователям: `root` и `deploy`.

### Учётные записи

* **`deploy`** — рабочая. Пароля нет вообще (`--disabled-password`),
  вход только по ключу, `sudo` без пароля (`/etc/sudoers.d/90-deploy`).
  Используйте её для всего повседневного.
* **`root`** — резервная. Вход по SSH только по ключу
  (`PermitRootLogin prohibit-password`). Пароль у root **есть** и был заменён на новый —
  он нужен только для консоли/VNC в панели хостера, если ключ будет потерян.
  Новый пароль — в `SERVER-SECRETS.local.md`.

### Как подключаться

В `~/.ssh/config` добавлены алиасы, так что достаточно:

```bash
ssh asena
```

```bash
ssh asena-root
```

Полная форма без алиаса:

```bash
ssh -i ~/.ssh/asenagroup_ed25519 -o IdentitiesOnly=yes deploy@193.187.94.135
```

### Отпечатки хоста (сверять при первом подключении с нового компьютера)

```
ED25519  SHA256:TC5PYe2Fij36ly3oX91AMtBoimvB9/r2gZk1nj5Wcfk
ECDSA    SHA256:sGP/WebPAceidT9wZ20LO3Fw4Ps4NGccMTh18fA7G2s
RSA      SHA256:YaeJP8T+BkQcQERj3l6c1IPNcn/IdQzeDb0a8WqJCpI
```

### Что именно закручено в sshd

`/etc/ssh/sshd_config.d/00-asena-hardening.conf` — этот файл в glob-подстановке идёт
первым, а OpenSSH берёт **первое** встреченное значение, поэтому он перекрывает всё остальное:

```
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PermitRootLogin prohibit-password
AuthenticationMethods publickey
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers root deploy
```

Дополнительно `/etc/ssh/sshd_config.d/50-cloud-init.conf` (он от образа хостера
и включал пароли) переписан на `PasswordAuthentication no`.
Бэкапы исходников лежат рядом с суффиксом `.bak.2026-09-05`.

> **Осторожно.** Ключ — единственный вход. Сделайте копию
> `C:\Users\oblik\.ssh\asenagroup_ed25519` в надёжное место (менеджер паролей,
> зашифрованный архив). Если файл потеряется, останется только консоль хостера
> с root-паролем.

Добавить второй ключ (например, для коллеги):

```bash
ssh asena 'echo "ssh-ed25519 AAAA... comment" >> ~/.ssh/authorized_keys'
```

---

## 3. Что установлено

| Пакет | Версия | Роль |
|---|---|---|
| nginx | 1.24.0-2ubuntu7.17 | веб-сервер |
| certbot + python3-certbot-nginx | 2.9.0-1 | сертификаты Let's Encrypt |
| ufw | 0.36.2-6 | файрвол |
| fail2ban | 1.0.2-3ubuntu0.1 | блокировка перебора |
| unattended-upgrades | 2.9.1 | автоматические security-обновления |
| rsync, curl, git, logrotate | — | обслуживание |
| docker-ce | 29.8.0 | был на сервере до настройки, не используется |

Все службы в автозапуске: `nginx`, `fail2ban`, `ufw`, `unattended-upgrades`, `certbot.timer`.

### Файрвол (ufw)

```
22/tcp   LIMIT   # SSH, с ограничением частоты подключений
80/tcp   ALLOW   # HTTP
443/tcp  ALLOW   # HTTPS
```

Политика по умолчанию: входящие — `deny`, исходящие — `allow`. IPv4 и IPv6.

> `limit` на 22-м порту роняет подключения, если с одного адреса приходит
> больше шести за 30 секунд. Скрипты, открывающие много SSH-сессий подряд
> (например, несколько `scp` в цикле), словят `Connection timed out` —
> это не сбой сервера, достаточно подождать полминуты. Гоняйте пачку
> команд одной сессией, а не десятью.

### fail2ban

Активные джейлы: `sshd`, `nginx-botsearch`, `nginx-bad-request`, `nginx-http-auth`.
Конфигурация — `/etc/fail2ban/jail.local`. `sshd`: 3 попытки → бан на 24 часа;
остальные: 5–10 попыток за 10 минут → бан на час.

Сервер активно сканируют — на момент настройки джейл `sshd` уже блокировал
перебор с нескольких адресов.

```bash
ssh asena 'sudo fail2ban-client status sshd'
```

Разбанить адрес (например, если сами себя заблокировали):

```bash
ssh asena 'sudo fail2ban-client set sshd unbanip 1.2.3.4'
```

---

## 4. Конфигурация nginx

| Файл | Что делает |
|---|---|
| `/etc/nginx/sites-available/asenagroup.ru.conf` | виртуальный хост: 80, 443 и редиректы (симлинк в `sites-enabled`) |
| `/etc/nginx/snippets/asena-site.conf` | общая часть вхоста, подключается в 80 и 443 |
| `/etc/nginx/conf.d/10-hardening.conf` | `server_tokens off`, настройки gzip |
| `/etc/nginx/sites-enabled/default` | **удалён** |
| `/var/log/nginx/asenagroup.{access,error}.log` | логи сайта |

Что настроено:

* Домен отдаётся по HTTPS, `www` редиректится на апекс, HTTP — на HTTPS.
  По голому IP сайт остаётся на HTTP без редиректа (`default_server`):
  сертификата на IP не бывает.
* gzip: `style.css` уезжает как 11 КБ вместо 45 КБ.
* Заголовки безопасности: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`.
* Кэш: статика (css/js/картинки/шрифты) — 30 дней; HTML — `no-cache`,
  чтобы правки были видны сразу после деплоя. Версионирование css/js
  уже есть в разметке через `?v=8`.
* Точка для ACME-проверки: `/.well-known/acme-challenge/` → `/var/www/letsencrypt`.
* Скрытые файлы (`.git`, `.env` и прочее) закрыты правилом `location ~ /\.(?!well-known)`.

> Тонкость nginx, если будете править конфиг: `add_header` внутри `location`
> **отменяет** наследование всех `add_header` из блока `server`. Поэтому кэш
> задан директивой `expires`, а не `add_header Cache-Control` — иначе
> заголовки безопасности пропадали бы со всех страниц.

Проверить и перечитать конфиг:

```bash
ssh asena 'sudo nginx -t && sudo systemctl reload nginx'
```

---

## 5. Деплой сайта

Сайт статический: `index.html`, `residential.html`, `robots.txt`, `assets/`.
Бэкенд не нужен — форма заявки при пустом `LEAD_ENDPOINT` в
`assets/js/main.js` открывает почтовый клиент через `mailto:`.

Из корня репозитория:

```bash
bash deploy.sh
```

Скрипт [deploy.sh](deploy.sh): пакует четыре пути в tar, льёт их по SSH
во временный каталог `~/.deploy-stage` на сервере, затем
`rsync -a --delete` в `/var/www/asenagroup.ru` (то есть удалённые в репозитории
файлы удаляются и на сервере), выставляет права, перечитывает nginx
и делает смоук-тест — проверяет, что главная отвечает `200`.

Переопределяется переменными окружения: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KEY`.

Каталог `dist/` в деплое **не участвует** — это старая ручная сборка от 1 сентября,
она отстаёт от корня репозитория.

---

## 6. Проверка после деплоя

```bash
curl -sI http://193.187.94.135/ | head -1
```

```bash
ssh asena 'sudo tail -20 /var/log/nginx/asenagroup.error.log'
```

Проверено 5 сентября 2026: все страницы и ресурсы отдают `200`,
в консоли браузера ошибок нет, обе страницы рендерятся корректно.

| Адрес | Ответ |
|---|---|
| `/` | 200, text/html, 55 175 Б |
| `/residential.html` | 200, 11 900 Б |
| `/assets/css/style.css` | 200, gzip 11 086 Б |
| `/assets/js/main.js` | 200 |
| `/assets/img/*` | 200 (все 20 запросов страницы) |
| несуществующий путь | 404 |

---

## 7. Домен и HTTPS

**Домен работает, сайт на HTTPS: https://asenagroup.ru/**

| | |
|---|---|
| Регистратор | REG.RU, домен создан 5 сентября 2026, оплачен до 5 сентября 2027 |
| NS | `ns1.reg.ru`, `ns2.reg.ru` |
| A-записи | `asenagroup.ru` и `www.asenagroup.ru` → `193.187.94.135` |
| Сертификат | Let's Encrypt, `asenagroup.ru` + `www.asenagroup.ru` |
| Выпущен | 5 сентября 2026, действует до 4 декабря 2026 |
| Продление | автоматически, системный таймер `certbot.timer`; `certbot renew --dry-run` проходит |

Как что отвечает:

| Запрос | Ответ |
|---|---|
| `https://asenagroup.ru/` | 200 |
| `https://www.asenagroup.ru/` | 301 → `https://asenagroup.ru/` |
| `http://asenagroup.ru/` | 301 → `https://asenagroup.ru/` |
| `http://www.asenagroup.ru/` | 301 → `https://asenagroup.ru/` |
| `http://193.187.94.135/` | 200, без редиректа |

По голому IP редиректа на HTTPS намеренно нет: сертификата на IP не бывает,
и браузер показал бы ошибку. Апекс отдаёт HSTS на год.

### Как это включилось

Домен зарегистрировали утром 5 сентября, но делегирование в зоне `.ru`
появилось только через несколько часов. Всё это время на сервере работал
таймер `asena-cert-watch.timer`: раз в 10 минут проверял резолв и, как
только домен появился, сам выпустил сертификат.

Дальше go-live споткнулся — и это стоит запомнить, если будете править скрипт.
Certbot создаёт `options-ssl-nginx.conf` и `ssl-dhparams.pem` только когда
работает через плагин `--nginx`; мы ходили через `--webroot`, поэтому файлов
не было, а запасной вариант тянул их с GitHub по адресу, который теперь
отдаёт 404. Из-за `set -e` скрипт обрывался **до** `nginx -t`, так что и
откат не срабатывал: битый конфиг оставался на диске. Сайт при этом жил —
nginx держал в памяти прежний конфиг и ни разу не перечитывал его.

Исправлено: файл берётся из пакета `python3-certbot-nginx`
(`/usr/lib/python3/dist-packages/certbot_nginx/_internal/tls_configs/`),
из сети скрипт больше не ходит; dhparam генерируется локально; оба файла
готовятся **до** записи конфига. Заодно бэкап `*.before-ssl` теперь не
перезаписывается на повторных запусках — иначе он затирался уже сломанной
версией и откатывать было нечем.

Таймер после успеха выключил себя сам и оставил отметку
`/var/lib/asena/golive.done`. Повторно ничего не переписывается.

### Если сертификат придётся выпускать заново

```bash
ssh asena 'sudo rm -f /var/lib/asena/golive.done && sudo /usr/local/bin/asena-golive.sh'
```

Скрипт идемпотентен: сертификат не перевыпускается, пока не подошёл срок
(`--keep-until-expiring`), конфиг переписывается тем же содержимым,
а при неудачном `nginx -t` откатывается на `*.before-ssl`.

Посмотреть лог автовыпуска и состояние сертификата:

```bash
ssh asena 'sudo tail -20 /var/log/asena-golive.log; sudo certbot certificates'
```

### robots.txt

Сайт открыт для индексации. Боевая версия лежит и в репозитории, и на
сервере — `deploy.sh` больше не вернёт preview-версию с `Disallow: /`.
Директивы `Sitemap` нет: карты сайта пока не существует, а ссылка на
несуществующий файл хуже её отсутствия. Если появится `sitemap.xml`,
строку надо добавить в `robots.txt` и в шаблон внутри `asena-golive.sh`.


## 8. Копии конфигов в репозитории

В каталоге `server/` лежат снятые с сервера копии — чтобы конфигурация была
под контролем версий и её можно было восстановить или отревьюить локально.
Это **справочные копии**: правки в них ничего не меняют на сервере, файлы
нужно заливать обратно вручную.

| Файл в репозитории | Путь на сервере |
|---|---|
| `server/asena-golive.sh` | `/usr/local/bin/asena-golive.sh` |
| `server/asena-cert-watch.sh` | `/usr/local/bin/asena-cert-watch.sh` |
| `server/asena-cert-watch.service` | `/etc/systemd/system/asena-cert-watch.service` |
| `server/asena-cert-watch.timer` | `/etc/systemd/system/asena-cert-watch.timer` |
| `server/nginx-asenagroup.ru.conf` | `/etc/nginx/sites-available/asenagroup.ru.conf` |
| `server/sshd-00-asena-hardening.conf` | `/etc/ssh/sshd_config.d/00-asena-hardening.conf` |
| `server/fail2ban-jail.local` | `/etc/fail2ban/jail.local` |

---

## 9. Обслуживание

Обновления безопасности ставятся автоматически (`unattended-upgrades`,
`/etc/apt/apt.conf.d/20auto-upgrades`). Полное обновление вручную:

```bash
ssh asena 'sudo apt-get update && sudo apt-get upgrade -y'
```

Общее состояние:

```bash
ssh asena 'systemctl status nginx fail2ban --no-pager | head -30; sudo ufw status; df -h /'
```

Если нужно откатить ужесточение SSH (крайний случай, с консоли хостера):

```bash
rm /etc/ssh/sshd_config.d/00-asena-hardening.conf
cp /etc/ssh/sshd_config.d/50-cloud-init.conf.bak.2026-09-05 /etc/ssh/sshd_config.d/50-cloud-init.conf
sshd -t && systemctl restart ssh
```

---

## 10. Что осталось на вашей стороне

1. **Сохранить приватный ключ** `C:\Users\oblik\.ssh\asenagroup_ed25519` в резервное место.
2. ~~Домен и HTTPS~~ — сделано: сайт на https://asenagroup.ru/,
   сертификат продлевается сам.
3. ~~robots.txt~~ — сделано: боевая версия и в репозитории, и на сервере.
4. При желании — **настроить приёмник заявок**: вписать URL в `LEAD_ENDPOINT`
   в `assets/js/main.js`, иначе форма продолжит открывать почтовый клиент.
5. Проверить содержимое `SERVER-SECRETS.local.md` и перенести пароль в менеджер паролей.
