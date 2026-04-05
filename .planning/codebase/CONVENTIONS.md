# Coding Conventions

**Analysis Date:** 2026-04-05

## Naming Patterns

**Files:**

- **Next.js (`@astrum/customer`):** React-компоненты и страницы — по соглашению проекта предпочитать **PascalCase** для файлов `.tsx`/`.jsx` (см. правила пользователя); маршруты App Router — `page.tsx`, `layout.tsx` в `apps/customer/src/app/`.
- **Express (`@astrum/api`):** модули по домену — `*.routes.ts`, `*.controller.ts`, `*.service.ts` в `apps/api-astrum/src/modules/<domain>/`; общие части — `apps/api-astrum/src/middlewares/`, `apps/api-astrum/src/common/helpers/`.
- **NestJS (`@astrum/auth`):** стандарт Nest — `*.controller.ts`, `*.service.ts`, `*.module.ts`, DTO в `apps/auth-astrum/src/**/dto/`.

**Functions:**

- Обработчики событий в UI: префикс `handle` (см. `.cursor/rules/front-end-cursor-rules.mdc`), например `handleClick`.
- Хуки React: префикс `use` в `apps/customer/src/hooks/`.

**Variables:**

- Булевы флаги: `isLoading`, `hasError`, `canDelete` и т.п. (согласовано с правилами репозитория).

**Types:**

- Клиент: типы в `apps/customer/src/common/types/` (например `product.types`).
- API: DTO с `class-validator` / `class-transformer` в модулях Express и Nest.

## Code Style

**Formatting:**

- **`@astrum/customer`:** Prettier через `pnpm prettier` в `apps/customer/package.json` (`prettier --write --ignore-unknown .`); плагин `@trivago/prettier-plugin-sort-imports` в зависимостях — сортировка импортов при форматировании. Отдельного committed `.prettierrc` в `apps/customer` нет — используются настройки по умолчанию Prettier и плагин.
- **`@astrum/auth`:** Prettier в `apps/auth-astrum/.prettierrc` — `singleQuote: true`, `trailingComma: "all"`; скрипт `format`: `prettier --write "src/**/*.ts" "test/**/*.ts"`.

**Linting:**

- **`@astrum/customer`:** ESLint flat-config `apps/customer/eslint.config.mjs` — `FlatCompat` + `next/core-web-vitals`, `next/typescript`. Запуск: `next lint` (`apps/customer/package.json`). В `apps/customer/next.config.ts` задано `eslint.ignoreDuringBuilds: true` — линт **не** блокирует production-сборку Next.
- **`@astrum/auth`:** `apps/auth-astrum/.eslintrc.js` — `@typescript-eslint/parser`, extends `plugin:@typescript-eslint/recommended`, `plugin:prettier/recommended`. Явно отключены: `explicit-function-return-type`, `explicit-module-boundary-types`, `interface-name-prefix`; `no-explicit-any` — `off`. Запуск: `eslint "{src,apps,libs,test}/**/*.ts" --fix`.
- **`@astrum/api`:** скрипта `lint` в `apps/api-astrum/package.json` **нет** — ESLint для Express-пакета не подключён в монорепозитории.

**TypeScript:**

- **`@astrum/customer`:** `apps/customer/tsconfig.json` — `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, алиас `@/*` → `./src/*`.
- **`@astrum/api`:** `apps/api-astrum/tsconfig.json` — `strict: true`, CommonJS, декораторы для DI-подхода с `reflect-metadata`.
- **`@astrum/auth`:** `apps/auth-astrum/tsconfig.json` — смягчённые проверки (`strictNullChecks: false`, `noImplicitAny: false` и др.) относительно строгого клиента — при новом коде предпочитать выравнивание с доменными правилами проекта.
- **`@astrum/db`:** `packages/Astrum-db/tsconfig.json` — `strict: true`, ESM.

## Import Organization

**Order:**

- В customer после Prettier — порядок задаётся `@trivago/prettier-plugin-sort-imports` при запуске Prettier.

**Path Aliases:**

- **`@astrum/customer`:** `"@/*": ["./src/*"]` в `apps/customer/tsconfig.json` — импорты вида `@/components/...`.

## Error Handling

**Express (`@astrum/api`):**

- Централизованный хелпер `handleErrors` в `apps/api-astrum/src/common/helpers/errorHandler.ts`: для `instanceof Error` — ответ `400` с `message`; иначе — `500` с `ReasonPhrases.INTERNAL_SERVER_ERROR`. Контроллеры вызывают его в `catch` (пример: `apps/api-astrum/src/modules/reviews/reviews.controller.ts` с `StatusCodes` из `http-status-codes`).
- При добавлении эндпоинтов: оборачивать async-логику в `try/catch` и передавать `err` в `handleErrors(res, err)` либо выносить в общий middleware, если появится единый паттерн.

**NestJS (`@astrum/auth`):**

- Глобальный `ValidationPipe` с `whitelist: true` в `apps/auth-astrum/src/main.ts`.
- Контроллеры возвращают результат сервиса; HTTP-коды — декораторы `@HttpCode`, `HttpStatus` (пример: `apps/auth-astrum/src/auth/auth.controller.ts`).

**Next.js:**

- Клиентские запросы: обработка ошибок в хуках/SWR (например `productError` в `apps/customer/src/hooks/product/useProducts/useGetProduct.ts`).

## Logging

**Framework:** в dev для API — `morgan('dev')` в `apps/api-astrum/src/app.ts`; иначе `console` там, где используется напрямую (например `apps/api-astrum/src/server.ts`).

**Patterns:** структурированного единого логгера (pino/winston) в репозитории не зафиксировано.

## Comments

**When to Comment:** в коде новых фич — минимально; проектные правила пользователя: не добавлять комментарии к коду без необходимости. Документация API — Swagger в auth (`apps/auth-astrum/src/main.ts`).

**JSDoc/TSDoc:** в правилах Nest (`.cursor/rules/clean-nestjs-typescript-cursor-rules.mdc`) указан JSDoc для публичных API; фактическое покрытие — по файлам, без обязательной автоматизации.

## Function Design

**Size:** короткие методы контроллеров с делегированием в сервисы (Express и Nest).

**Parameters:** DTO через тело запроса и `class-validator` там, где уже принято (Nest DTO в `apps/auth-astrum/src/auth/dto/`, Express — валидация в сервисах/DTO по модулям).

**Return Values:** JSON-ответы с кодами из `http-status-codes` / `HttpStatus`.

## Module Design

**Exports:** в Express — `export default app` из `apps/api-astrum/src/app.ts`; маршруты — именованные/дефолтные экспорты по файлам в `modules/`.

**Barrel Files:** `index.ts` в подпапках auth (например `apps/auth-astrum/src/auth/dto/index.ts`) — по мере необходимости.

## Monorepo Commands (quality)

**Root `package.json`:**

- `pnpm lint` → `turbo lint` — выполняют только пакеты с определённым скриптом `lint` (сейчас в основном `@astrum/customer`, `@astrum/auth`).
- `pnpm check-types` → `turbo check-types` — пакеты без скрипта `check-types` в своём `package.json` не участвуют в задаче.

**Husky:**

- `.husky/pre-commit` вызывает `pnpm lint-staged`.
- Корневой `package.json` → `lint-staged`: для `*.json` — проверка валидности JSON через однострочный `node -e`. Автоматический запуск ESLint/tsc по всему репо на коммите **не** настроен.

---

*Convention analysis: 2026-04-05*
