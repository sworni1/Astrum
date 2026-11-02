# Auth service

## Overview

NestJS service for registration, sign in and token refresh. It serves everything under the `/api` prefix, publishes Swagger at `/swagger`, and signs the JWT that the gateway verifies from the `__auth` cookie.

## Stack

- NestJS 11.2.8 (NestJS 12 is ESM-only and cannot run in this CommonJS service) with passport-jwt, argon2 password hashing, compression
- Prisma 7 client from `@astrum/db` through `src/prisma/prisma.service.ts`
- Tests: jest with ts-jest, e2e config in `test/jest-e2e.json`

## Key files

| File                | Owns                                                    |
| ------------------- | ------------------------------------------------------- |
| `src/main.ts`       | bootstrap, global prefix, ValidationPipe, CORS, Swagger |
| `src/app.module.ts` | module wiring                                           |
| `src/auth/`         | controller, service, JWT strategy and DTOs              |
| `src/prisma/`       | Prisma service and module                               |

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
- ts-jest runs with `diagnostics: false`, and reads the TypeScript 6 API through the `typescript` alias; `tsc` itself is TypeScript 7.
- `nest build` emits `dist/src/main.js` because TypeScript 7 defaults `rootDir` to the project folder and the generated Prisma client lives outside `src`. `start:prod` and `nest-cli.json` `entryFile` follow that path.
- Auth guards come from the Nest passport module; the gateway never re implements login logic.

## Gotchas

- Port 4580 is hardcoded in `src/main.ts`; `AUTH_PORT` is not read.
- CORS allows only `http://localhost:3000`, so another dev host needs an explicit entry there.
- The refresh flow and the cookie name must stay in sync with customer `src/common/helpers/session.ts` and gateway `authenticateToken.ts`, all three read `__auth`.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
