## Project Overview

Monorepo managed by **Turborepo + pnpm workspaces**. PostgreSQL database via Docker.

### Structure

| Path                 | Package            | Stack                                                      | Description                             |
| -------------------- | ------------------ | ---------------------------------------------------------- | --------------------------------------- |
| `apps/api-astrum`    | `@astrum/api`      | Express + TypeScript                                       | Main backend API (port 3580)            |
| `apps/auth-astrum`   | `@astrum/auth`     | NestJS + TypeScript                                        | Auth service (port 4580)                |
| `apps/customer`        | `@astrum/customer` | Next.js 15 + React 19 + shadcn/ui + Radix UI + TailwindCSS | Customer-facing frontend (port 3000)    |
| `apps/sentiment-astrum` | —                | FastAPI + Transformers                                   | Тональность отзывов; перевод через translate-backend |
| `apps/translate-astrum` | —                 | Bun + Elysia (образ: upstream FOSWLY/translate-backend)   | Сервис перевода, порт 3313              |
| `packages/Astrum-db`   | `@astrum/db`       | Prisma 7.5                                                 | Database owns the schema and migrations |

## Правила коммуникации

**Язык общения — русский.** Все ответы, комментарии в коде, заметки в Obsidian, commit-сообщения, документация — на русском языке

### Auto-Trigger Skills

Используй Skills автоматически:

- brainstorming — при планировании/дизайне
- executing-plans — при имплементации
- systematic-debugging — при багах
- verification-before-completion — перед «готово»
- code-reviewer — после написания кода
- dispatching-parallel-agents — при 2+ независимых задачах

Поиск — Exa, документация — Context7, база знаний — Obsidian

## Obsidian Knowledge Vault

Хранилище знаний: "E:\Astrum\Astrum Vault"

### При старте сессии

Прочитай 00-home/index.md и текущие приоритеты.md.
Если задача касается модуля — прочитай заметку из knowledge/.

### При завершении (пользователь: "сохрани сессию")

1. Создай заметку в sessions/ с датой
2. Обнови текущие приоритеты.md
3. Если решение — создай в knowledge/decisions/
4. Если баг — создай в knowledge/debugging/
5. Обнови index.md если новые заметки
