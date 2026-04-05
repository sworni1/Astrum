# Testing Patterns

**Analysis Date:** 2026-04-05

## Test Framework

**Runner:**

- **Jest 29** + **ts-jest** — единственный настроенный автотестовый стек для приложений; конфигурация встроена в `apps/auth-astrum/package.json` (секция `"jest"`).

**Assertion Library:**

- Встроенные матчеры Jest (`expect`).

**Run Commands:**

```bash
pnpm --filter @astrum/auth test              # unit в apps/auth-astrum/src/**/*.spec.ts
pnpm --filter @astrum/auth test:watch
pnpm --filter @astrum/auth test:cov          # coverageDirectory: apps/auth-astrum/coverage (относительно rootDir)
pnpm --filter @astrum/auth test:e2e          # jest --config apps/auth-astrum/test/jest-e2e.json
```

**Корень монорепозитория:** скрипта `pnpm test` в корневом `package.json` **нет** — тесты запускают точечно через `--filter @astrum/auth`.

## Test File Organization

**Location:**

- **Unit (Nest):** рядом с исходниками в `apps/auth-astrum/src/`, суффикс `*.spec.ts`.
- **E2E:** каталог `apps/auth-astrum/test/`, шаблон имён `*.e2e-spec.ts` (см. `testRegex` в `apps/auth-astrum/test/jest-e2e.json`).

**Naming:**

- Unit: `*.spec.ts` (например `apps/auth-astrum/src/auth/auth.controller.spec.ts`).
- E2E: `*.e2e-spec.ts` (например `apps/auth-astrum/test/app.e2e-spec.ts`, `apps/auth-astrum/test/api-astrum.e2e-spec.ts`).

**Structure:**

```
apps/auth-astrum/
├── src/
│   └── **/*.spec.ts          # Jest rootDir: src
└── test/
    ├── jest-e2e.json
    ├── app.e2e-spec.ts
    └── api-astrum.e2e-spec.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

(фрагмент из `apps/auth-astrum/src/auth/auth.controller.spec.ts`.)

**Patterns:**

- Nest unit: `Test.createTestingModule({ controllers / providers }).compile()`, затем `module.get(...)`.
- E2E с Supertest: `createNestApplication()`, `request(app.getHttpServer())` — см. `apps/auth-astrum/test/app.e2e-spec.ts`.

**Setup / Teardown:**

- Интеграционный сценарий `apps/auth-astrum/test/api-astrum.e2e-spec.ts`: `beforeAll` поднимает Nest-приложение, проверяет `process.env.DATABASE_URL`, задаёт дефолты для `JWT_SECRET` и `AUTH_SERVICE_URL`; `jest.setTimeout(30000)`; `afterAll` закрывает приложение.

## Mocking

**Framework:** Jest mocks при необходимости; в текущих `*.spec.ts` глубокого мока зависимостей почти нет — спеки на уровне «определён ли контроллер/сервис».

**Patterns:** для новых тестов Nest — `Test.createTestingModule({ providers: [{ provide: TOKEN, useValue: mock }] })` по документации `@nestjs/testing`.

**What to Mock:** внешние сервисы и БД при unit-тестах сервисов; Prisma — через подмену `PrismaService` при расширении покрытия.

**What NOT to Mock:** сами тестируемые классы без необходимости.

## Fixtures and Factories

**Test Data:** отдельной фабрики/fixture-папки в репозитории не выделено; e2e зависят от реальной БД (`DATABASE_URL`).

**Location:** при добавлении — логично `apps/auth-astrum/test/fixtures/` или рядом со спеками.

## Coverage

**Requirements:** явного порога покрытия в CI или в `jest` config не задано.

**collectCoverageFrom:** `"**/*.(t|j)s"` под `rootDir: "src"` в `apps/auth-astrum/package.json`.

**View Coverage:**

```bash
pnpm --filter @astrum/auth test:cov
# отчёт: apps/auth-astrum/coverage (относительно package)
```

## Test Types

**Unit Tests:**

- Только в `apps/auth-astrum` — smoke-тесты контроллеров/сервисов/prisma (`auth.controller.spec.ts`, `auth.service.spec.ts`, `prisma.service.spec.ts`).

**Integration / API tests:**

- **`@astrum/api` (Express):** файлов `*.spec.ts` / `*.test.ts` **нет** — автотестов для Express не обнаружено.

**E2E Tests:**

- Jest e2e для auth и связки с api-astrum: `apps/auth-astrum/test/jest-e2e.json` (`testRegex`: `.e2e-spec.ts$`). Сценарий `api-astrum.e2e-spec.ts` подключает Express-приложение через `require('../../api-astrum/src/app').default` — для прогона нужны сервисы и переменные окружения.

**Frontend (`@astrum/customer`):**

- Файлов `*.test.*` / `*.spec.*` в `apps/customer` **нет** — Vitest/Playwright/Jest для customer в `package.json` не подключены.

**`packages/Astrum-db`:**

- Тестовых скриптов в `packages/Astrum-db/package.json` нет.

## Common Patterns

**Async Testing:**

```typescript
it('/ (GET)', () => {
  return request(app.getHttpServer())
    .get('/')
    .expect(200)
    .expect('Hello World!');
});
```

(`apps/auth-astrum/test/app.e2e-spec.ts` — ожидание ответа должно соответствовать фактическому поведению приложения; при расхождении править тест или роут.)

**Error Testing:** при расширении — `expect().rejects` или проверка статусов Supertest `.expect(4xx)`.

## CI Hooks

**Husky:** `prepare` в корневом `package.json` ставит husky; `.husky/pre-commit` → `pnpm lint-staged` — **только валидация JSON** для staged файлов (см. корневой `lint-staged`). Тесты на pre-commit **не** запускаются.

**Turborepo:** `turbo.json` определяет задачи `lint` и `check-types`, но не `test` — единого turbo-пайплайна для тестов нет.

**Рекомендация для исполнителей:** перед PR вручную запускать `pnpm --filter @astrum/auth test` при изменениях в auth и целевой линт/типы в затронутых пакетах; не полагаться на Husky для полной проверки качества.

---

*Testing analysis: 2026-04-05*
