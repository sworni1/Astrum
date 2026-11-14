# API gateway

## Overview

Express service that owns users, products, cart, wishlist, orders and reviews. It mounts everything under `/api`, verifies the `__auth` JWT cookie, and proxies `/api/auth/*` to the auth service.

## Stack

- Express 5 with helmet, morgan, cors, cookie-parser, run through `tsx watch`
- Prisma 7 client from `@astrum/db` with the pg adapter
- Validation: `class-validator` DTO classes applied by the `validateDto` middleware
- Sessions: one `ioredis` client per process, `REDIS_URL` is required at boot
- Events: `amqplib` publisher into the `astrum.events` exchange
- Tests: jest with ts-jest, config in `jest.config.cjs`

## Key files

| File                                      | Owns                                                              |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `src/app.ts`                              | middleware order, `/health` probe, route mounting, the auth proxy |
| `src/server.ts`                           | port from `API_PORT`, graceful shutdown on SIGTERM                |
| `src/middlewares/authenticateToken.ts`    | JWT check from the `__auth` cookie, then the Redis session read   |
| `src/middlewares/requireActiveAccount.ts` | refuses orders and profile writes while the account is `PENDING`  |
| `src/middlewares/validateDto.ts`          | body validation, strips extra fields                              |
| `src/session/`                            | Redis session store and revocation shared with the auth service   |
| `src/events/`                             | RabbitMQ publisher and the error description helper               |
| `src/common/helpers/errorHandler.ts`      | the single error response shape                                   |
| `src/common/helpers/logger.ts`            | one structured JSON line per event                                |
| `src/common/helpers/proxyOptions.ts`      | proxy factory used for the auth service                           |
| `src/modules/<name>/`                     | controller, routes, service and dto per domain                    |

## Commands

```bash
pnpm --filter @astrum/api dev
pnpm --filter @astrum/api test
pnpm --filter @astrum/api check-types
```

## Conventions

- One folder per module holding `*.controller.ts`, `*.routes.ts`, `*.service.ts` and `dto/`; the router is registered in `src/app.ts`.
- A module keeps its suites in `__tests__/` (`dto/__tests__/` for DTO suites) and its literals in `constants/*.constants.ts`; nothing else lives in those folders, because jest treats every file under `__tests__/` as a suite.
- Nested resources keep their router in the parent module, for example reviews mounted inside `product.routes.ts`.
- Controllers return through `handleErrors` with `http-status-codes`; DTO classes carry the validation rules.
- `POST /api/orders` takes an optional `Idempotency-Key` of 8 to 128 characters from `[A-Za-z0-9_-]`, stores its sha256 body fingerprint on the order and answers the first order with `200` and `Idempotent-Replay: true` on a repeat.
- The order transaction also clears the ordered cart lines; a line the customer did not select stays in the cart.
- Events are published after the commit, and a failed publish is logged instead of failing the request.
- This package has no ESLint: `lint`, `format` and `format:check` are echo stubs that exit 0.
- `DB_POOL_SIZE` bounds the pg pool of one replica (default 10). The compose budget keeps replicas x pool well under the Postgres limit.

## Gotchas

- The port comes from `API_PORT` (default 3580). `src/app.ts` also sets `trust proxy` and stamps `X-Instance` from `HOSTNAME`, which is how a replica is identified behind the balancer.
- Express 5 uses path-to-regexp v8: a bare `*` route throws at boot. Wildcards are written `/{*splat}`.
- `AUTH_SERVICE_URL` must end with `/api/auth`: `http-proxy-middleware` strips the mount path and prepends the target path, so a bare `http://localhost:4580` sends `/signin` and the auth service answers 404. Inside compose the value is `http://auth:4580/api/auth`.
- Every mounted router except the auth proxy sits behind `authenticateToken`, so a new public endpoint is an explicit decision.
- The reviews module exports two routers: `reviewsRouter` for `/api/reviews` and `productReviewsRouter` mounted under `/:productId/reviews`.
- The access log skip rule reads `(req.originalUrl || req.url)`, not `req.path`: inside a mounted router `req.path` is relative to the mount point, so a path comparison silently stops matching and the confirm token lands in the log.
- `requireActiveAccount` answers `503` when the account status cannot be read, and `403 EMAIL_NOT_CONFIRMED` for a `PENDING` account.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
