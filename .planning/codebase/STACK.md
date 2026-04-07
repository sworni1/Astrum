# Technology Stack

**Дата анализа:** 2026-04-07

## Языки и рантайм

- **TypeScript**: используется во всех сервисах (`apps/api-astrum`, `apps/auth-astrum`, `apps/customer`, `packages/Astrum-db`)
- **Node.js**:
  - **Node 18 (alpine)**: контейнеры `apps/api-astrum/Dockerfile`, `apps/auth-astrum/Dockerfile`
  - **Node 20 (alpine)**: контейнер `apps/customer/Dockerfile`

## Монорепо и сборка

### Менеджер пакетов

- **pnpm**: `pnpm@10.4.0` (см. `package.json#packageManager`)
- Workspaces: `pnpm-workspace.yaml` (`apps/*`, `packages/*`)

### Оркестрация задач

- **Turborepo**: `turbo@^2.8.18` (см. `package.json`)
  - Pipeline: `turbo.json`
  - **Глобальная env-переменная для задач**: `DATABASE_URL` (`turbo.json#globalEnv`)

## Сервисы (apps/*)

### `@astrum/api` — API Gateway (Express)

- **Пакет**: `apps/api-astrum/package.json`
- **Стек**:
  - Express `^4.21.2`
  - Prisma Client `^7.5.0` + `@prisma/adapter-pg` `^7.5.0` (PostgreSQL)
  - `pg` `^8.20.0`
  - Auth/JWT: `jsonwebtoken` `^9.0.2`
  - Security/HTTP: `helmet`, `cors`, `cookie-parser`, `morgan`
  - Proxy: `http-proxy-middleware` `^3.0.3`
  - Runtime TS: `tsx` `^4.21.0`
- **Порт**: `3580` (`apps/api-astrum/src/server.ts`)
- **Запуск**:
  - Dev: `pnpm dev:api` (корень) → `turbo dev --filter=@astrum/api` (`package.json`)
  - Локально в пакете: `pnpm --filter @astrum/api dev` (`apps/api-astrum/package.json`)
  - Prod: `pnpm --filter @astrum/api start:prod` (использует `.env.prod`, см. `apps/api-astrum/package.json`)

### `@astrum/auth` — Auth service (NestJS)

- **Пакет**: `apps/auth-astrum/package.json`
- **Стек**:
  - NestJS `^10.x` (`@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/swagger`)
  - Auth/JWT: `@nestjs/jwt`, `passport`, `passport-jwt`
  - Hashing: `argon2`
  - Validation: `class-validator`, `class-transformer`, `ValidationPipe`
  - Prisma Client `^7.5.0` + `@prisma/adapter-pg` `^7.5.0`, `pg` `^8.20.0`
  - Тесты: Jest (скрипты `test*` в `apps/auth-astrum/package.json`)
- **Порт**: `4580` (`apps/auth-astrum/src/main.ts`)
- **Swagger**: включён, путь `swagger` (`apps/auth-astrum/src/main.ts`)
- **Запуск**:
  - Dev: `pnpm dev:auth` (корень) → `turbo dev --filter=@astrum/auth` (`package.json`)
  - Локально в пакете: `pnpm --filter @astrum/auth dev`
  - Prod: `pnpm --filter @astrum/auth start:prod`

### `@astrum/customer` — Frontend (Next.js App Router)

- **Пакет**: `apps/customer/package.json`
- **Стек**:
  - Next.js **15.4.2**
  - React **19.1.0**
  - UI: Radix UI (`@radix-ui/*`), shadcn (`shadcn`), Tailwind CSS **4.1.11**
  - Data fetching: `axios`, `swr`
  - Validation: `zod`
  - (В зависимостях присутствует GraphQL-клиент) `@apollo/client`, `@apollo/client-integration-nextjs`
  - JWT libs: `jose`, `jsonwebtoken`, `jwt-decode`
- **Порт**: `3000` (docker/дефолт Next; контейнер выставляет `PORT=3000`, см. `apps/customer/Dockerfile`)
- **Запуск**:
  - Dev: `pnpm dev:customer` (корень) → `turbo dev --filter=@astrum/customer` (`package.json`)
  - Локально в пакете: `pnpm --filter @astrum/customer dev`
  - Prod: `pnpm --filter @astrum/customer start`

## Пакеты (packages/*)

### `@astrum/db` — Prisma schema/migrations/client

- **Пакет**: `packages/Astrum-db/package.json`
- **Стек**:
  - Prisma `^7.5.0` (в т.ч. `catalog:prisma` из `pnpm-workspace.yaml`)
  - `@prisma/client` `^7.5.0`, `@prisma/adapter-pg` `^7.5.0`
  - PostgreSQL драйвер: `pg` `^8.20.0`
  - Seed tooling: `tsx`, `xlsx`
- **Команды** (из корня и пакета):
  - Генерация клиента: `pnpm db:generate` (корень) → `pnpm --filter @astrum/db db:generate` (`package.json`)
  - Миграции dev: `pnpm prisma:migrate:dev` (корень) → `pnpm --filter @astrum/db exec prisma migrate dev`
  - Миграции deploy: `pnpm prisma:migrate:deploy` (корень) → `pnpm --filter @astrum/db exec prisma migrate deploy`
  - Prisma Studio: `pnpm prisma:studio` (корень)
  - Seed: `pnpm prisma:seed` (корень) → `pnpm --filter @astrum/db seed`

## Инфраструктура и локальная разработка

- **PostgreSQL (Docker)**: `docker-compose.yml` использует `postgres:13`
- **Сеть Docker**: `astrumnetwork` помечена как `external: true` (`docker-compose.yml`)

## Основные команды (корень репозитория)

См. `package.json` и `README.md`:

- **Установка**: `pnpm install`
- **Dev (всё)**: `pnpm dev` (стартует `astrum-db` и запускает `turbo dev`)
- **Dev (по сервисам)**: `pnpm dev:customer`, `pnpm dev:api`, `pnpm dev:auth`
- **Сборка**: `pnpm build`
- **Линт**: `pnpm lint`
- **Типы**: `pnpm check-types`
- **Docker**: `pnpm docker:up`, `pnpm docker:down`
- **База**: `pnpm db:up`, `pnpm db:rm`, `pnpm db:restart`

---

*Stack analysis: 2026-04-07*
