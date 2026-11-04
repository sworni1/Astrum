# API gateway

## Overview

Express service that owns users, products, cart, wishlist, orders and reviews. It mounts everything under `/api`, verifies the `__auth` JWT cookie, and proxies `/api/auth/*` to the auth service.

## Stack

- Express 5 with helmet, morgan, cors, cookie-parser, run through `tsx watch`
- Prisma 7 client from `@astrum/db` with the pg adapter
- Validation: `class-validator` DTO classes applied by the `validateDto` middleware
- Tests: jest with ts-jest, config in `jest.config.cjs`

## Key files

| File                                   | Owns                                                              |
| -------------------------------------- | ----------------------------------------------------------------- |
| `src/app.ts`                           | middleware order, `/health` probe, route mounting, the auth proxy |
| `src/server.ts`                        | port from `API_PORT`, graceful shutdown on SIGTERM                |
| `src/middlewares/authenticateToken.ts` | JWT check from the `__auth` cookie, sets `req.userId`             |
| `src/middlewares/validateDto.ts`       | body validation, strips extra fields                              |
| `src/common/helpers/errorHandler.ts`   | the single error response shape                                   |
| `src/common/helpers/proxyOptions.ts`   | proxy factory used for the auth service                           |
| `src/modules/<name>/`                  | controller, routes, service and dto per domain                    |

## Commands

```bash
pnpm --filter @astrum/api dev
pnpm --filter @astrum/api test
pnpm --filter @astrum/api check-types
```

## Conventions

- One folder per module holding `*.controller.ts`, `*.routes.ts`, `*.service.ts` and `dto/`; the router is registered in `src/app.ts`.
- Nested resources keep their router in the parent module, for example reviews mounted inside `product.routes.ts`.
- Controllers return through `handleErrors` with `http-status-codes`; DTO classes carry the validation rules.
- This package has no ESLint: `lint`, `format` and `format:check` are echo stubs that exit 0.
- `DB_POOL_SIZE` bounds the pg pool of one replica (default 10). The compose budget keeps replicas x pool well under the Postgres limit.

## Gotchas

- The port comes from `API_PORT` (default 3580). `src/app.ts` also sets `trust proxy` and stamps `X-Instance` from `HOSTNAME`, which is how a replica is identified behind the balancer.
- Express 5 uses path-to-regexp v8: a bare `*` route throws at boot. Wildcards are written `/{*splat}`.
- `AUTH_SERVICE_URL` must end with `/api/auth`: `http-proxy-middleware` strips the mount path and prepends the target path, so a bare `http://localhost:4580` sends `/signin` and the auth service answers 404. Inside compose the value is `http://auth:4580/api/auth`.
- Every mounted router except the auth proxy sits behind `authenticateToken`, so a new public endpoint is an explicit decision.
- The reviews module exports two routers: `reviewsRouter` for `/api/reviews` and `productReviewsRouter` mounted under `/:productId/reviews`.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
