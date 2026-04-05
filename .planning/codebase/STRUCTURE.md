# Codebase Structure

**Analysis Date:** 2026-04-05

## Directory Layout

```
astrum/
├── apps/
│   ├── api-astrum/          # Express API gateway (port 3580)
│   ├── auth-astrum/         # NestJS auth service (port 4580)
│   └── customer/            # Next.js 15 customer app (port 3000)
├── packages/
│   └── Astrum-db/           # Prisma schema, migrations, seeds (@astrum/db)
├── docker-compose.yml       # Postgres + optional builds for all three apps
├── pnpm-workspace.yaml      # workspaces: apps/*, packages/*
├── turbo.json               # Turborepo task graph (build, dev, lint, check-types)
└── package.json             # Root scripts (db, prisma, turbo)
```

## Directory Purposes

**`apps/api-astrum/`:**

- Purpose: REST API and reverse proxy to auth.
- Contains: `src/app.ts`, `src/server.ts`, `src/modules/*`, `src/middlewares/`, `src/common/`, `lib/prisma.ts`, local `prisma/schema.prisma`, `generated/prisma/` (after generate).
- Key files: `apps/api-astrum/src/app.ts`, `apps/api-astrum/src/server.ts`, `apps/api-astrum/lib/prisma.ts`

**`apps/auth-astrum/`:**

- Purpose: NestJS authentication API and Swagger.
- Contains: `src/main.ts`, `src/app.module.ts`, `src/auth/*`, `src/prisma/*`, local `prisma/schema.prisma`, `generated/prisma/`, `test/` (Jest e2e config via `apps/auth-astrum/package.json`).
- Key files: `apps/auth-astrum/src/main.ts`, `apps/auth-astrum/src/auth/auth.controller.ts`, `apps/auth-astrum/src/prisma/prisma.service.ts`

**`apps/customer/`:**

- Purpose: Next.js App Router storefront UI.
- Contains: `src/app/` (routes), `src/features/` (pages and layout components), `src/hooks/`, `src/components/`, `src/common/helpers/`, `src/middleware.ts`.
- Key files: `apps/customer/src/middleware.ts`, `apps/customer/src/app/layout.tsx`, `apps/customer/tsconfig.json` (`@/*` → `./src/*`)

**`packages/Astrum-db/`:**

- Purpose: Single source of truth for SQL migrations and shared Prisma client wiring for tooling.
- Contains: `prisma/schema.prisma`, `prisma/migrations/`, `prisma/productSeeds.js`, `lib/prisma.ts`, `lib/index.ts`.
- Key files: `packages/Astrum-db/prisma/schema.prisma`, `packages/Astrum-db/lib/prisma.ts`

## Key File Locations

**Entry Points:**

- `apps/api-astrum/src/server.ts`: HTTP server bootstrap.
- `apps/auth-astrum/src/main.ts`: Nest bootstrap, Swagger, CORS, global prefix `/api`.
- `apps/customer/src/app/layout.tsx`: Root layout; nested layouts under `apps/customer/src/app/(content)/layout.tsx`, `apps/customer/src/app/(auth)/auth/layout.tsx`.

**Configuration:**

- `turbo.json`: Build outputs and `DATABASE_URL` in `globalEnv`.
- `pnpm-workspace.yaml`: Workspace globs and Prisma version catalog.
- `apps/api-astrum/prisma.config.ts`, `apps/auth-astrum/prisma.config.ts`: Prisma 7 `defineConfig` for schema and datasource URL.
- Per-app `tsconfig.json` / `nest-cli.json` (Nest) in each app folder.

**Core Logic:**

- Express domains: `apps/api-astrum/src/modules/<domain>/` (`user`, `product`, `wishlist`, `cart`, `order`, `reviews`).
- Nest auth: `apps/auth-astrum/src/auth/`.
- Next features: `apps/customer/src/features/pages/<PageName>/` and `apps/customer/src/features/layout/`.

**Testing:**

- Nest unit tests: `*.spec.ts` alongside sources (e.g. `apps/auth-astrum/src/auth/auth.service.spec.ts`).
- Jest e2e entry: `apps/auth-astrum/test/jest-e2e.json` (referenced from `apps/auth-astrum/package.json`).

## Naming Conventions

**Files:**

- Express: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, DTOs under `dto/` (example: `apps/api-astrum/src/modules/user/dto/update-user.dto.ts`).
- Nest: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.guard.ts`, `*.strategy.ts` under `apps/auth-astrum/src/auth/`.
- Next: App Router `page.tsx`, `layout.tsx`, `not-found.tsx` under `apps/customer/src/app/`; feature components often `index.tsx` in feature subfolders.

**Directories:**

- Route groups: parentheses folders `(content)`, `(auth)` under `apps/customer/src/app/`.
- Feature-sliced UI: `apps/customer/src/features/pages/<Feature>/components/`.

**Modules:**

- npm scope: `@astrum/api`, `@astrum/auth`, `@astrum/customer`, `@astrum/db` (`apps/*/package.json`, `packages/Astrum-db/package.json`).

## Where to Add New Code

**New REST domain on the Express API:**

- Routes + controller + service: `apps/api-astrum/src/modules/<new-domain>/`
- Register router in `apps/api-astrum/src/app.ts` with `authenticateToken` if user-specific.
- Add DTOs under `apps/api-astrum/src/modules/<new-domain>/dto/`.

**New auth-only endpoint:**

- Controller/service in `apps/auth-astrum/src/auth/` (or new Nest module if the domain grows), register in `apps/auth-astrum/src/app.module.ts`.
- Remember global prefix `/api` and path `auth/...` from `AuthController` (`@Controller('auth')` in `apps/auth-astrum/src/auth/auth.controller.ts`).

**New customer page:**

- Route: `apps/customer/src/app/(content)/<segment>/page.tsx` (or new group under `apps/customer/src/app/`).
- UI: `apps/customer/src/features/pages/<Name>/`.
- Data hooks: `apps/customer/src/hooks/<area>/`.

**Prisma model / migration:**

- Edit `packages/Astrum-db/prisma/schema.prisma`, run migrations via root `pnpm prisma:migrate:dev` (see root `package.json`).
- Regenerate clients in apps that embed a copy of the schema (`apps/api-astrum/`, `apps/auth-astrum/`) so generated types stay aligned with `packages/Astrum-db/prisma/schema.prisma`.

**Utilities:**

- Shared API helpers: `apps/api-astrum/src/common/helpers/`, `apps/api-astrum/src/common/types/`.
- Shared frontend helpers: `apps/customer/src/common/helpers/`, `apps/customer/src/lib/utils.ts`.

## Special Directories

**`packages/Astrum-db/generated/`** (after `prisma generate`):

- Purpose: Prisma client output per `schema.prisma` generator block.
- Generated: Yes.
- Committed: Follow team policy; typically generated artifacts are gitignored or committed—verify `.gitignore` at repo root.

**`apps/api-astrum/generated/`, `apps/auth-astrum/generated/`:**

- Purpose: App-local Prisma client output for TypeScript builds.
- Generated: Yes.

**`apps/customer/.next/`:**

- Purpose: Next.js build cache and output.
- Generated: Yes.
- Committed: No (standard Next ignore).

---

*Structure analysis: 2026-04-05*
