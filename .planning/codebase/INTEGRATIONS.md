# External Integrations

**Дата анализа:** 2026-04-07

## Базы данных и хранилища данных

### PostgreSQL (основная БД)

- **Назначение**: основное хранилище данных для всех доменных моделей (пользователи, товары, заказы, отзывы и т.д.)
- **Где используется**:
  - Prisma schema/migrations: `packages/Astrum-db/prisma/schema.prisma`, `packages/Astrum-db/prisma/migrations/*`
  - Prisma client/adapter в API gateway: `apps/api-astrum/lib/prisma.ts`
  - Prisma client/adapter в auth service: `apps/auth-astrum/src/prisma/prisma.service.ts`
  - Prisma config (url берётся из env):  
    - `packages/Astrum-db/prisma.config.ts`  
    - `apps/api-astrum/prisma.config.ts`  
    - `apps/auth-astrum/prisma.config.ts`
- **Docker (локально/инфра)**:
  - `docker-compose.yml` поднимает `postgres:13` как сервис `astrum-db`
  - `docker-compose.yml` использует `env_file: packages/Astrum-db/.env` (файл присутствует по ссылке в compose; содержимое не анализировалось)
- **Env**:
  - `DATABASE_URL` — используется в Prisma конфиге и рантайм-клиенте:
    - `turbo.json#globalEnv` (пробрасывается в turbo tasks)
    - `packages/Astrum-db/prisma.config.ts`
    - `apps/api-astrum/lib/prisma.ts`
    - `apps/auth-astrum/src/prisma/prisma.service.ts`

## Аутентификация и идентификация

### JWT (кастомная аутентификация)

- **Назначение**: выдача и проверка JWT для пользовательских сессий
- **Где используется**:
  - Auth service (выдача токенов):
    - `apps/auth-astrum/src/auth/auth.service.ts` (подпись токена через `JwtService`)
    - `apps/auth-astrum/src/auth/strategy/jwt.strategy.ts` (валидация через `passport-jwt`)
  - API gateway (проверка токена в cookie):
    - `apps/api-astrum/src/middlewares/authenticateToken.ts` (verify cookie `__auth`)
  - Frontend (проверка сессии на сервере Next.js middleware/утилитой):
    - `apps/customer/src/common/helpers/session.ts`
    - `apps/customer/src/middleware.ts`
- **Хранение токена**:
  - Cookie `__auth` выставляется серверной функцией в Next: `apps/customer/src/common/helpers/session.ts`
  - API gateway ожидает cookie `__auth`: `apps/api-astrum/src/middlewares/authenticateToken.ts`
- **Env**:
  - `JWT_SECRET`
    - используется в API gateway: `apps/api-astrum/src/middlewares/authenticateToken.ts`
    - используется в auth service через `@nestjs/config`: `apps/auth-astrum/src/auth/auth.service.ts`, `apps/auth-astrum/src/auth/strategy/jwt.strategy.ts`
    - используется в customer (server-side verify): `apps/customer/src/common/helpers/session.ts`

## Внутрисервисные интеграции (монорепо)

### API gateway → Auth service (reverse proxy)

- **Назначение**: проксирование auth-эндпоинтов через единый gateway
- **Где используется**:
  - Маршрут прокси: `apps/api-astrum/src/app.ts` (`/api/auth`)
  - Реализация прокси: `apps/api-astrum/src/common/helpers/proxyOptions.ts` (на базе `http-proxy-middleware`)
- **Env**:
  - `AUTH_SERVICE_URL` — target для прокси: `apps/api-astrum/src/app.ts`
- **Docker**:
  - `docker-compose.yml` поднимает `astrum-api` и `astrum-auth` с `env_file`:
    - `apps/api-astrum/.env.prod` (содержимое не анализировалось)
    - `apps/auth-astrum/.env.prod` (содержимое не анализировалось)

### Frontend → API gateway (HTTP, cookies)

- **Назначение**: клиентские запросы из Next.js к gateway с передачей cookie
- **Где используется**:
  - Axios instance с `withCredentials: true`: `apps/customer/src/hooks/useFetcher.ts`
