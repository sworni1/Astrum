# Auth service

## Overview

NestJS service for registration, sign in, sign out and email confirmation. It serves everything under the `/api` prefix, publishes Swagger at `/swagger`, signs the JWT that the gateway verifies from the `__auth` cookie, and owns both the `session:<sid>` records in Redis and the confirmation tokens.

## Stack

- NestJS 11.2.8 (NestJS 12 is ESM-only and cannot run in this CommonJS service) with passport-jwt, argon2 password hashing, compression
- Prisma 7 client from `@astrum/db` through `src/prisma/prisma.service.ts`
- Sessions: one `ioredis` client per process, `REDIS_URL` is required at boot
- Events: `amqplib` publisher into the `astrum.events` exchange
- Tests: jest with ts-jest, e2e config in `test/jest-e2e.json`

## Key files

| File                | Owns                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| `src/main.ts`       | bootstrap, port from `AUTH_PORT`, ValidationPipe, CORS, Swagger, shutdown hooks |
| `src/app.module.ts` | module wiring                                                                   |
| `src/health/`       | `GET /health` probe with a database round trip, outside the `/api` prefix       |
| `src/auth/`         | controller, service, JWT strategy and DTOs                                      |
| `src/prisma/`       | Prisma service and module, pool size from `DB_POOL_SIZE`                        |
| `src/redis/`        | session store client and module                                                 |
| `src/events/`       | RabbitMQ publisher for `account.confirmation.requested`                         |
| `src/config/`       | token lifetime, cookie settings and the confirmation link base                  |

## Commands

```bash
pnpm --filter @astrum/auth dev
pnpm --filter @astrum/auth test
pnpm --filter @astrum/auth test:e2e
pnpm --filter @astrum/auth lint
pnpm --filter @astrum/auth check-types
```

## Conventions

- The global `ValidationPipe` runs with `whitelist: true`, so DTO decorators are the contract for every body.
- Never import an injectable class or a DTO with `import type`: TypeScript erases it, Nest cannot resolve the dependency and `design:paramtypes` loses the DTO, after which `whitelist` strips the whole body. `biome.json` disables `style.useImportType` for this reason.
- `GET /health` is excluded from the `/api` global prefix through `setGlobalPrefix("/api", { exclude: [...] })`; it must answer the same path in every environment because the balancer probes it.
- ts-jest runs with `diagnostics: false`, and reads the TypeScript 6 API through the `typescript` alias; `tsc` itself is TypeScript 7.
- `nest build` emits `dist/src/main.js` because TypeScript 7 defaults `rootDir` to the project folder and the generated Prisma client lives outside `src`. `start:prod` and `nest-cli.json` `entryFile` follow that path.
- Auth guards come from the Nest passport module; the gateway never re implements login logic.
- The routes are `POST /api/auth/register`, `signin`, `logout`, `confirm` and `confirm/resend`; the JWT carries `{ userId, sid }` and every sign in writes the matching `session:<sid>` record.
- The confirmation event is published after the user row commits, and delivery belongs to `apps/worker`: this service never sends mail itself.

## Gotchas

- The port comes from `AUTH_PORT` (default 4580). `app.enableShutdownHooks()` closes the Prisma pool on SIGTERM, which is what lets a replica leave the balancer without dropping requests.
- CORS allows only `http://localhost:3000`, so another dev host needs an explicit entry there.
- Changing the email address puts the account back to `PENDING`, deletes the old tokens and publishes a new confirmation event, so the new address has to be confirmed before orders and profile writes work again.
- The refresh flow and the cookie name must stay in sync with customer `src/common/helpers/session.ts` and gateway `authenticateToken.ts`, all three read `__auth`.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
