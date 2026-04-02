# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo managed by **Turborepo + pnpm workspaces**. PostgreSQL database via Docker.

### Structure

| Path | Package | Stack | Description |
|------|---------|-------|-------------|
| `apps/api-astrum` | `@astrum/api` | Express + TypeScript | Main backend API (port 3580) |
| `apps/auth-astrum` | `@astrum/auth` | NestJS + TypeScript | Auth service (port 4580) |
| `apps/customer` | `@astrum/customer` | Next.js 15 + React 19 | Customer-facing frontend (port 3000) |
| `packages/Astrum-db` | `@astrum/db` | Prisma 7.5 | Database package (shared `@prisma/client`) |

### Architecture Notes

- **Prisma is shared**: apps import `@prisma/client` directly; the `@astrum/db` package owns the schema and migrations.
- **API (`@astrum/api`)**: Plain Express (not NestJS). Entry point: `src/server.ts`. App setup in `src/app.ts`. Modules in `src/modules/`, middleware in `src/middlewares/`, shared code in `src/common/`.
- **Auth (`@astrum/auth`)**: NestJS app. Entry point: `src/main.ts`, root module: `src/app.module.ts`. Auth logic in `src/auth/`, Prisma service in `src/prisma/`.
- **Customer (`@astrum/customer`)**: Next.js 15 App Router (`src/app/`). Uses shadcn/ui + Radix UI + TailwindCSS. Apollo Client for GraphQL communication. Feature modules in `src/features/`, shared in `src/shared/`.
- All services share the `@prisma/adapter-pg` (PostgreSQL adapter) and `@prisma/client` v7.5.0.

## Essential Commands

Run all from root.

```bash
# Install dependencies
pnpm install

# Dev environment
pnpm dev # start all apps (auto-starts DB container)
pnpm dev:api # API only
pnpm dev:auth # Auth only
pnpm dev:customer # Frontend only
pnpm dev:business # Business service only

# Database
pnpm db:up # start PostgreSQL container
pnpm db:restart # wipe and recreate DB + run migrations
pnpm prisma:migrate:dev # run dev migrations
pnpm prisma:generate # generate Prisma client
pnpm prisma:seed # seed data

# Build & check
pnpm build # build all packages
pnpm lint # lint all packages
pnpm check-types # type-check all packages

# Docker
pnpm docker:up # start all Docker Compose services
pnpm docker:down # stop all services
```

### Per-App Testing

- **Auth** (`apps/auth-astrum`): Jest configured. `pnpm test` runs `*.spec.ts` in `src/`.
- **API** (`apps/api-astrum`): No test runner configured; tests run via `tsx`.
- **Customer** (`apps/customer`): No test runner configured currently.

## Naming & Style Conventions

- **Files/dirs**: `kebab-case`
- **Variables/functions**: `camelCase`
- **Classes**: `PascalCase`
- **Env vars**: `UPPERCASE`
- **TypeScript**: `import type` for type-only imports; no `any`; prefer interfaces over types where applicable.

### API (Express)

- Modules in `src/modules/` with controllers/services pattern
- Common utilities in `src/common/`
- Middleware in `src/middlewares/`

### Auth (NestJS)

- One module per domain; controller + service per entity
- DTOs validated with `class-validator`
- Use `@app/common` pattern for shared code
- Test with Jest (Arrange-Act-Assert)

### Customer (Next.js)

- App Router pattern: `src/app/` for routes, `src/features/` for feature components
- Prefer React Server Components; minimize `use client`
- Styling: TailwindCSS + shadcn/ui + Radix primitives
- Functional components with TypeScript interfaces; no classes
- Favor named exports

## Ports & Docker

| Service | Container | Port | Config |
|---------|-----------|------|--------|
| PostgreSQL | `astrum-db` | 5432 | `packages/Astrum-db/.env` |
| API | `astrum-api` | 3580 | `apps/api-astrum/.env` (dev), `.env.prod` (prod) |
| Auth | `astrum-auth` | 4580 | `apps/auth-astrum/.env` (dev), `.env.prod` (prod) |
| Customer | `astrum-customer` | 3000 | `apps/customer/.env.production` |

Network: `astrumnetwork` (external, created separately).

## Prisma

- Schema: `packages/Astrum-db/prisma/schema.prisma`
- Migrations: `packages/Astrum-db/prisma/migrations/`
- Seeds: `packages/Astrum-db/prisma/productSeeds.js` and `seedFromExcel.ts`
- Always run `pnpm prisma:generate` after schema changes.
