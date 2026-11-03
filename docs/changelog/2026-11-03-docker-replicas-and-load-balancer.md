# 2026-11-03 · Replicas behind Caddy: a deployable Docker topology

## Added

- `docker-compose.prod.yml` — the deployable stack: `db`, one-shot `migrate`,
  `auth` x1, `api` x3, `customer` x2, `proxy` (Caddy). Only the proxy publishes
  ports (`80`, `443`, `443/udp`).
- `Caddyfile` — public site on `{$DOMAIN:http://localhost}` plus the internal
  balancer on `:3580`. Replicas are discovered with `dynamic a <service> <port>`
  (`refresh 5s`), balanced with `lb_policy round_robin`, and probed through
  `health_uri /health`. `lb_try_duration 5s` retries on another replica while the
  health check is still catching up.
- `packages/Astrum-db/Dockerfile` — one-shot migration image
  (`prisma migrate deploy`, `openssl` installed for the Prisma CLI).
- `.env.prod.example` — every runtime variable of the stack, with service-name
  hostnames (`db`, `auth`, `api`, `proxy`) instead of `localhost`.
- `apps/customer/docker/graceful.cjs` — patches `http.Server#listen` so the Next
  standalone server drains in-flight requests on `SIGTERM`.
- Root scripts: `docker:prod:up`, `docker:prod:down`, `docker:prod:logs`,
  `docker:prod:scale`.
- `GET /health` on all three services: api and auth do a `SELECT 1` round trip,
  customer returns its instance id. `X-Instance` header on api and auth responses.

## Changed

- `apps/api-astrum/Dockerfile`, `apps/auth-astrum/Dockerfile`,
  `apps/customer/Dockerfile` — rebuilt on `node:24-bookworm-slim` with
  `turbo prune --docker` (pruner → deps → builder → runner). api/auth ship a
  production-only `node_modules`; customer ships the Next standalone bundle.
- **Graceful shutdown**: `apps/api-astrum/src/server.ts` closes the server and
  disconnects Prisma on `SIGTERM`/`SIGINT`; auth calls `app.enableShutdownHooks()`.
  Both read the port from `API_PORT` / `AUTH_PORT` instead of hardcoding it.
- **Prisma pool** is bounded per replica through `DB_POOL_SIZE`
  (`apps/api-astrum/lib/prisma.ts`, `apps/auth-astrum/src/prisma/prisma.service.ts`),
  default 10. Budget: 3 x 10 + 1 x 10 = 40 of the Postgres 100.
- `apps/api-astrum/src/app.ts`: `trust proxy`, `x-powered-by` off, `X-Instance`.
- `apps/auth-astrum/src/main.ts`: `trust proxy`, `X-Instance`, `/health` excluded
  from the `/api` global prefix, port from env.
- `apps/customer/next.config.ts`: `outputFileTracingRoot` at the workspace root, so
  the standalone bundle keeps the `apps/customer/server.js` layout.
- Customer reaches the gateway through the proxy: `API_GATEWAY_INTERNAL_URL=http://proxy:3580`
  (build arg) and the browser uses the relative `NEXT_PUBLIC_API_GATEWAY_URL=/api-gateway`,
  which removes the cross-origin call and its hardcoded allowlist.
- `apps/customer/src/proxy.ts`: `/health` excluded from the auth guard matcher.
- `.dockerignore`: excludes `node_modules`, `.next`, `dist`, generated Prisma
  clients, `.env*`, the seed xlsx folder and the leftover `apps/customer/e:` path.
- Compose keeps `postgres:16` (Debian), not `-alpine`: the existing data volume was
  initialised by the Debian build and an Alpine server reports collation-version
  mismatches on it (`CREATE DATABASE` failed with a collation error).

## Fixed

- **NestJS DI erased by biome** (`2b32974`): `biome check --write` had rewritten
  `import { AuthService }`, `ConfigService`, `JwtService`, `PrismaService` and both
  DTOs into `import type`. Nest could not resolve `AuthController` at all, and the
  DTOs lost their `design:paramtypes`, so `ValidationPipe` with `whitelist: true`
  stripped every request body — `signin` reached Prisma with `email: undefined` and
  answered 500. Value imports restored; `style.useImportType` is now `off` in
  `biome.json` so the rule cannot come back.
- **ESLint 10 plugin resolution in `apps/customer`**: `react-hooks/set-state-in-effect`
  was set in a config object that never registered the plugin, which aborted
  `eslint .` with a fatal config error (so `pnpm lint` and `pnpm quality-gate` never
  ran for the storefront). The plugin is registered in that object; `docker/**` is
  ignored because the graceful-shutdown wrapper is CommonJS by design.

## Verified

All numbers below are from live runs against the compose stack on `http://localhost`.

| Check                     | Command                                                 | Result                                                                            |
| ------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Distribution, storefront  | 20 x `GET /health`                                      | 2 replicas, 10 / 10                                                               |
| Distribution, gateway     | 20 x `GET /api-gateway/products/categories/shoes`       | 3 replicas, 7 / 7 / 6                                                             |
| Authenticated traffic     | 12 x `GET /api-gateway/cart` with `__auth`              | 3 replicas, 4 / 4 / 4, all `200`                                                  |
| Catalogue data            | `GET /api-gateway/products/recommendations`             | `200`, 2905 bytes                                                                 |
| Replica killed under load | 26 s load, `docker stop astrum-api-2` at t+6 s          | 1265 requests, 1262 `200`, 3 x `502`, recovery to 3 replicas                      |
| Load and pool             | 50 concurrent clients, 20 s, `pg_stat_activity` sampled | 10921 requests, 0 errors, p50 68 ms / p95 328 ms / p99 466 ms, max 32 connections |
| Migrations from scratch   | `prisma migrate deploy` on an empty database            | `20260408151426_init` applied                                                     |
| Graceful stop             | `docker stop` on api                                    | `[api] SIGTERM received, draining connections`, exit 0                            |
| Storefront                | browser at `http://localhost/`                          | renders, signed-in catalogue with real products                                   |
| Gate                      | `pnpm quality-gate`                                     | 14 of 14 tasks pass (13 warnings, by design)                                      |

## Open

- **Order flow**: check #6 of the plan (two concurrent orders for the last unit,
  exactly one wins) cannot run — the order endpoints exist but the transactional
  reservation does not. The topology does not block it: replicas are stateless, so
  the lock has to live in Postgres (`SELECT ... FOR UPDATE`).
- **`POST /api/auth/register` is broken independently of this change**: the DTO has
  no `preferredCategories` field while the Prisma model requires it, and
  `AuthService.register` swallows non-`P2002` Prisma errors, so the endpoint answers
  `200` with an empty body and creates nothing.
- **Dev and prod share one data volume** (`POSTGRES_VOLUME=astrum_astrum-db-data` in
  `.env`). `pnpm dev` and `pnpm docker:prod:up` must never run at the same time.
- A deploy is a rebuild, not a rolling update: `docker compose up -d --build` replaces
  replicas one at a time, so breaking schema changes still need the two-step rule.
- **Two formatters disagree in `apps/auth-astrum`**: the package keeps a `.prettierrc` and
  `eslint-plugin-prettier`, and its `lint` script runs `eslint --fix`, so every
  `pnpm quality-gate` rewrites the whole auth package to the prettier style (single quotes),
  while the root `biome.json` formats to double quotes. Whichever runs last wins and the
  other one leaves formatting churn in `git status`. Pick one formatter for that package
  before it hides a real diff.
