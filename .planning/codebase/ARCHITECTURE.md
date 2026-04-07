# Архитектура

**Дата анализа:** 2026-04-07

## Обзор паттерна

**В целом:** Turborepo + pnpm workspace (монорепо), 3 приложения в `apps/` и общий пакет БД в `packages/`.

**Ключевые характеристики:**
- **Разделение по доменам**: отдельные процессы/порты для API gateway, auth и frontend.
- **Единый источник истины по схеме БД**: Prisma-схема в `packages/Astrum-db/prisma/schema.prisma`.
- **JWT-сессия через cookie**: токен хранится в cookie `__auth` и используется как контракт между фронтом и бэкендом.

## Сервисы и их роли

### Customer Frontend (`@astrum/customer`)

- **Назначение**: клиентское web-приложение (Next.js App Router).
- **Расположение**: `apps/customer/`
- **Роутинг**: `apps/customer/src/app/**/page.tsx`, группировка сегментов в `apps/customer/src/app/(auth)/...` и `apps/customer/src/app/(content)/...`
- **Auth gate (edge middleware)**: `apps/customer/src/middleware.ts`
  - Публичные маршруты: `["/auth/signin", "/auth/register"]`
  - Остальное требует cookie `__auth` и валидного `userId` в payload (см. `decrypt()`).
- **Сессии (cookie) и проверка JWT**: `apps/customer/src/common/helpers/session.ts`
  - `createSession(token)` устанавливает httpOnly cookie `__auth`
  - `decrypt(cookie)` делает `jwtVerify()` по `process.env.JWT_SECRET`
  - `verifySession()` (server-side, `cache`) редиректит на `/auth/signin` если payload невалиден
- **Вызовы API**: `apps/customer/src/hooks/useFetcher.ts`
  - axios instance с `withCredentials: true`
  - baseURL: `process.env.NEXT_PUBLIC_API_GATEWAY_URL` (контракт: URL API gateway)

### API Gateway (`@astrum/api`)

- **Назначение**: единая точка входа для фронта, проксирование auth и доменные CRUD-модули.
- **Расположение**: `apps/api-astrum/`
- **Entrypoint**: `apps/api-astrum/src/server.ts` (слушает порт **3580**)
- **Сборка приложения/маршрутизация**: `apps/api-astrum/src/app.ts`
  - **Прокси на auth-сервис**: `app.use('/api/auth', proxyOptions(process.env.AUTH_SERVICE_URL!))`
    - Источник: `apps/api-astrum/src/app.ts`
    - Клиент: `apps/api-astrum/src/common/helpers/proxyOptions.ts` (через `http-proxy-middleware`)
  - **Доменные роуты** (все под `authenticateToken`):
    - `/api/users` → `apps/api-astrum/src/modules/user/user.routes.ts`
    - `/api/products` → `apps/api-astrum/src/modules/product/product.routes.ts`
    - `/api/wishlist` → `apps/api-astrum/src/modules/wishlist/wishlist.routes.ts`
    - `/api/cart` → `apps/api-astrum/src/modules/cart/cart.routes.ts`
    - `/api/orders` → `apps/api-astrum/src/modules/order/order.routes.ts`
    - `/api/reviews` → `apps/api-astrum/src/modules/reviews/reviews.routes.ts`
- **Контракт авторизации (JWT)**: `apps/api-astrum/src/middlewares/authenticateToken.ts`
  - Читает cookie `__auth`
  - Делает `verify(token, process.env.JWT_SECRET)`
  - Кладёт `userId` в `req.userId` для модулей
- **Слои внутри доменного модуля (пример user)**:
  - router: `apps/api-astrum/src/modules/user/user.routes.ts`
  - controller: `apps/api-astrum/src/modules/user/user.controller.ts`
  - service: `apps/api-astrum/src/modules/user/user.service.ts` (работа с Prisma)
  - DTO validation middleware: `apps/api-astrum/src/middlewares/validateDto.ts` (class-validator/class-transformer)
  - Ошибки: `apps/api-astrum/src/common/helpers/errorHandler.ts` (маппинг Error → 400)

### Auth Service (`@astrum/auth`)

- **Назначение**: регистрация/логин и выпуск JWT.
- **Расположение**: `apps/auth-astrum/`
- **Entrypoint**: `apps/auth-astrum/src/main.ts` (слушает порт **4580**)
  - `app.setGlobalPrefix('/api')` → все контроллеры живут под `/api/*`
  - Swagger: `SwaggerModule.setup('swagger', ...)` (путь `/swagger`)
  - CORS ограничен `origin: ['http://localhost:3000']`
- **Композиция модулей**: `apps/auth-astrum/src/app.module.ts`
  - `ConfigModule.forRoot({ isGlobal: true })`
  - `AuthModule` (`apps/auth-astrum/src/auth/auth.module.ts`)
  - `PrismaModule` (`apps/auth-astrum/src/prisma/prisma.module.ts`, помечен `@Global()`)
- **HTTP-контракты**:
  - `POST /api/auth/register` → `apps/auth-astrum/src/auth/auth.controller.ts`
  - `POST /api/auth/signin` → `apps/auth-astrum/src/auth/auth.controller.ts`
  - Возвращаемое значение: `{ token, expiresIn }` (источник: `apps/auth-astrum/src/auth/auth.service.ts`)
