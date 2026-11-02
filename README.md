# Astrum

Монорепо интернет-магазина **Astrum**. Turborepo + pnpm 10.

## 📦 Приложения

| Приложение              | Стек                | Порт  | Назначение                          |
| ----------------------- | ------------------- | ----- | ----------------------------------- |
| `apps/customer`         | Next.js 15          | 3000  | Клиентский фронтенд (B2C)          |
| `apps/api-astrum`       | Express + Prisma    | 3580  | API-шлюз (оркестратор)              |
| `apps/auth-astrum`      | NestJS + Prisma     | 4580  | Аутентификация и пользователи       |
| `packages/Astrum-db`    | Prisma client + zod | —     | Общая БД-схема и обёртки моделей    |

## 🚀 Быстрый старт

```bash
# 1. Установить зависимости
pnpm install

# 2. Скопировать переменные окружения
cp .env.example .env
# (отредактируйте JWT_SECRET и пароли перед запуском)

# 3. Поднять Postgres + dev-серверы (Turbo)
pnpm dev

# Альтернатива: только customer в prod-режиме + остальные в dev
pnpm dev:prod-fe
```

После старта:

- Customer: <http://localhost:3000>
- API: <http://localhost:3580>
- Auth: <http://localhost:4580>

## ✅ Качество кода

| Скрипт                  | Назначение                                                  |
| ----------------------- | ----------------------------------------------------------- |
| `pnpm lint`             | ESLint по всем пакетам                                      |
| `pnpm check-types`      | `tsc --noEmit` по всем пакетам                              |
| `pnpm test`             | unit-тесты (Jest/Vitest) + pytest для Python-пакетов         |
| `pnpm test:py`          | только pytest (`scripts/test-python.sh`)                    |
| `pnpm quality-gate`     | Полный Quality Gates: lint + check-types + test             |
| `pnpm format`           | Prettier авто-формат                                        |
| `pnpm format:check`     | Prettier проверка (без записи)                              |

Pre-commit и pre-push хуки (через husky) гоняют Quality Gates автоматически:

- **pre-commit** — `lint-staged` + `pnpm check-types` + `ruff check` (Python).
- **pre-push** — `pnpm quality-gate` (полный прогон).

См. `.husky/` и `commitlint.config.js`.

## 📐 Архитектурные решения (ADR)

Все значимые решения — в [`docs/adr/`](./docs/adr/). Список и шаблон:

- [`docs/adr/README.md`](./docs/adr/README.md) — индекс
- [`docs/adr/TEMPLATE.md`](./docs/adr/TEMPLATE.md) — шаблон новой записи

## 📋 Журнал изменений

- [`docs/changelog/`](./docs/changelog/) — журнал по датам (Conventional Commits на русском)
- [`CHANGELOG.md`](./CHANGELOG.md) — Keep a Changelog-совместимый

## 📚 Obsidian-наблюдения

Зеркало заметок живёт в `~/Documents/Obsidian Vault/Astrum/` (`Change Logs/`, `decisions/`, `notes/`). Используйте `[[WikiLinks]]` для связей.

## 🔐 Переменные окружения

Корневой шаблон — [`.env.example`](./.env.example). По каждому приложению:

- [`apps/api-astrum/.env.example`](./apps/api-astrum/.env.example)
- [`apps/auth-astrum/.env.example`](./apps/auth-astrum/.env.example)
- [`apps/customer/.env.example`](./apps/customer/.env.example)

## 📝 Конвенция коммитов

Conventional Commits, типы: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`. Тело коммита — **на русском**.

Примеры:

```
feat(api): добавить эндпоинт пользователя
fix(auth): исправить обработку просроченного токена
docs: обновить README
```

Валидация — commitlint (см. `.husky/commit-msg`).

## 🛠️ Полезные команды

```bash
pnpm prisma:generate   # перегенерировать Prisma Client
pnpm prisma:migrate:dev  # создать миграцию (dev)
pnpm prisma:migrate:deploy  # применить миграции (prod)
pnpm prisma:studio     # открыть Prisma Studio
pnpm prisma:seed       # сидирование БД
pnpm db:up             # поднять Postgres в docker
pnpm db:restart        # пересоздать БД с нуля
pnpm mcp:check         # health-check MCP-серверов (PowerShell)
```