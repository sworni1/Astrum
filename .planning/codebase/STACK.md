# Technology Stack

**Analysis Date:** 2026-04-05

## Languages

**Primary:**
- TypeScript — backend (`apps/api-astrum`, `apps/auth-astrum`), frontend (`apps/customer`), database package (`packages/Astrum-db`)

**Secondary:**
- JavaScript — seed scripts in `packages/Astrum-db` (e.g. `prisma/productSeeds.js`)
- SQL — Prisma migrations under `packages/Astrum-db/prisma/migrations`

## Runtime

**Environment:**
- Node.js — `node:18-alpine` in `apps/api-astrum/Dockerfile` and `apps/auth-astrum/Dockerfile`; `node:20-alpine` in `apps/customer/Dockerfile`
- Local dev: Node with `tsx` for API (`apps/api-astrum/package.json`), Nest CLI for auth, Next.js dev server for customer

**Package Manager:**
- pnpm `10.4.0` (`package.json` field `packageManager`)
- Lockfile: `pnpm-lock.yaml` (lockfileVersion `9.0`)

## Frameworks

**Core:**
- Turborepo `^2.8.18` — task orchestration (`turbo.json`, root `package.json`)
- Express `^4.21.x` — API gateway (`apps/api-astrum`)
- NestJS `^10.3.x` — auth service (`apps/auth-astrum`)
- Next.js `15.4.2` — customer app (`apps/customer`)
- React `19.1.0` — UI (`apps/customer`)

**Testing:**
- Jest `^29.7.0` — auth unit/e2e (`apps/auth-astrum/package.json`, `test/jest-e2e.json`)
- Supertest — HTTP e2e (`apps/auth-astrum`)

**Build/Dev:**
- TypeScript `^5.9.3` (api/auth/db) / `^5` (customer)
- `tsx` — watch and scripts (`apps/api-astrum`, `packages/Astrum-db`)
- `@nestjs/cli` — Nest build (`apps/auth-astrum`)
- ESLint + Prettier — customer and auth (see `apps/customer/package.json`, `apps/auth-astrum/package.json`)

## Key Dependencies

**Critical:**
- Prisma `^7.5.0` / catalog `prisma: latest` (resolved in `pnpm-lock.yaml` to `7.6.0` for workspace catalog) — ORM; client output configured in generators (`packages/Astrum-db/prisma/schema.prisma`, duplicate schemas in `apps/api-astrum/prisma/schema.prisma`, `apps/auth-astrum/prisma/schema.prisma`)
- `@prisma/adapter-pg` + `pg` — PostgreSQL driver adapter (`packages/Astrum-db/lib/prisma.ts`, `apps/api-astrum/lib/prisma.ts`)
- `jsonwebtoken` — JWT verification on API (`apps/api-astrum/src/middlewares/authenticateToken.ts`) and customer session helpers (`apps/customer/src/common/helpers/session.ts`)
- `@nestjs/jwt`, `passport`, `passport-jwt` — auth service (`apps/auth-astrum`)
- `argon2` — password hashing (api `^0.41.1`, auth `^0.40.3`)
- `axios` + `swr` — customer HTTP and data fetching (`apps/customer/src/hooks/useFetcher.ts`, feature hooks)
- `zod`, `react-hook-form`, `@hookform/resolvers` — forms and validation (`apps/customer`)
- Radix UI + Tailwind CSS `^4.1.x` — UI (`apps/customer`)

**Infrastructure:**
- `dotenv` / `dotenv-cli` — env loading (`apps/api-astrum` scripts, `packages/Astrum-db`)
- `helmet`, `cors`, `morgan`, `cookie-parser` — API middleware (`apps/api-astrum/src/app.ts`)
- `http-proxy-middleware` — proxy `/api/auth` to auth service (`apps/api-astrum/src/common/helpers/proxyOptions.ts`, `apps/api-astrum/src/app.ts`)
- `compression` — Nest auth (`apps/auth-astrum/src/main.ts`)
- `xlsx` — Excel-related seed path (`packages/Astrum-db/package.json` script `seed:excel`)

**Declared but not imported in customer source (verify before use):**
- `@apollo/client`, `@apollo/client-integration-nextjs` — listed in `apps/customer/package.json`; no `import` from `@apollo` under `apps/customer/src` at analysis time

## Configuration

**Environment:**
- Prisma config: `packages/Astrum-db/prisma.config.ts` (`defineConfig` from `prisma/config`, `datasource.url` from `env('DATABASE_URL')`)
- Turbo passes `DATABASE_URL` to tasks (`turbo.json` `globalEnv`)
- Per-app `.env` / `.env.prod` / `.env.production` referenced by Docker Compose and scripts — do not commit; see `docker-compose.yml` `env_file` entries

**Build:**
- API: `apps/api-astrum/tsconfig.json` → `tsc` → `dist/` (`apps/api-astrum/package.json` `build`)
- Auth: Nest `nest build` (`apps/auth-astrum`)
- Customer: Next `next build` (`apps/customer`), `output: "standalone"` in `apps/customer/next.config.ts`
- Monorepo scripts: root `package.json` (`dev`, `build`, `lint`, `check-types`, Prisma commands targeting `@astrum/db`)

**Workspace:**
- `pnpm-workspace.yaml` — `apps/*`, `packages/*`
- `pnpm-workspace.yaml` `catalogs.prisma` pins `prisma: latest` for `packages/Astrum-db`

## Platform Requirements

**Development:**
- Docker — PostgreSQL service `astrum-db` (`docker-compose.yml`), optional full stack services (`astrum-api`, `astrum-auth`, `astrum-customer`)
- Corepack-enabled Node for pnpm (Dockerfiles use `corepack enable`)
- Network `astrumnetwork` external for Compose (`docker-compose.yml`)

**Production:**
- Container images built from repo Dockerfiles under `apps/*/Dockerfile`; multi-stage copy of `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `apps/`, `packages/`

---

*Stack analysis: 2026-04-05*
