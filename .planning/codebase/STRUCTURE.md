# Структура репозитория

**Дата анализа:** 2026-04-07

## Дерево верхнего уровня (куда смотреть в первую очередь)

```
E:/Astrum/Astrum/
├── apps/                          # приложения (runtime-сервисы)
│   ├── api-astrum/                # Express API gateway (порт 3580)
│   ├── auth-astrum/               # NestJS auth service (порт 4580)
│   └── customer/                  # Next.js frontend (порт 3000)
├── packages/
│   └── Astrum-db/                 # Prisma schema + генерация клиента + сиды
├── .planning/                     # планы/артефакты процессов
│   └── codebase/                  # (это сюда пишутся карты кодовой базы)
├── docs/                          # проектная документация
├── .husky/                        # git hooks
├── package.json                   # корневые скрипты (turbo/pnpm)
├── pnpm-workspace.yaml            # workspace packages (apps/*, packages/*)
├── pnpm-lock.yaml                 # lockfile
├── turbo.json                     # Turborepo pipeline (build/dev/lint/...)
├── docker-compose.yml             # инфраструктура (например postgres контейнер)
└── .env                           # env-конфиг (не читать в анализе)
```

## Workspace и сборка (монорепо)

- **Workspace-границы**: `pnpm-workspace.yaml`
  - `apps/*`
  - `packages/*`
- **Orchestration задач**: `turbo.json`
  - Глобальная env: `DATABASE_URL` (только факт наличия; значения не фиксируются)
  - `dev` зависит от `db:generate`
- **Корневые команды**: `package.json`
  - `pnpm dev` запускает `turbo dev` и поднимает контейнер БД (через `docker start astrum-db`)
  - Точечные dev-команды: `dev:customer`, `dev:api`, `dev:auth`

## `apps/api-astrum/` (API gateway на Express)

### Где entrypoint

- **Запуск сервера**: `apps/api-astrum/src/server.ts`
- **Создание app и top-level middleware/router wiring**: `apps/api-astrum/src/app.ts`

### Где маршрутизация

- Подключение модулей и путей:
  - `apps/api-astrum/src/app.ts`
- Роуты конкретного домена:
  - `apps/api-astrum/src/modules/user/user.routes.ts`
  - `apps/api-astrum/src/modules/product/product.routes.ts`
  - `apps/api-astrum/src/modules/wishlist/wishlist.routes.ts`
  - `apps/api-astrum/src/modules/cart/cart.routes.ts`
  - `apps/api-astrum/src/modules/order/order.routes.ts`
  - `apps/api-astrum/src/modules/reviews/reviews.routes.ts`

### Где “слои” внутри домена (практический паттерн)

