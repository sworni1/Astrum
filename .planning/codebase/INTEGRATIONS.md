# External Integrations

**Analysis Date:** 2026-04-05

## APIs & External Services

**HTTP APIs (first-party):**
- Customer → API gateway — `axios` base URL from `process.env.NEXT_PUBLIC_API_GATEWAY_URL` (`apps/customer/src/hooks/useFetcher.ts`)
- API gateway → Auth service — reverse proxy `/api/auth` to `process.env.AUTH_SERVICE_URL` (`apps/api-astrum/src/app.ts`, `apps/api-astrum/src/common/helpers/proxyOptions.ts`)

**Documentation / discovery:**
- OpenAPI (Swagger UI) — Nest auth at `/swagger` (`apps/auth-astrum/src/main.ts`)

**Third-party SDKs (not detected in application code):**
- Stripe — only enum/value `PaymentMethod.STRIPE` in UI (`apps/customer/src/common/types/order.types.ts`, checkout UI); no `stripe` package in workspace `package.json` files

**GraphQL:**
- `@apollo/client` and `@apollo/client-integration-nextjs` are dependencies of `apps/customer` but no Apollo client usage found under `apps/customer/src` — treat as unused or planned integration

## Data Storage

**Databases:**
- PostgreSQL `13` — Docker image `postgres:13` (`docker-compose.yml` service `astrum-db`)
- Connection string: `DATABASE_URL` (Prisma `packages/Astrum-db/prisma.config.ts`; apps use `process.env.DATABASE_URL` in `apps/api-astrum/lib/prisma.ts`, `apps/auth-astrum/src/prisma/prisma.service.ts`, `packages/Astrum-db/lib/prisma.ts`)
- ORM: Prisma with `@prisma/adapter-pg` and `pg` driver
- Schema ownership: migrations live under `packages/Astrum-db/prisma/migrations`; root scripts invoke Prisma via `pnpm --filter @astrum/db`. Duplicate `schema.prisma` files also exist in `apps/api-astrum/prisma/` and `apps/auth-astrum/prisma/` — keep in sync with `packages/Astrum-db/prisma/schema.prisma` when changing schema

**File Storage:**
- Local / app-managed — product images referenced by URLs in Next config (see below), not a dedicated blob SDK in repo

**Caching:**
- Not detected — no Redis or similar in package manifests

## Authentication & Identity

**Auth Provider:**
- Custom — NestJS auth service (`apps/auth-astrum`) with JWT (`@nestjs/jwt`, `passport-jwt`, `JwtStrategy` in `apps/auth-astrum/src/auth/auth.module.ts`)
- Password hashing: `argon2` (`apps/auth-astrum` dependencies)
- API gateway validates JWT from cookie `__auth` using `JWT_SECRET` (`apps/api-astrum/src/middlewares/authenticateToken.ts`)
- Customer: `jose`, `jsonwebtoken`, `jwt-decode` for session/token handling (`apps/customer` dependencies, `apps/customer/src/common/helpers/session.ts` uses `JWT_SECRET`)

**CORS:**
- API: `http://localhost:3000` (`apps/api-astrum/src/middlewares/corsOptions.ts`)
- Auth: same origin list (`apps/auth-astrum/src/main.ts`)

## Monitoring & Observability

**Error Tracking:**
- Not detected — no Sentry/Rollbar/etc. in dependencies

**Logs:**
- `morgan` HTTP logging on API (`apps/api-astrum/src/app.ts`)
- `console` usage in fetcher error paths (`apps/customer/src/hooks/useFetcher.ts`)

## CI/CD & Deployment

**Hosting:**
- Docker Compose stack for local/prod-style runs (`docker-compose.yml`) — services `astrum-db`, `astrum-api`, `astrum-auth`, `astrum-customer` with env files per app path

**CI Pipeline:**
- Not detected — no `.github/workflows` in repository at analysis time

**Git hooks:**
- Husky + lint-staged (root `package.json`)

## Environment Configuration

**Required env vars (non-exhaustive, from code references):**
- `DATABASE_URL` — Prisma and services
- `JWT_SECRET` — API token verification, customer session helpers, auth tests (`apps/auth-astrum/test/api-astrum.e2e-spec.ts`)
- `AUTH_SERVICE_URL` — API gateway proxy target (`apps/api-astrum/src/app.ts`); e2e tests default `http://localhost:4580` (`apps/auth-astrum/test/api-astrum.e2e-spec.ts`)
- `NEXT_PUBLIC_API_GATEWAY_URL` — customer axios base URL (`apps/customer/src/hooks/useFetcher.ts`)

**Secrets location:**
- Per-service `.env` files referenced by Compose (`docker-compose.yml` `env_file`); `packages/Astrum-db/.env` for DB container — do not commit contents

## Webhooks & Callbacks

**Incoming:**
- Not detected — no Stripe/webhook route handlers found in scanned app entrypoints

**Outgoing:**
- Not detected — no dedicated webhook client libraries in manifests

## Remote assets & CDNs

**Next.js `images.remotePatterns`** (`apps/customer/next.config.ts`):
- `https://flowbite.s3.amazonaws.com/docs/gallery/**`
- `https://bundui-images.netlify.app/**`
- `https://images.unsplash.com/**`
- `http://magazilla.ru/**`, `https://magazilla.ru/**`
- `http://mzimg.com/**`, `https://mzimg.com/**`

---

*Integration audit: 2026-04-05*
