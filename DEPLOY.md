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
| Сайт сейчас | http://193.187.94.135/ |
| Целевой домен | `asenagroup.ru` (**ещё не делегирован**, см. раздел 7) |
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
| `/etc/nginx/sites-available/asenagroup.ru.conf` | виртуальный хост сайта (симлинк в `sites-enabled`) |
| `/etc/nginx/conf.d/10-hardening.conf` | `server_tokens off`, настройки gzip |
| `/etc/nginx/sites-enabled/default` | **удалён** |
| `/var/log/nginx/asenagroup.{access,error}.log` | логи сайта |

Что настроено:

* Сайт отдаётся и по домену, и по голому IP (`default_server`) — пока домена нет.
* gzip: `style.css` уезжает как 11 КБ вместо 45 КБ.
* Заголовки безопасности: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`.
* Кэш: статика (css/js/картинки/шрифты) — 30 дней; HTML — `no-cache`,
  чтобы правки были видны сразу после деплоя. Версионирование css/js
  уже есть в разметке через `?v=7`.
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

## 7. Домен и HTTPS — что осталось сделать

**Домен `asenagroup.ru` на 5 сентября 2026 не зарегистрирован.**
Запрос к DNS даёт `NXDOMAIN` на уровне зоны `.ru`: NS-записей нет,
авторитетный ответ приходит от `a.dns.ripn.net`. Поэтому сертификат
Let's Encrypt получить сейчас физически нельзя — валидация требует,
чтобы домен резолвился в `193.187.94.135`.

Что нужно сделать вам:

1. Зарегистрировать `asenagroup.ru` у любого аккредитованного регистратора.
2. В DNS домена прописать две записи:

   ```
   asenagroup.ru.       A   193.187.94.135
   www.asenagroup.ru.   A   193.187.94.135
   ```

3. Подождать делегирования (обычно от часа до суток) и проверить:

   ```bash
   ssh asena 'getent ahostsv4 asenagroup.ru www.asenagroup.ru'
   ```

4. Запустить на сервере готовый скрипт — он всё доделает сам:

   ```bash
   ssh asena 'sudo /usr/local/bin/asena-golive.sh'
   ```

Скрипт `/usr/local/bin/asena-golive.sh` (написан и проверен на синтаксис,
запускать один раз):

* убеждается, что оба имени резолвятся именно в `193.187.94.135`,
  и отказывается работать, если нет;
* получает сертификат Let's Encrypt на `asenagroup.ru` + `www` методом webroot;
* перезаписывает конфиг nginx на боевой: 443 с HTTP/2 и HSTS,
  редирект `http → https` для домена, редирект `www → апекс`;
  доступ по голому IP остаётся на HTTP без редиректа — на IP сертификата нет
  и редирект дал бы ошибку в браузере;
* заменяет `robots.txt` на боевой (`Allow: /` + ссылка на sitemap).

Автопродление сертификата уже включено: системный таймер `certbot.timer`,
запуск ежедневно. Ничего настраивать не нужно.

По умолчанию письмо для Let's Encrypt — `stroy.element77@gmail.com`.
Поменять при запуске:

```bash
ssh asena 'sudo LE_EMAIL=you@example.com /usr/local/bin/asena-golive.sh'
```

### robots.txt — важно

Сейчас на сервере лежит **preview-версия** с `Disallow: /` — она в репозитории
и намеренно закрывает черновик от индексации. `asena-golive.sh` заменит её
на сервере на боевую, но **следующий же `deploy.sh` вернёт preview-версию обратно**.
Поэтому после запуска go-live отредактируйте `robots.txt` в репозитории:

```
User-agent: *
Allow: /

Sitemap: https://asenagroup.ru/sitemap.xml
```

Sitemap сейчас не генерируется — либо создайте его, либо уберите строку.

---

## 8. Копии конфигов в репозитории

В каталоге `server/` лежат снятые с сервера копии — чтобы конфигурация была
под контролем версий и её можно было восстановить или отревьюить локально.
Это **справочные копии**: правки в них ничего не меняют на сервере, файлы
нужно заливать обратно вручную.

| Файл в репозитории | Путь на сервере |
|---|---|
| `server/asena-golive.sh` | `/usr/local/bin/asena-golive.sh` |
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
2. **Зарегистрировать `asenagroup.ru`** и прописать A-записи (раздел 7).
3. После делегирования — **запустить `asena-golive.sh`** и поправить `robots.txt` в репозитории.
4. При желании — **настроить приёмник заявок**: вписать URL в `LEAD_ENDPOINT`
   в `assets/js/main.js`, иначе форма продолжит открывать почтовый клиент.
5. Проверить содержимое `SERVER-SECRETS.local.md` и перенести пароль в менеджер паролей.