- **JWT-контракт**:
  - payload: `{ userId }` (источник: `apps/auth-astrum/src/auth/auth.service.ts`)
  - секрет: `JWT_SECRET` через `ConfigService` (источник: `apps/auth-astrum/src/auth/auth.service.ts`)

## Общий пакет БД (`@astrum/db`) и контракт схемы

### Источник схемы

- **Prisma schema**: `packages/Astrum-db/prisma/schema.prisma`
  - Определяет доменные модели (`User`, `Product`, `Order`, `Review`, …)
  - generator `client.output = "../generated/prisma"` (источник: `packages/Astrum-db/prisma/schema.prisma`)

### Доступ к PrismaClient

- Экспорт prisma singleton: `packages/Astrum-db/lib/prisma.ts`
- Публичный экспорт пакета: `packages/Astrum-db/lib/index.ts`

### Использование Prisma в сервисах

**API gateway (`@astrum/api`)**:
- В модулях импортируется prisma из локального слоя: пример `apps/api-astrum/src/modules/user/user.service.ts` импортирует `../../../lib/prisma`
- Реальная инициализация Prisma: `apps/api-astrum/lib/prisma.ts` (использует `@prisma/adapter-pg` и `process.env.DATABASE_URL`)

**Auth (`@astrum/auth`)**:
- `apps/auth-astrum/src/prisma/prisma.service.ts` расширяет `PrismaClient` и создаёт adapter `PrismaPg` из `process.env.DATABASE_URL`
- Импорт клиента: `../../generated/prisma/client` (гипотеза: generated артефакты не закоммичены; источник: `apps/auth-astrum/src/prisma/prisma.service.ts`)

## Потоки данных (практически)

### Поток “Регистрация/Логин”

1. UI форма (например SignIn): `apps/customer/src/features/auth/SignIn/index.tsx`
2. Хук отправляет запрос на gateway: `apps/customer/src/hooks/auth/useAuth.ts` → `fetcher.post("/auth/signin" | "/auth/register")`
   - baseURL берётся из `process.env.NEXT_PUBLIC_API_GATEWAY_URL` (источник: `apps/customer/src/hooks/useFetcher.ts`)
3. Gateway проксирует `/api/auth/*` на auth-сервис: `apps/api-astrum/src/app.ts`
4. Auth сервис возвращает JWT: `apps/auth-astrum/src/auth/auth.service.ts` → `signToken()`
5. Frontend записывает JWT в cookie `__auth`: `apps/customer/src/common/helpers/session.ts` → `createSession(token)`

### Поток “Доступ к защищённым ресурсам (CRUD)”

1. Browser автоматически прикладывает cookie `__auth` (axios `withCredentials: true`): `apps/customer/src/hooks/useFetcher.ts`
2. Gateway проверяет JWT и выставляет `req.userId`: `apps/api-astrum/src/middlewares/authenticateToken.ts`
3. Router → controller → service выполняют операцию и обращаются к БД через Prisma:
   - пример: `apps/api-astrum/src/modules/user/user.routes.ts` → `user.controller.ts` → `user.service.ts`

## Зависимости и “контракты” между сервисами

**Контракт 1: URL API gateway**
- Frontend ожидает `NEXT_PUBLIC_API_GATEWAY_URL` как baseURL (источник: `apps/customer/src/hooks/useFetcher.ts`)

**Контракт 2: URL Auth service**
- Gateway ожидает `AUTH_SERVICE_URL` для проксирования (источник: `apps/api-astrum/src/app.ts`)

**Контракт 3: JWT_SECRET общий**
- Frontend (`jose/jwtVerify`), Gateway (`jsonwebtoken/verify`) и Auth service (`@nestjs/jwt/signAsync`) используют `JWT_SECRET`
  - Источники: `apps/customer/src/common/helpers/session.ts`, `apps/api-astrum/src/middlewares/authenticateToken.ts`, `apps/auth-astrum/src/auth/auth.service.ts`
  - Практический вывод: секрет должен быть одинаковым для всех трёх компонентов, иначе авторизация ломается

**Контракт 4: cookie-имя**
- `__auth` как имя cookie используется везде (источники: `apps/customer/src/common/helpers/session.ts`, `apps/customer/src/middleware.ts`, `apps/api-astrum/src/middlewares/authenticateToken.ts`)

## Entrypoints (server/bootstrap)

- **API gateway**: `apps/api-astrum/src/server.ts` → `import app from "./app"` → `app.listen(3580)`
- **Auth service**: `apps/auth-astrum/src/main.ts` → `bootstrap()` → `NestFactory.create(AppModule)` → `listen(4580)`
- **Frontend**: Next.js entry управляется фреймворком, ключевые точки:
  - Root layout: `apps/customer/src/app/layout.tsx`
  - Auth/content layouts: `apps/customer/src/app/(auth)/auth/layout.tsx`, `apps/customer/src/app/(content)/layout.tsx`
  - Middleware: `apps/customer/src/middleware.ts`

---

*Архитектурный анализ: 2026-04-07*

