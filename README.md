## Astrum

Монорепозиторий с фронтендом и бэкендом на базе Turborepo + pnpm workspaces.

### Структура

- **Frontend (customer)**: `apps/customer`
- **Backend API (api-astrum)**: `apps/api-astrum`
- **Auth service (auth-astrum)**: `apps/auth-astrum`
- **Database / Prisma**: `packages/Astrum-db`
- **Прочие общие пакеты**: `packages/*`

### Требования

- Node.js (рекомендуется LTS)
- pnpm (см. версию в `package.json`, поле `packageManager`)
- Docker и Docker Compose (для локальной БД и инфраструктуры)

### Установка и быстрый старт

Все команды выполняются из корня монорепозитория.

1. **Установка зависимостей**

```bash
pnpm install
```

2. **База данных и Prisma (dev)**

```bash
# поднять контейнер с БД
pnpm db:up

# применить миграции (dev)
pnpm prisma:migrate:dev
```

3. **Запуск в режиме разработки**

```bash
# запустить все основные приложения через Turborepo
pnpm dev

# либо по отдельности
pnpm dev:customer
pnpm dev:api
pnpm dev:auth
pnpm dev:business
```

### Скрипты (корень репозитория)

Основные скрипты из корневого `package.json`:

- **Разработка**
  - **`pnpm dev`**: общий dev‑режим через Turborepo.
  - **`pnpm dev:customer`**: dev только для `apps/customer`.
  - **`pnpm dev:api`**: dev только для `apps/api-astrum`.
  - **`pnpm dev:auth`**: dev только для `apps/auth-astrum`.
  - **`pnpm dev:business`**: dev только для `apps/business`.

- **Сборка и проверка**
  - **`pnpm build`**: сборка всех приложений/пакетов через Turborepo.
  - **`pnpm lint`**: запуск линтеров во всех пакетах.
  - **`pnpm check-types`**: проверка типов во всех пакетах.

- **Prisma / БД (пакет `packages/Astrum-db`)**
  - **`pnpm db:generate`**: генерация клиента БД (использует `@astrum/db`).
  - **`pnpm prisma:generate`**: `prisma generate` для `packages/Astrum-db`.
  - **`pnpm prisma:migrate:dev`**: `prisma migrate dev` (dev‑миграции).
  - **`pnpm prisma:migrate:deploy`**: `prisma migrate deploy` (prod‑миграции).
  - **`pnpm prisma:studio`**: запуск Prisma Studio.
  - **`pnpm prisma:seed`**: сидинг данных.

- **Docker / инфраструктура**
  - **`pnpm db:up`**: поднять контейнер `astrum-db` в Docker.
  - **`pnpm db:rm`**: удалить контейнер `astrum-db` с томами.
  - **`pnpm db:restart`**: пересоздать БД и применить миграции (`db:rm` → `db:up` → `prisma:migrate:deploy`).
  - **`pnpm docker:up`**: поднять все сервисы из `docker-compose`.
  - **`pnpm docker:down`**: остановить и удалить все сервисы из `docker-compose`.

Отдельные приложения (`apps/*`) могут иметь свои специфические скрипты (Next.js, NestJS и т.д.) — подробности см. в `package.json` соответствующего приложения. Как правило, dev‑запуск удобнее делать через корневые Turborepo‑скрипты, описанные выше.

### Database / Prisma

- Основная схема Prisma и конфигурация БД находятся в пакете `packages/Astrum-db`.
- Файл схемы: `packages/Astrum-db/prisma/schema.prisma`.
- Конфигурация Prisma: `packages/Astrum-db/prisma.config.ts`.
- Для работы с БД используются корневые скрипты `pnpm db:*` и `pnpm prisma:*` (см. выше).

### Переменные окружения

Бэкенд и сервисы аутентификации используют файлы:

- **`.env`** для dev
- **`.env.prod`** для prod

Расположение основных `.env`:

- `apps/api-astrum/.env`, `apps/api-astrum/.env.prod`
- `apps/auth-astrum/.env`, `apps/auth-astrum/.env.prod`
- `packages/Astrum-db/.env` (PostgreSQL‑переменные + `DATABASE_URL`)

`DATABASE_URL` и связанные переменные для БД должны соответствовать значениям, которые использует пакет `packages/Astrum-db` (см. `packages/Astrum-db/prisma.config.ts` и `.env` в этом пакете).