- **Env**:
  - `NEXT_PUBLIC_API_GATEWAY_URL` — baseURL для axios: `apps/customer/src/hooks/useFetcher.ts`
- **Примечание**: этот env должен быть доступен на клиенте (префикс `NEXT_PUBLIC_`).

## Платежи

### Stripe / PayPal (следы в доменной модели)

- **Статус**: интеграция как SDK/обработчики не обнаружена; присутствует как варианты в перечислении методов оплаты.
- **Где используется**:
  - Prisma enum `PaymentMethod` содержит `PAYPAL`, `STRIPE`:
    - `packages/Astrum-db/prisma/schema.prisma`
    - `apps/api-astrum/prisma/schema.prisma`
    - `apps/auth-astrum/prisma/schema.prisma`
- **Env**: переменные вида `STRIPE_*`, `PAYPAL_*` по коду/зависимостям не обнаружены.

## Email / SMS / уведомления

- **Статус**: SDK/провайдеры (SendGrid/Mailgun/Nodemailer/SES и т.п.) в зависимостях и коде не обнаружены.

## Объектное хранилище (S3/MinIO) и файлы

- **S3/MinIO SDK**: не обнаружено (`@aws-sdk/*`, `aws-sdk`, `minio` отсутствуют в найденных местах).
- **Внешние источники изображений (remote images)**:
  - Next.js `images.remotePatterns`: `apps/customer/next.config.ts`
  - Домены, на которые настроены remotePatterns:
    - `flowbite.s3.amazonaws.com`
    - `bundui-images.netlify.app`
    - `images.unsplash.com`
    - `magazilla.ru`
    - `mzimg.com`

## Очереди/стриминг/кэш

- **Redis/BullMQ/RabbitMQ/Kafka/NATS**: не обнаружено по зависимостям/коду.

## Аналитика/мониторинг/трекинг ошибок

- **Sentry/Datadog/GA/Amplitude/PostHog**: не обнаружено по зависимостям/коду.
- **Логи**: `morgan` в API gateway (`apps/api-astrum/src/app.ts`).

## GraphQL

- **Статус**: в `apps/customer/package.json` присутствуют зависимости `@apollo/client` и `@apollo/client-integration-nextjs`, но явных GraphQL-операций/клиентов по структуре (`apollo*`, `graphql*`) не обнаружено.
- **Где видно**:
  - Зависимости: `apps/customer/package.json`

## CI/CD и деплой

- **Docker**:
  - `docker-compose.yml` описывает 4 сервиса: `astrum-db`, `astrum-api`, `astrum-auth`, `astrum-customer`
  - В `apps/*/Dockerfile` используется `corepack` + `pnpm` и фильтр-установка (`pnpm install --filter ...`)
- **Env files для контейнеров** (только факт наличия ссылки):
  - `packages/Astrum-db/.env`
  - `apps/api-astrum/.env.prod`
  - `apps/auth-astrum/.env.prod`
  - `apps/customer/.env.production`

## Сводка env-переменных (по коду/конфигам)

| Env | Назначение | Где используется |
|---|---|---|
| `DATABASE_URL` | строка подключения к Postgres для Prisma | `turbo.json`, `packages/Astrum-db/prisma.config.ts`, `apps/api-astrum/prisma.config.ts`, `apps/auth-astrum/prisma.config.ts`, `apps/api-astrum/lib/prisma.ts`, `apps/auth-astrum/src/prisma/prisma.service.ts` |
| `JWT_SECRET` | подпись/проверка JWT | `apps/auth-astrum/src/auth/auth.service.ts`, `apps/auth-astrum/src/auth/strategy/jwt.strategy.ts`, `apps/api-astrum/src/middlewares/authenticateToken.ts`, `apps/customer/src/common/helpers/session.ts` |
| `AUTH_SERVICE_URL` | target для прокси gateway → auth | `apps/api-astrum/src/app.ts` |
| `NEXT_PUBLIC_API_GATEWAY_URL` | baseURL для фронта (axios) | `apps/customer/src/hooks/useFetcher.ts` |

---

*Integration audit: 2026-04-07*
