# Установка сайта Media Expo Group на сервер Timeweb Cloud

Инструкция по шагам: от покупки сервера до работающего сайта на `med-expo.org` с HTTPS, резервными копиями и обновлениями. Домен зарегистрирован на reg.ru, сервер — в Timeweb Cloud.

Сначала новый сайт ставится на проверочный адрес `new.med-expo.org`, а старый продолжает работать. Когда всё проверено, домен переключается на новый сервер (раздел 13).

## Содержание

1. [Что понадобится](#1-что-понадобится)
2. [Сервер в Timeweb Cloud](#2-сервер-в-timeweb-cloud)
3. [Проверочный адрес на reg.ru](#3-проверочный-адрес-на-regru)
4. [Подключение к серверу](#4-подключение-к-серверу)
5. [Подготовка сервера](#5-подготовка-сервера)
6. [База данных](#6-база-данных)
7. [Код сайта](#7-код-сайта)
8. [Настройки (.env)](#8-настройки-env)
9. [Сборка и наполнение базы](#9-сборка-и-наполнение-базы)
10. [Автозапуск](#10-автозапуск)
11. [nginx и HTTPS](#11-nginx-и-https)
12. [Проверка](#12-проверка)
13. [Переключение med-expo.org на новый сайт](#13-переключение-med-exporg-на-новый-сайт)
14. [Резервные копии](#14-резервные-копии)
15. [Обновление сайта](#15-обновление-сайта)
16. [Почта](#16-почта)
17. [Если что-то не работает](#17-если-что-то-не-работает)

---

## 1. Что понадобится

- Аккаунт в [Timeweb Cloud](https://timeweb.cloud) с пополненным балансом.
- Доступ в личный кабинет [reg.ru](https://www.reg.ru), где зарегистрирован домен `med-expo.org`.
- Почтовый ящик для отправки писем с сайта (раздел 16) — можно сделать позже.
- На своём компьютере: PowerShell (есть в Windows) — для подключения к серверу.

В командах ниже замените:

| Что | На что |
|---|---|
| `IP_СЕРВЕРА` | IP-адрес сервера из панели Timeweb |
| `ПАРОЛЬ_БАЗЫ` | придуманный пароль базы данных (латиница и цифры, без `@`, `:`, `/`) |
| `ПАРОЛЬ_АДМИНА` | пароль администратора сайта, не короче 8 символов |

## 2. Сервер в Timeweb Cloud

Панель Timeweb Cloud → **Облачные серверы** → **Создать**:

- **Операционная система:** Ubuntu 24.04.
- **Регион:** Москва или Санкт-Петербург — персональные данные участников по 152-ФЗ должны храниться в России.
- **Конфигурация:** не меньше 1 vCPU, 2 ГБ RAM, 15 ГБ NVMe. Меньше 2 ГБ памяти не хватит для сборки.
- **Публичный IPv4:** включён.
- **Резервное копирование:** по желанию — платные снимки всего сервера от Timeweb дополняют копии из раздела 14.

После создания на странице сервера будут **IP-адрес** и **пароль root** (ещё он приходит на почту).

## 3. Проверочный адрес на reg.ru

1. reg.ru → **Домены** → `med-expo.org` → **DNS-серверы и управление зоной**.
2. Посмотрите блок **DNS-серверы**:
   - `ns1.reg.ru` и `ns2.reg.ru` (или `ns5`/`ns6` и т. п. на reg.ru) — записи редактируются здесь же, переходите к пункту 3;
   - другие серверы (например, конструктора старого сайта) — записи меняются в панели того сервиса. Либо переключите домен на DNS reg.ru, но сначала перенесите в зону reg.ru все текущие записи, особенно **MX** (почта), иначе перестанет работать почта на домене.
3. **Добавить запись** → тип **A**:
   - **Subdomain / Имя:** `new`
   - **IP Address / Значение:** `IP_СЕРВЕРА`
4. Сохраните. Запись начинает работать через 15 минут — несколько часов.

Проверить с компьютера (PowerShell):

```powershell
nslookup new.med-expo.org
```

В ответе должен быть `IP_СЕРВЕРА`.

## 4. Подключение к серверу

В PowerShell:

```powershell
ssh root@IP_СЕРВЕРА
```

При первом подключении ответьте `yes`, затем введите пароль root (символы при вводе не отображаются — это нормально). Вставка в окне PowerShell — правой кнопкой мыши.

Все команды разделов 5–6 и 10–11 выполняются под `root`, разделов 7–9 — под пользователем `med`. Как переключаться — сказано в каждом разделе.

## 5. Подготовка сервера

Под `root`:

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git nginx postgresql certbot python3-certbot-nginx
node -v
```

`node -v` должен показать `v22.9` или новее.

Файл подкачки на 2 ГБ — страховка, чтобы сборке хватило памяти:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Брандмауэр — открыть только SSH и веб:

```bash
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable
```

Часовой пояс (для логов и резервных копий):

```bash
timedatectl set-timezone Asia/Yekaterinburg
```

Пользователь, от имени которого работает сайт, и право перезапускать службу сайта без пароля (нужно скрипту обновления):

```bash
adduser --disabled-password --gecos "" med
echo "med ALL=(root) NOPASSWD: /usr/bin/systemctl restart med-expo" > /etc/sudoers.d/med-expo
chmod 440 /etc/sudoers.d/med-expo
```

## 6. База данных

Под `root`:

```bash
sudo -u postgres psql -c "CREATE USER med WITH PASSWORD 'ПАРОЛЬ_БАЗЫ';"
sudo -u postgres createdb -O med med_expo
```

PostgreSQL слушает только сам сервер, снаружи база недоступна — так и должно быть.

## 7. Код сайта

Переключитесь на пользователя `med`:

```bash
su - med
```

Скачайте код:

```bash
git clone -b claude/fervent-johnson-83vm4e https://github.com/F31-EXE/med.git ~/app
mkdir -p ~/uploads ~/backups
```

Если репозиторий закрытый, `git clone` спросит логин и пароль GitHub. Вместо пароля нужен токен: GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens** → доступ только к `F31-EXE/med`, права **Contents: Read-only**.

Когда изменения будут влиты в основную ветку, замените `claude/fervent-johnson-83vm4e` на её имя (или переключитесь позже: `cd ~/app && git checkout main`).

## 8. Настройки (.env)

Под `med`:

```bash
cd ~/app/admin
cp server/.env.example server/.env
nano server/.env
```

Приведите файл к такому виду (строки, которых нет в списке, можно оставить как есть):

```ini
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://med:ПАРОЛЬ_БАЗЫ@localhost:5432/med_expo?schema=public"
SHADOW_DATABASE_URL=

SITE_URL="https://new.med-expo.org"
APP_URL="https://new.med-expo.org/admin"
UPLOADS_DIR=/home/med/uploads
METRIKA_ID=

SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Media Expo Group <noreply@med-expo.org>"

SEED_ADMIN_EMAIL="admin@med-expo.org"
SEED_ADMIN_PASSWORD=ПАРОЛЬ_АДМИНА
SEED_ADMIN_NAME="Администратор"

BLOB_READ_WRITE_TOKEN=
CRON_SECRET=
```

- `SITE_URL` и `APP_URL` после переключения домена (раздел 13) поменяются на `https://med-expo.org`.
- `METRIKA_ID` — номер счётчика Яндекс.Метрики, если он есть.
- `BLOB_READ_WRITE_TOKEN` и `CRON_SECRET` на своём сервере не нужны — оставьте пустыми.
- SMTP — раздел 16. Пока пусто, письма не отправляются (их текст пишется в лог).

Сохранить в nano: `Ctrl+O`, `Enter`, выйти: `Ctrl+X`.

Закройте файл от чужих глаз:

```bash
chmod 600 server/.env
```

## 9. Сборка и наполнение базы

Под `med`, в `~/app/admin`:

```bash
npm ci
npm run build
npm run db:deploy -w server
npm run db:seed -w server
npm run db:import-legacy -w server -- --reset
```

- `npm ci` — установка зависимостей (несколько минут).
- `npm run build` — сборка сервера и админки.
- `db:deploy` — создание таблиц.
- `db:seed` — администратор `admin@med-expo.org` с паролем из `.env`.
- `db:import-legacy -- --reset` — данные старого сайта: 46 мероприятий, новости, партнёры, документы, страницы, 301-редиректы. **Только при первой установке** — команда заменяет весь контент сайта.

Вернитесь под `root`:

```bash
exit
```

## 10. Автозапуск

Под `root`:

```bash
cp /home/med/app/admin/deploy/med-expo.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now med-expo
systemctl status med-expo
```

В статусе должно быть `active (running)`, в последних строках — `API запущен: http://localhost:4000/api`. Выход из просмотра статуса — `q`.

Проверка, что сайт отвечает внутри сервера:

```bash
curl -I http://127.0.0.1:4000/
```

Ответ начинается с `HTTP/1.1 200 OK`.

## 11. nginx и HTTPS

Под `root`. Конфиг nginx — с проверочным адресом:

```bash
cp /home/med/app/admin/deploy/nginx-med-expo.conf /etc/nginx/sites-available/med-expo
sed -i 's/server_name med-expo.org www.med-expo.org;/server_name new.med-expo.org;/' /etc/nginx/sites-available/med-expo
ln -s /etc/nginx/sites-available/med-expo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

`nginx -t` должен ответить `syntax is ok` и `test is successful`.

Сертификат Let's Encrypt (DNS-запись из раздела 3 уже должна работать):

```bash
certbot --nginx -d new.med-expo.org
```

Certbot спросит e-mail для уведомлений и согласие с условиями. Он сам допишет HTTPS в конфиг nginx и включит перенаправление с `http` на `https`. Продление сертификата — автоматическое.

> Вход в админку работает только по HTTPS (cookie входа защищены), поэтому до выпуска сертификата войти не получится.

## 12. Проверка

В браузере:

- `https://new.med-expo.org` — главная;
- `https://new.med-expo.org/events?tab=archive` — архив мероприятий;
- `https://new.med-expo.org/sveden` — сведения об образовательной организации и документы;
- `https://new.med-expo.org/meropriyatiya` — должна перенаправить на `/events` (старые адреса работают);
- `https://new.med-expo.org/admin` — вход `admin@med-expo.org` / `ПАРОЛЬ_АДМИНА`.

В админке:

1. Загрузите любую картинку (например, обложку мероприятия) и документ — проверка, что файлы сохраняются.
2. **Настройки → Уведомления** — включите и укажите адреса, куда приходят заявки (после настройки почты, раздел 16).
3. **Пользователи** — пригласите сотрудников.

## 13. Переключение med-expo.org на новый сайт

Когда проверочный сайт устраивает:

**1. DNS на reg.ru.** В зоне `med-expo.org` измените (или создайте) A-записи:

| Имя | Тип | Значение |
|---|---|---|
| `@` | A | `IP_СЕРВЕРА` |
| `www` | A | `IP_СЕРВЕРА` |

Если у `www` стоит запись типа CNAME — удалите её и создайте A. Записи **MX** и **TXT** (почта, подтверждения Яндекса/Google) не трогайте. Запись `new` можно оставить.

Подождите, пока `nslookup med-expo.org` не покажет новый IP.

**2. Сервер.** Под `root`:

```bash
sed -i 's/server_name new.med-expo.org;/server_name med-expo.org www.med-expo.org;/' /etc/nginx/sites-available/med-expo
nginx -t && systemctl reload nginx
certbot --nginx -d med-expo.org -d www.med-expo.org
```

Если certbot спросит про уже существующий сертификат — выберите расширение/замену (`Expand`).

**3. Адрес сайта в настройках.** Под `med`:

```bash
su - med
sed -i 's#https://new.med-expo.org#https://med-expo.org#g' ~/app/admin/server/.env
exit
systemctl restart med-expo
```

**4. Поисковики.** В Яндекс.Вебмастере и Google Search Console для `med-expo.org` отправьте на переобход `https://med-expo.org/sitemap.xml`. Старые адреса страниц отдают 301 на новые, поэтому позиции в поиске сохраняются.

## 14. Резервные копии

Скрипт `deploy/backup.sh` каждую ночь сохраняет базу и загруженные файлы в `/home/med/backups` и удаляет копии старше 14 дней.

Под `med`:

```bash
crontab -e
```

(при первом запуске выберите редактор `nano`) и добавьте строку:

```
30 3 * * * /home/med/app/admin/deploy/backup.sh
```

Проверить вручную:

```bash
~/app/admin/deploy/backup.sh && ls -lh ~/backups
```

Копии лежат на том же сервере — время от времени скачивайте их к себе (PowerShell на компьютере):

```powershell
scp root@IP_СЕРВЕРА:/home/med/backups/* .
```

Восстановление базы из копии (под `med`; заменит текущие данные):

```bash
gunzip -c ~/backups/db-ГГГГ-ММ-ДД.sql.gz | psql "postgresql://med:ПАРОЛЬ_БАЗЫ@localhost:5432/med_expo"
tar -xzf ~/backups/uploads-ГГГГ-ММ-ДД.tar.gz -C /home/med
```

## 15. Обновление сайта

Когда в репозитории появились изменения — под `med`:

```bash
~/app/admin/deploy/update.sh
```

Скрипт скачивает код, ставит зависимости, собирает, применяет новые миграции базы и перезапускает сайт. Данные и загруженные файлы не затрагиваются. Сайт недоступен несколько секунд — во время перезапуска.

## 16. Почта

С сайта уходят письма: приглашения сотрудников, сброс пароля, подтверждение регистрации, уведомления о заявках. Нужен ящик с доступом по SMTP.

**Mail.ru (например, `m-expogroup@inbox.ru`):**

1. В настройках ящика: **Безопасность → Пароли для внешних приложений** → создать пароль (обычный пароль ящика не подойдёт).
2. В `server/.env`:

   ```ini
   SMTP_HOST=smtp.mail.ru
   SMTP_PORT=465
   SMTP_USER=m-expogroup@inbox.ru
   SMTP_PASS=пароль_для_внешних_приложений
   MAIL_FROM="Media Expo Group <m-expogroup@inbox.ru>"
   ```

**Яндекс 360 (ящик на домене, например `noreply@med-expo.org`):** `SMTP_HOST=smtp.yandex.ru`, `SMTP_PORT=465`, пароль приложения из настроек Яндекс ID, `MAIL_FROM` — тот же адрес.

Адрес в `MAIL_FROM` должен совпадать с `SMTP_USER`, иначе почтовик откажет в отправке.

После правки: `sudo systemctl restart med-expo` (под `med`) или `systemctl restart med-expo` (под `root`). Проверка — пригласите себя в **Пользователи** и дождитесь письма.

Timeweb закрывает исходящий порт 25 — используйте 465 или 587, как выше.

## 17. Если что-то не работает

**Журнал сайта** (под `root`):

```bash
journalctl -u med-expo -n 100 --no-pager
journalctl -u med-expo -f
```

**Частые случаи:**

| Что видно | Причина и что делать |
|---|---|
| `502 Bad Gateway` в браузере | Сайт не запущен: `systemctl status med-expo`, ошибка — в журнале. |
| `Некорректные переменные окружения` в журнале | Ошибка в `server/.env` — проверьте строку, названную в сообщении. |
| `DatabaseNotReachable` / `password authentication failed` | Неверный `DATABASE_URL` или пароль: сверьте с разделом 6. |
| Админка открывается, но после входа снова форма входа | Сайт открыт по `http`, а не `https`, или `SITE_URL` не совпадает с адресом в браузере. |
| `certbot` пишет про DNS / `Timeout during connect` | A-запись ещё не обновилась (`nslookup`), или закрыт порт: `ufw status` должен показывать `Nginx Full`. |
| Не загружается большой файл, ошибка 413 | Лимит в nginx: `client_max_body_size` в `/etc/nginx/sites-available/med-expo` (сейчас 25 МБ). |
| `npm run build` завершается `Killed` | Не хватило памяти: проверьте, что включён swap (`free -h`), или увеличьте RAM сервера. |
| Письма не приходят | В журнале строка `[mail] SMTP не настроен` — заполните SMTP (раздел 16); `Invalid login` — нужен пароль для внешних приложений. |

**Полезные команды** (под `root`):

```bash
systemctl restart med-expo        # перезапуск сайта
systemctl reload nginx            # применить изменения nginx
certbot renew --dry-run           # проверить продление сертификата
df -h                             # место на диске
du -sh /home/med/uploads /home/med/backups
```
