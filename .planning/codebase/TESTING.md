# Тестирование — Astrum

Обновлено: 2026-04-04

## Обзор

Тестирование в проекте находится на начальном этапе. Покрыт только Auth-сервис базовыми тестами. API Gateway и Frontend не имеют тестов.

## Фреймворки

| Приложение | Фреймворк | Трансформер | Запуск |
|-----------|-----------|-------------|--------|
| auth-astrum (NestJS) | Jest 29.7.0 | ts-jest 29.1.2 | `pnpm --filter @astrum/auth test` |
| frontend (Next.js) | Не установлен | — | — |
| API (Express) | Не установлен | — | — |

## Структура тестов

### Auth сервис (NestJS)

Тест-файлы находятся **рядом с тестируемым кодом**, суффикс `*.spec.ts`:

```
src/auth/
├── auth.controller.spec.ts
├── auth.service.spec.ts
├── auth.controller.ts
└── auth.service.ts

src/prisma/
├── prisma.service.spec.ts
└── prisma.service.ts
```

### Конфигурация Jest (из auth-astrum/package.json)

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```

Доступные команды:
- `pnpm test` — запустить все тесты
- `pnpm test:watch` — watch-режим
- `pnpm test:cov` — с покрытием
- `pnpm test:debug` — отладка
- `pnpm test:e2e` — E2E тесты (конфиг: `./test/jest-e2e.json`)

## Существующие тесты

### auth.service.spec.ts

```typescript
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### auth.controller.spec.ts

```typescript
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

### prisma.service.spec.ts

Проверяется что `PrismaService` определён и что `PrismaClient` инициализирован.

## Стратегия мокания

Текущие тесты используют минимальную стратегию мокания:

### Mock NestJS TestingModule

Используется `@nestjs/testing` Module:
```typescript
const module: TestingModule = await Test.createTestingModule({
  controllers: [AuthController],
}).compile();
```

### Чего нет

- **Нет моков для зависимостей** — `PrismaService` и `JwtService` не мокнуты в тестах
- **Нет моков для HTTP-запросов** — нет тестов контроллеров с реальными реквестами
- **Нет моков для Prisma** — `PrismaClient` подключается к реальной БД
- **E2E шаблон пустой** — `test/jest-e2e.ts` содержит только базовый "should pass"

## Покрытие

| Приложение | Единицы | Интеграции | E2E | Покрытие |
|-----------|---------|------------|-----|----------|
| auth-astrum | 3 spec-файла | Нет | Шаблон пустой | ~10-15% |
| api-astrum | Нет | Нет | Нет | 0% |
| frontend | Нет | Нет | Нет | 0% |

Тесты проверяют только что сервисы/контроллеры "определены" (базовые sanity-чекы). Не тестируется бизнес-логика (регистрация, авторизация, работа с JWT, Prisma-запросы).

## CI/CD

В CI/CD пайплайне тестов нет. Турбо-конфиг не включает `test` таску:

```json
{
  "tasks": {
    "build": { ... },
    "dev": { ... },
    "lint": { ... },
    "check-types": { ... }
  }
}
```

Pre-commit хук запускает только `lint-staged` (валидация JSON).

## Инфраструктура для тестирования

### Шаблон E2E (auth-astrum)

```typescript
// test/jest-e2e.ts
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { INestApplication } from '@nestjs/common';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth/register (POST)', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ /* ... */ })
      .expect(200);
  });
});
```

### Supertest (auth-astrum)

Установлен `supertest` для HTTP-тестирования, но не используется в текущих тестах.

## Рекомендации по масштабированию тестирования

1. **API Gateway (Express)**: добавить Jest + supertest, начать с модульных тестов сервисов
2. **Frontend**: добавить Vitest для юнит-тестов хуков и утилит + Playwright для E2E
3. **Auth**: дописать тесты для `register()`, `signin()`, `signToken()` с моками Prisma
4. **Моки Prisma**: использовать `jest.mock` или специализированные библиотеки для изоляции от БД
5. **CI**: добавить `test` таску в turbo.json для запуска в пайплайне
