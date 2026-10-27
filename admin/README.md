# Админ-панель Media Expo Group

Закрытая часть сайта med-expo.org для сотрудников (раздел 6 ТЗ).

- `server/` — API: Node, Express 5, TypeScript, Prisma 7, PostgreSQL
- `client/` — интерфейс: Vite, React 19, Ant Design 6, React Router, TanStack Query

## Запуск для разработки

Нужны Node 22+ и PostgreSQL 16.

```bash
npm install
cp server/.env.example server/.env
```

В `server/.env` укажите `DATABASE_URL` (база создастся сама) и `SEED_ADMIN_PASSWORD`, затем:

```bash
npm run db:migrate -w server
npm run db:seed -w server
npm run dev
```

Админка: http://127.0.0.1:5173, API: http://127.0.0.1:4000/api. Vite проксирует `/api` на сервер.

Если SMTP не настроен, письма (например, ссылка для сброса пароля) выводятся в консоль сервера.

## Авторизация

- Вход по e-mail и паролю, сессия в БД, токен в cookie `httpOnly`, `SameSite=Strict`, срок 7 дней с продлением при активности.
- Пароли — bcrypt; токены сессий и сброса пароля хранятся только в виде SHA-256.
- 5 неверных паролей подряд блокируют учётную запись на 15 минут; дополнительно ограничение 20 запросов за 15 минут с одного IP на вход и восстановление.
- Восстановление пароля по ссылке из письма (1 час, одноразовая); после смены пароля все сеансы пользователя завершаются.
- Изменяющие запросы к API принимаются только с заголовком `X-Requested-With: XMLHttpRequest` (защита от CSRF вместе с `SameSite`).
- Роли: `ADMIN`, `EDITOR`, `REGISTRATION_MANAGER`. На сервере — `requireRole(...)`, в интерфейсе — список разделов по роли в `client/src/auth/roles.ts`.

## API

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/logout` | Выход |
| GET | `/api/auth/me` | Текущий пользователь |
| POST | `/api/auth/forgot-password` | Письмо со ссылкой для сброса |
| POST | `/api/auth/reset-password` | Новый пароль по токену |
