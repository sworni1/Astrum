# Coding Conventions

**Дата анализа:** 2026-04-07

## Контекст монорепозитория

- **Монорепозиторий**: Turborepo + pnpm workspaces
  - Workspaces: `pnpm-workspace.yaml`
  - Оркестрация задач: `turbo.json`
  - Корневые скрипты: `package.json`

## TypeScript

### Версии и размещение

- **TypeScript** используется в:
  - Next.js фронтенд: `apps/customer`
  - Express API: `apps/api-astrum`
  - NestJS auth: `apps/auth-astrum`
  - Prisma DB пакет: `packages/Astrum-db`

### Настройки компилятора (tsconfig)

- **`apps/customer/tsconfig.json`**
  - `strict: true`, `noEmit: true`
  - `moduleResolution: "bundler"`, `module: "esnext"`
  - **Aliases**: `@/* -> ./src/*` (см. `compilerOptions.paths`)
  - Включены проверки: `noUnusedLocals: true`, `noUnusedParameters: true`

- **`apps/api-astrum/tsconfig.json`**
  - `strict: true`, `skipLibCheck: true`
  - `module: "commonjs"`, `outDir: "./dist"`
  - Декораторы включены: `experimentalDecorators`, `emitDecoratorMetadata`
  - Файл выглядит как сгенерированный шаблон `tsc --init` (много закомментированных опций)

- **`apps/auth-astrum/tsconfig.json`**
  - Включены `noUnusedLocals`, `noUnusedParameters`
  - `module: "commonjs"`, `declaration: true`, `removeComments: true`, `outDir: "./dist"`
  - Декораторы включены: `experimentalDecorators`, `emitDecoratorMetadata`
  - `strictNullChecks: false`, `noImplicitAny: false` (см. `apps/auth-astrum/tsconfig.json`)
  - Build-конфиг: `apps/auth-astrum/tsconfig.build.json` исключает `test`, `dist`, `**/*spec.ts`

- **`packages/Astrum-db/tsconfig.json`**
  - `strict: true`
  - `moduleResolution: "bundler"`, `module: "ESNext"`
  - `target: "ES2023"`

### Typecheck (как запускается)

- **Корень**: `package.json`
  - `pnpm check-types` → `turbo check-types`
- **Turbo pipeline**: `turbo.json` содержит task `check-types`, который зависит от `^check-types`.
- **Пробел/дыра**:
  - В workspace’ах не обнаружены скрипты `check-types` (поиск по `**/package.json` нашёл только корневой `check-types` в `package.json`).
  - Это означает, что конкретная команда typecheck на уровне пакетов не описана в `apps/*/package.json` и `packages/*/package.json` (в текущем состоянии).

## Линтинг и форматирование

### ESLint

- **Корень**: `package.json`
  - `pnpm lint` → `turbo lint`
- **`apps/customer` (Next.js)**:
  - Скрипт: `apps/customer/package.json` → `lint: "next lint"`
  - Конфиг ESLint (flat config): `apps/customer/eslint.config.mjs`
    - Расширяет `next/core-web-vitals` и `next/typescript`
  - `apps/customer/next.config.ts`:
    - `eslint.ignoreDuringBuilds: true` (линт при `next build` отключён)
- **`apps/auth-astrum` (NestJS)**:
  - Скрипт: `apps/auth-astrum/package.json` → `lint: eslint "{src,apps,libs,test}/**/*.ts" --fix`
  - Конфиг: `apps/auth-astrum/.eslintrc.js`
    - `parser: @typescript-eslint/parser`, `parserOptions.project: tsconfig.json`
    - `extends`: `plugin:@typescript-eslint/recommended`, `plugin:prettier/recommended`
    - Отключены правила:
      - `@typescript-eslint/explicit-function-return-type`
      - `@typescript-eslint/explicit-module-boundary-types`
      - `@typescript-eslint/no-explicit-any`
- **`apps/api-astrum`**:
  - ESLint-конфиги/скрипты `lint` в `apps/api-astrum/package.json` не обнаружены

### Prettier

- **`apps/auth-astrum`**:
  - Скрипт: `apps/auth-astrum/package.json` → `format: prettier --write "src/**/*.ts" "test/**/*.ts"`
  - Конфиг: `apps/auth-astrum/.prettierrc`
    - `singleQuote: true`
    - `trailingComma: "all"`
- **`apps/customer`**:
  - Скрипт: `apps/customer/package.json` → `prettier: prettier --write --ignore-unknown .`
  - В `apps/customer` отдельный конфиг Prettier (`.prettierrc`, `prettier.config.*`) не обнаружен
- **Корень**:
  - Корневые конфиги Prettier (`.prettierrc*`, `prettier.config.*`) не обнаружены

### pre-commit / commit hooks

- **Husky включён**: корень `package.json` → `prepare: husky`
- **Pre-commit hook**: `.husky/pre-commit`
  - Запускает `pnpm lint-staged`
- **lint-staged**: корень `package.json`
  - Настроена проверка только для `*.json` (валидность JSON через `node -e ...`)
  - **Пробел/дыра**: не обнаружены pre-commit действия для ESLint/Prettier/typecheck/test
- **Commit message hook**: `.husky/commit-msg`
  - Проверяет Conventional Commits regex:
    - `^(feat|fix|docs|style|refactor|test|chore|ci|build|perf)(\(.+\))?!?: .+`

