# Testing Patterns

**Дата анализа:** 2026-04-07

## Что обнаружено

- **Unit/Integration тесты**: обнаружены только в `apps/auth-astrum` (Jest, `*.spec.ts`)
- **E2E**: обнаружены только в `apps/auth-astrum` (Jest с отдельным конфигом `test/jest-e2e.json`)
- **Playwright/Cypress**: конфиги `playwright.config.*`/`cypress.config.*` в репозитории не обнаружены
- **Тесты в `apps/customer` и `apps/api-astrum`**:
  - `*.spec.*`/`*.test.*` файлы в этих пакетах не обнаружены
  - Скрипты `test`/`test:e2e` в `apps/customer/package.json` и `apps/api-astrum/package.json` не обнаружены

## Test Framework

### Jest (NestJS auth)

- **Пакет**: `apps/auth-astrum`
- **Runner**: Jest (см. `apps/auth-astrum/package.json`, `devDependencies.jest`)
- **Конфигурация unit/spec тестов**:
  - Встроена в `apps/auth-astrum/package.json` (поле `"jest"`)
  - Параметры:
    - `rootDir: "src"`
    - `testRegex: ".*\\.spec\\.ts$"`
    - `transform: { "^.+\\.(t|j)s$": "ts-jest" }`
    - `testEnvironment: "node"`
- **Конфигурация e2e**:
  - `apps/auth-astrum/test/jest-e2e.json`
  - Параметры:
    - `rootDir: "."`
    - `testRegex: ".e2e-spec.ts$"`
    - `testEnvironment: "node"`
    - `transform: ts-jest`

## Команды запуска

### Корень монорепозитория

- **Тесты**:
  - Скрипт `test`/`test:e2e` в корневом `package.json` не обнаружен
- **Линт и проверки (смежное)**:
  - `pnpm lint` → `turbo lint` (см. `package.json`)
  - `pnpm check-types` → `turbo check-types` (см. `package.json`)

### `apps/auth-astrum`

Команды определены в `apps/auth-astrum/package.json`:

```bash
pnpm --filter @astrum/auth test           # jest
pnpm --filter @astrum/auth test:watch     # jest --watch
pnpm --filter @astrum/auth test:cov       # jest --coverage
pnpm --filter @astrum/auth test:debug     # jest с node --inspect-brk
pnpm --filter @astrum/auth test:e2e       # jest --config ./test/jest-e2e.json
```

Прямой запуск внутри пакета:

```bash
cd apps/auth-astrum
pnpm test
pnpm test:e2e
```

### `apps/customer`

- Скрипты тестов в `apps/customer/package.json` не обнаружены
- Файлы тестов `*.spec.*`/`*.test.*` в `apps/customer` не обнаружены

### `apps/api-astrum`

- Скрипты тестов в `apps/api-astrum/package.json` не обнаружены
- Файлы тестов `*.spec.*`/`*.test.*` в `apps/api-astrum` не обнаружены

## Организация тестов в коде

### Unit/spec тесты (`apps/auth-astrum/src`)

- Паттерн: тесты рядом с кодом в `src/`
- Примеры файлов:
  - `apps/auth-astrum/src/auth/auth.controller.spec.ts`
  - `apps/auth-astrum/src/auth/auth.service.spec.ts`
  - `apps/auth-astrum/src/prisma/prisma.service.spec.ts`

### E2E тесты (`apps/auth-astrum/test`)

- Паттерн: отдельная директория `test/`
- Примеры файлов:
  - `apps/auth-astrum/test/app.e2e-spec.ts`
  - `apps/auth-astrum/test/api-astrum.e2e-spec.ts`

## Мокинг / фикстуры (по наличию в репозитории)

- Явные директории/файлы “fixtures/factories” не обнаружены (по структуре `apps/auth-astrum/test` и найденным `*.spec.ts`)
- В текущем анализе не выявлены отдельные утилиты для генерации тестовых данных в виде выделенного пакета или общей библиотеки

## Покрытие

- В `apps/auth-astrum/package.json` есть команда покрытия:

```bash
pnpm --filter @astrum/auth test:cov
```

- Отдельные правила/порог покрытия (coverage thresholds) в конфиге Jest `apps/auth-astrum/package.json` не обнаружены

---

*Testing analysis: 2026-04-07*

