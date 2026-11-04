# 2026-11-04 · A session lives in Redis and a logout really ends it

Spec: [0004-session-store-in-redis](../specs/_root/0004-session-store-in-redis/index.md).

## Added

- `apps/auth-astrum/src/redis/redis.service.ts` and `redis.module.ts` — one `ioredis` client per
  process built from `REDIS_URL` (command timeout 1000 ms, offline queue off, one retry per
  command), the `SessionStore` shape (`get`, `set`, `del`, `ping`) the code talks through,
  `sessionKey` and `loggedSid` helpers, and `onModuleDestroy` so a shutdown closes the socket.
- `apps/api-astrum/src/session/sessionStore.ts` — the same store for the gateway, built once per
  process; without `REDIS_URL` the process stops at boot instead of falling back to a default.
  A failing connection is one structured `session.store.connection` line, not ioredis's own output.
- `apps/api-astrum/src/session/revokeSession.ts` — deletes one record, logs `session.revoked` on
  a real deletion and `session.revoke.failed` when the store is down, and never fails the request.
- `POST /api/auth/logout` on the auth service, plus `cookie-parser` in
  `apps/auth-astrum/src/main.ts` so the route can read `__auth`. It deletes before answering, so
  the next request on any replica is refused.
- `redis` service in `docker-compose.prod.yml` (`redis:7-alpine`, `--requirepass` from
  `.env.prod`, no volume, no persistence, health check through `redis-cli`), and `astrum-redis` in
  `docker-compose.yml`; `api` and `auth` wait for it with `condition: service_healthy`.
- `REDIS_URL` and `REDIS_PASSWORD` in `.env.example` and `.env.prod.example`, `REDIS_URL` in the
  two app templates.
- Tests: `apps/api-astrum/src/__tests__/authenticateToken.test.ts` walks the eight branches of the
  guard, the auth service spec covers the record write, the 512 character `userAgent` cut, the
  failed write, a new `sid` per sign in and the idempotent logout, and the controller spec covers
  the `User-Agent` header and the logout route.

## Changed

- `signToken(userId, userAgent)` mints a 32 byte base64url `sid`, writes `session:<sid>` with
  `SET ... EX 86400` before it signs, and the token carries `{ userId, sid }`. A failed write
  answers `503 SESSION_STORE_UNAVAILABLE` and issues no token (`session.write.failed`).
- `register` and `signin` take the `User-Agent` header from the controller; a registration that
  fails on the write answers a message naming the created account.
- `apps/api-astrum/src/middlewares/authenticateToken.ts` is now a factory over the store and
  asynchronous: signature, then the record, then the owner compare. A refusal answers `401` with
  `SESSION_MISSING`, `TOKEN_INVALID`, `SESSION_REVOKED` (missing record, unreadable record, foreign
  owner, or a token without `sid`) or `SESSION_STORE_UNAVAILABLE`, one structured line per branch,
  and `req.userId` plus `req.sid` are set for the handlers.
- `PATCH /api/users/me/password` and `DELETE /api/users/me` delete the calling session before the
  write, without a transaction, so a partial failure signs the customer out instead of leaving a
  live session behind. A wrong old password deletes nothing.
- `GET /health` on `api` and on `auth` pings Redis after Postgres, so a dead store takes a replica
  out of rotation instead of answering requests from a healthy looking process.
- `apps/customer/src/common/helpers/session.ts` — the cookie is written for one day, `updateSession`
  is gone, and the new `endSession` action calls the gateway with the cookie and a 2 s timeout,
  deletes the cookie whatever the answer, then redirects.
- `apps/customer/src/hooks/useFetcher.ts` — the axios instance ends the session once on
  `SESSION_REVOKED`, `TOKEN_INVALID` or `SESSION_MISSING` (one toast, one navigation, the flag reset
  after a successful sign in) and only warns on `SESSION_STORE_UNAVAILABLE`, because that session is
  still alive.
- `apps/customer/src/hooks/useLogOut.ts` calls `endSession`.
- Root `dev` and `db:up` scripts start `astrum-redis` together with `astrum-db`.
- `order.routes.ts` and `reviews.routes.ts` no longer mount the guard a second time; the app mount
  already guards them, so a request reads the store once.

## Fixed

- The `__auth` cookie was written for seven days while the token inside died after one, so the
  storefront showed a customer as signed in and the first API call disagreed. Both are one day now.
- `AuthService.register` swallowed every Prisma error that was not `P2002` and answered `200` with
  an empty body. It rethrows now.

## Verified

- Live dev stack, values read back from Redis and from the response bodies: a registration answered
  with a token carrying `sid`, `TTL session:<sid>` was 86399 and the record held
  `{userId, createdAt, userAgent}`, and `GET /api/users/me` with that cookie answered `200`.
- Logout through the gateway answered `204` four times in a row (valid token, repeat, no cookie,
  garbage token); the record disappeared and the same cookie then answered
  `401 {"code":"SESSION_REVOKED"}`, while a second session of the same user kept answering `200`.
- A token signed without `sid` answered `401 SESSION_REVOKED` and logged
  `session.missing reason=no_sid`; a token naming another user's record answered `401
  SESSION_REVOKED`, logged `session.identity.mismatch`, and the record stayed in place.
- With the container stopped a protected call answered `401 SESSION_STORE_UNAVAILABLE` and logged
  `session.store.error`, while `/health` answered `503` on both services and `200` again after
  `docker start`. Recreating the container emptied the store, as designed.
- A password change and an account deletion each answered `200` and then refused the token they
  were called with, and the record was gone.
- Loading each store module with `REDIS_URL` unset threw
  `REDIS_URL is required: the session store has no default connection string`, and
  `docker compose -f docker-compose.prod.yml config` keeps `$$REDIS_PASSWORD` for the container
  shell.
- `pnpm quality-gate` → 14 of 14 tasks (69 tests in api, 22 in auth, 10 in customer).
- Steps and the two browser checks that were not run:
  [verify.md](../specs/_root/0004-session-store-in-redis/verify.md).

## Open

- `apps/customer/src/proxy.ts` still trusts the signature only, so a revoked customer can see page
  shells until the first API call answers `401`. Deferred in spec 0004.
- There is no `user:<id>:sessions` index, so «выйти на всех устройствах» and a device list still
  need a design.
- A session lives one day flat, with no renewal on activity.
- Deleting an account revokes only the session that made the call: the customer's other sessions
  keep passing the gateway until their day ends.
- No metric or alert exists on `session.store.error` and on a `/health` `503`; today the failure is
  only in the logs.
- Two storefront checks (one toast from a burst of `401`, and the retry toast while the store is
  down) were not run in a browser.
- `README.md` still calls the replicas stateless and `docs/DEVELOPMENT.md` does not mention
  `REDIS_URL` or that `pnpm dev` now starts two containers.
- Redis has no persistence by decision, so a restart ends every live session and everyone signs in
  again. In development the store shares nothing with Postgres, but `pnpm dev` and
  `pnpm docker:prod:up` still must not run together because of the shared Postgres volume.