## Импорты и алиасы

- **`apps/customer`**:
  - Path alias: `@/*` (см. `apps/customer/tsconfig.json`)
- **`apps/api-astrum`**:
  - Импорты преимущественно относительные, структура модулей: `./modules/*`, middleware: `./middlewares/*` (см. `apps/api-astrum/src/app.ts`)
- **`apps/auth-astrum`**:
  - Импорты через относительные пути, Prisma client импортируется из сгенерированного пути (пример: `apps/auth-astrum/src/auth/auth.service.ts`)

## Структура модулей / слоёв

### `apps/api-astrum` (Express)

- **Entry points**:
  - `apps/api-astrum/src/server.ts` — запуск HTTP-сервера
  - `apps/api-astrum/src/app.ts` — конфигурация express app, middleware, маршруты
- **Middleware**: `apps/api-astrum/src/middlewares/`
  - `authenticateToken.ts` — проверка JWT из cookie `__auth` (использует `process.env.JWT_SECRET`)
  - `validateDto.ts` — валидация DTO через `class-transformer` + `class-validator`
  - `corsOptions.ts` — CORS конфиг
- **Модули**: `apps/api-astrum/src/modules/*`
  - Пример подключения роутов в `apps/api-astrum/src/app.ts`: `userRoutes`, `productRoutes`, `wishlistRoutes`, `cartRoutes`, `orderRoutes`, `reviewsRouter`
- **Общие хелперы**: `apps/api-astrum/src/common/helpers/*`
  - Есть `errorHandler.ts` (см. ниже)

### `apps/auth-astrum` (NestJS)

- **Entry point**: `apps/auth-astrum/src/main.ts`
  - Global prefix: `app.setGlobalPrefix('/api')`
  - Global pipes: `ValidationPipe({ whitelist: true })`
  - Swagger включён: `SwaggerModule.setup('swagger', ...)`
- Модульная структура Nest по `src/*` (пример: `apps/auth-astrum/src/auth/*`, `apps/auth-astrum/src/prisma/*`)

### `apps/customer` (Next.js)

- Конфиг Next: `apps/customer/next.config.ts`
  - `output: "standalone"`
  - Список `images.remotePatterns` задан
  - ESLint на build отключён (см. выше)
- Исходники обнаружены в `apps/customer/src/*` (пример путей из логирования: `apps/customer/src/features/pages/*`, `apps/customer/src/hooks/*`, `apps/customer/src/common/helpers/*`)

## Ошибки и логирование

### `apps/api-astrum` — ошибки/ответы

- **HTTP статусы**:
  - Контроллеры отвечают через `res.status(StatusCodes.X).json(...)` (см. `apps/api-astrum/src/modules/*/*.controller.ts`)
  - DTO-валидация возвращает `400` с `{ errors: [...] }` (см. `apps/api-astrum/src/middlewares/validateDto.ts`)
- **Обработчик ошибок**:
  - `apps/api-astrum/src/common/helpers/errorHandler.ts`:
    - Если `err instanceof Error` → `400` и `{ message: err.message }`
    - Иначе → `500` и `{ message: ReasonPhrases.INTERNAL_SERVER_ERROR }`
- **Пробел/дыра**:
  - Не обнаружен централизованный middleware error handler `app.use((err, req, res, next) => ...)` в `apps/api-astrum/src/app.ts`
  - В сервисах используются `throw new Error("...")`, местами строка содержит коды (`'404: ...'`, `'409: ...'`) (см. `apps/api-astrum/src/modules/**/*.service.ts`, `apps/api-astrum/src/common/helpers/getWishlistAndCart.ts`)

### `apps/api-astrum` — логирование

- Используется `morgan('dev')` (см. `apps/api-astrum/src/app.ts`)
- Используется `console.log` на старте сервера (см. `apps/api-astrum/src/server.ts`)

### `apps/auth-astrum` — ошибки/ответы (NestJS)

- Используются Nest исключения (пример): `ForbiddenException` в `apps/auth-astrum/src/auth/auth.service.ts`
- Ошибки Prisma обрабатываются частично:
  - `PrismaClientKnownRequestError` с кодом `P2002` → `ForbiddenException('The user already exists')`
  - Иначе — `throw err` (см. `apps/auth-astrum/src/auth/auth.service.ts`)

### `apps/customer` — логирование

- Обнаружены `console.log(...)` в коде фронтенда (например: `apps/customer/src/features/pages/Orders/OrderPage/index.tsx`, `apps/customer/src/features/pages/Cart/components/CheckoutForm/index.tsx`, `apps/customer/src/hooks/auth/useAuth.ts`, `apps/customer/src/common/helpers/session.ts`)

## Env / переменные окружения (без чтения секретов)

- Turbo globalEnv: `turbo.json` → `globalEnv: ["DATABASE_URL"]`
- Использование dotenv-cli:
  - `apps/api-astrum/package.json`: `dev`/`start:*` используют `dotenv -e .env -- ...` и `dotenv -e .env.prod -- ...`
- README фиксирует расположения env-файлов (содержимое не анализировалось):
  - `apps/api-astrum/.env`, `apps/api-astrum/.env.prod`
  - `apps/auth-astrum/.env`, `apps/auth-astrum/.env.prod`
  - `packages/Astrum-db/.env`
  - См. `README.md` (раздел “Переменные окружения”)

---

*Convention analysis: 2026-04-07*

