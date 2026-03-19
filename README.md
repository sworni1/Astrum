## Astrum

Монорепозиторий с фронтендом и бэкендом.

### Структура

- **Frontend (customer)**: `Astrum-frontend/customer`
- **Backend (api-astrum)**: `Astrum-backend/api-astrum`
- **Auth service (auth-astrum)**: `Astrum-backend/auth-astrum`
- **Database (Astrum-db)**: `Astrum-db`
- **Prisma schema**: `Astrum-backend/api-astrum/prisma/schema.prisma`

### Требования

- Node.js (рекомендуется LTS)
- npm
- Docker (опционально, если используете `docker compose`)

### Быстрый старт

#### Frontend (customer)

Перейти в папку и установить зависимости:

```bash
cd Astrum-frontend/customer
npm i
```

Запуск в разработке:

```bash
npm run dev
```

Сборка и запуск:

```bash
npm run build
npm run start
```

#### Backend (api-astrum)

Перейти в папку и установить зависимости:

```bash
cd Astrum-backend/api-astrum
npm i
```

Сборка TypeScript:

```bash
npm run build
```

Запуск:

```bash
# dev (читает .env)
npm run dev

# старт с предварительной сборкой (читает .env)
npm run start:dev

# prod (читает .env.prod)
npm run start:prod
```

#### Auth service (auth-astrum)

Перейти в папку и установить зависимости:

```bash
cd Astrum-backend/auth-astrum
npm i
```

Запуск в разработке:

```bash
npm run dev
```

Сборка и запуск:

```bash
npm run build
npm run start:prod
```

#### Database (Astrum-db)

База поднимается через Docker Compose (PostgreSQL).

```bash
cd Astrum-db
docker compose up -d
```

### Скрипты

#### Frontend (customer) — `Astrum-frontend/customer`

- **`npm run dev`**: запуск Next.js в режиме разработки
- **`npm run build`**: сборка Next.js
- **`npm run start`**: запуск собранного приложения
- **`npm run lint`**: ESLint (Next.js lint)
- **`npm run prettier`**: форматирование (Prettier)
- **`npm run linper`**: Prettier → небольшая пауза → ESLint
- **`npm run build:prod`**: сборка TypeScript project references + Next build
- **`npm run docker:compose`**: пересоздание/сборка сервиса фронта через Docker Compose

#### Backend (api-astrum) — `Astrum-backend/api-astrum`

- **`npm run build`**: компиляция TypeScript
- **`npm run dev`**: запуск собранного сервера (читает `.env`)
- **`npm run start:dev`**: build → запуск (читает `.env`)
- **`npm run start:prod`**: запуск (читает `.env.prod`)
- **`npm run docker:compose`**: пересоздание/сборка сервиса бэка через Docker Compose

#### Auth service (auth-astrum) — `Astrum-backend/auth-astrum`

- **`npm run dev`**: NestJS в watch-режиме
- **`npm run build`**: сборка NestJS
- **`npm run start`**: запуск NestJS
- **`npm run start:prod`**: запуск `dist/main`
- **`npm run lint`**: ESLint (`--fix`)
- **`npm run format`**: Prettier (ts-файлы)
- **`npm run prisma:deploy`**: `prisma generate` с `.env.prod`
- **`npm run docker:compose`**: пересоздание/сборка контейнера `auth-service` через Docker Compose

#### Database (Astrum-db) — `Astrum-db`

- **`docker compose up -d`**: поднять PostgreSQL
- **`docker compose down`**: остановить и удалить контейнер

### Переменные окружения

Бэкенд использует файлы:

- **`.env`** для dev
- **`.env.prod`** для prod

Auth service использует:

- **`.env`** для dev
- **`.env.prod`** для prod (в том числе для `docker compose`)

Astrum-db использует:

- **`.env`** (PostgreSQL переменные + `DATABASE_URL`)

Конкретный набор переменных см. по месту использования в `Astrum-backend/api-astrum` и `Astrum-backend/auth-astrum`.