Для каждого домена в `apps/api-astrum/src/modules/<domain>/` обычно есть:
- **router**: `*.routes.ts` (Express Router + binding контроллера)
- **controller**: `*.controller.ts` (HTTP слой, StatusCodes)
- **service**: `*.service.ts` (бизнес-логика + Prisma)
- **dto/**: `dto/*.ts` (class-validator DTO для `validateDto`)

Пример (user):
- `apps/api-astrum/src/modules/user/user.routes.ts`
- `apps/api-astrum/src/modules/user/user.controller.ts`
- `apps/api-astrum/src/modules/user/user.service.ts`
- `apps/api-astrum/src/modules/user/dto/update-user.dto.ts`

### Где auth/guard/валидация/ошибки

- **JWT auth middleware**: `apps/api-astrum/src/middlewares/authenticateToken.ts` (cookie `__auth` → `req.userId`)
- **DTO validation middleware**: `apps/api-astrum/src/middlewares/validateDto.ts`
- **CORS options**: `apps/api-astrum/src/middlewares/corsOptions.ts`
- **Прокси на auth service**: `apps/api-astrum/src/common/helpers/proxyOptions.ts`
- **Обработка ошибок**: `apps/api-astrum/src/common/helpers/errorHandler.ts`

### Где Prisma/DB

- Prisma adapter и клиент для gateway: `apps/api-astrum/lib/prisma.ts`
- Модули импортируют `prisma` через `../../../lib/prisma` (пример: `apps/api-astrum/src/modules/user/user.service.ts`)
- Prisma client генерируется в `apps/api-astrum/generated/prisma` (гипотеза: директория не закоммичена; источник: импорт `apps/api-astrum/lib/prisma.ts`)

## `apps/auth-astrum/` (Auth service на NestJS)

### Где entrypoint

- **Bootstrap**: `apps/auth-astrum/src/main.ts`

### Где модули и DI

- Root module: `apps/auth-astrum/src/app.module.ts`
  - `ConfigModule` глобальный
  - `AuthModule`: `apps/auth-astrum/src/auth/auth.module.ts`
  - `PrismaModule`: `apps/auth-astrum/src/prisma/prisma.module.ts` (global)

### Где HTTP API / контракты

- Controller: `apps/auth-astrum/src/auth/auth.controller.ts`
  - `POST /api/auth/register`
  - `POST /api/auth/signin`
- Service: `apps/auth-astrum/src/auth/auth.service.ts`
  - хеширование пароля (argon2)
  - выпуск JWT через `@nestjs/jwt`
- Guards/strategy (JWT):
  - `apps/auth-astrum/src/auth/guard/jwt.guard.ts`
  - `apps/auth-astrum/src/auth/strategy/jwt.strategy.ts`

### Где Prisma/DB

- PrismaModule: `apps/auth-astrum/src/prisma/prisma.module.ts`
- PrismaService: `apps/auth-astrum/src/prisma/prisma.service.ts`
  - Prisma adapter `@prisma/adapter-pg`
  - Prisma client импортируется из `../../generated/prisma/client` (гипотеза: generated артефакты не закоммичены)

## `apps/customer/` (Frontend на Next.js App Router)

### Где роутинг/страницы

- Root layout: `apps/customer/src/app/layout.tsx`
- Content layout: `apps/customer/src/app/(content)/layout.tsx`
- Auth layout: `apps/customer/src/app/(auth)/auth/layout.tsx`
- Страницы (page routes):
  - `apps/customer/src/app/(content)/page.tsx` (главная)
  - `apps/customer/src/app/(content)/cart/page.tsx`
  - `apps/customer/src/app/(content)/orders/page.tsx`
  - `apps/customer/src/app/(content)/orders/[orderId]/page.tsx`
  - `apps/customer/src/app/(content)/products/[productId]/page.tsx`
  - `apps/customer/src/app/(content)/wishlist/page.tsx`
  - `apps/customer/src/app/(content)/profile/page.tsx`
  - `apps/customer/src/app/(content)/categories/page.tsx`
  - `apps/customer/src/app/(content)/categories/[category]/page.tsx`
  - `apps/customer/src/app/(auth)/auth/signin/page.tsx`
  - `apps/customer/src/app/(auth)/auth/register/page.tsx`

### Где “защита” страниц

- Next middleware: `apps/customer/src/middleware.ts`
  - проверяет cookie `__auth` и редиректит на `/auth/signin`
- Server-side проверка сессии: `apps/customer/src/common/helpers/session.ts` (`verifySession()`)
  - применяется в content layout: `apps/customer/src/app/(content)/layout.tsx`

### Где запросы к backend

- axios-wrapper: `apps/customer/src/hooks/useFetcher.ts`
  - baseURL = `NEXT_PUBLIC_API_GATEWAY_URL`
  - `withCredentials: true` (cookie уходят на gateway)
- Domain hooks:
  - auth: `apps/customer/src/hooks/auth/useAuth.ts`
  - user: `apps/customer/src/hooks/user/useUser.ts`
  - order: `apps/customer/src/hooks/order/*`
  - product/cart/wishlist: `apps/customer/src/hooks/product/**`

### Где UI “фичи”

- Feature modules/pages:
  - `apps/customer/src/features/pages/**` (например `Home`, `Profile`, `Cart`, `Orders`, `ProductOverview`)
  - `apps/customer/src/features/auth/**` (например `SignIn`, `Register`)
  - `apps/customer/src/features/layout/**` (`Navbar`, `Footer`)
- Общие компоненты:
  - `apps/customer/src/components/**`

## `packages/Astrum-db/` (схема БД, генерация Prisma, сиды)

### Где схема и генерация

- Prisma schema: `packages/Astrum-db/prisma/schema.prisma`
  - `generator client.output = "../generated/prisma"`
- Скрипты генерации/сидов:
  - `packages/Astrum-db/package.json` → `db:generate`, `seed`, `seed:excel`

### Где runtime API для импорта

- Экспорт prisma singleton: `packages/Astrum-db/lib/prisma.ts`
- Экспорт пакета: `packages/Astrum-db/lib/index.ts`

## Где добавлять новый код (правило “куда положить X”)

### Новый endpoint в gateway

- Router: `apps/api-astrum/src/modules/<domain>/<domain>.routes.ts`
- Controller: `apps/api-astrum/src/modules/<domain>/<domain>.controller.ts`
- Service: `apps/api-astrum/src/modules/<domain>/<domain>.service.ts`
- DTO: `apps/api-astrum/src/modules/<domain>/dto/*.ts`
- Подключение маршрута: `apps/api-astrum/src/app.ts`

### Новый auth endpoint

- Controller: `apps/auth-astrum/src/auth/*.controller.ts` (или новый модуль в `src/<module>/`)
- Service: `apps/auth-astrum/src/auth/*.service.ts`
- Модуль/DI: `apps/auth-astrum/src/app.module.ts` + новый модуль `apps/auth-astrum/src/<module>/<module>.module.ts`

### Новая страница фронта

- Route segment: `apps/customer/src/app/.../page.tsx`
- UI реализация: `apps/customer/src/features/pages/<PageName>/...`
- API hook: `apps/customer/src/hooks/<domain>/...` (использовать `useFetcher`)

---

*Структурный анализ: 2026-04-07*

