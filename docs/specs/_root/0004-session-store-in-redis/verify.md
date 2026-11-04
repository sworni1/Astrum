# Verify: Session store in Redis · spec 0004 · updated 2026-11-04
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Steps marked `[x]` were exercised against the dev stack on 2026-11-04 during the build, with the evidence noted beside them. Steps marked `[ ]` were not run.

## UI / manual

- [ ] Sign in at `/auth/signin` with a real account, land on `/`, then read the `__auth` cookie in DevTools → it expires about one day ahead, not seven → AC-9
- [ ] On `/profile` press Log out and confirm → you land on `/auth/signin`, the cookie is gone, and a copy of the cookie taken before the logout answers `401 SESSION_REVOKED` at the next call → AC-4, AC-11
- [ ] With `docker stop astrum-redis` press Log out → you still land on `/auth/signin` and the cookie is gone, and the customer log holds `session.logout.remote_failed` → AC-11
- [ ] Open two tabs on protected pages, log out in the first, then click through the second → exactly one toast «Сессия завершена, войдите снова» and one redirect to `/auth/signin` → AC-12
- [ ] With `docker stop astrum-redis` reload a protected page → the warning toast «Сервис сессий недоступен» appears, nothing redirects, and the cookie survives → AC-12

## Commands

- [x] `docker exec astrum-redis redis-cli TTL session:<sid>` after a sign in → `86399`, the one day record → AC-1, AC-9
- [x] `docker exec astrum-redis redis-cli GET session:<sid>` → `{"userId":…,"createdAt":…,"userAgent":"…"}` → AC-1
- [x] `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3580/api/auth/logout -H "Cookie: __auth=<token>"` → `204`, also on the second call, with no cookie and with a garbage token → AC-4
- [x] `curl -s localhost:3580/api/users/me -H "Cookie: __auth=<token>"` after that logout → `401 {"code":"SESSION_REVOKED"}` while a second account session keeps answering `200` → AC-2, AC-4, AC-5
- [x] `curl -s localhost:3580/api/users/me -H "Cookie: __auth=<token-without-sid>"` (a token signed with the same secret, no `sid` claim) → `401 SESSION_REVOKED`, log `session.missing reason=no_sid` → AC-10
- [x] A token whose `sid` names another user's record → `401 SESSION_REVOKED`, `session.identity.mismatch` in the log, and `redis-cli EXISTS` still answers `1` → AC-3
- [x] `curl -s localhost:3580/api/users/me` with no cookie → `401 {"code":"SESSION_MISSING"}` → AC-2
- [x] `docker stop astrum-redis` then a protected call → `401 {"code":"SESSION_STORE_UNAVAILABLE"}`, log `session.store.error`, never a `5xx` → AC-7
- [x] `docker stop astrum-redis` then `/health` on `api` and on `auth` → `503`; after `docker start` → `200` with the existing body → AC-8
- [x] `PATCH /api/users/me/password` with the right old password, then the same cookie → `401 SESSION_REVOKED`; with a wrong old password → nothing is revoked → AC-6
- [x] `DELETE /api/users/me`, then the same cookie → `401 SESSION_REVOKED` and `redis-cli EXISTS session:<sid>` → `0` → AC-6
- [x] `REDIS_URL` unset, then load the store module of `api` (and of `auth`) → it throws `REDIS_URL is required: the session store has no default connection string` → AC-13
- [x] `docker compose -f docker-compose.prod.yml config` → the `redis` service keeps `$$REDIS_PASSWORD` for the container shell, has no published port and no volume, and `api`/`auth` depend on it with `condition: service_healthy` → AC-13
- [ ] `docker compose -f docker-compose.prod.yml up -d --build` then `redis-cli -a <password> ping` from another container → `PONG` and a wrong password refused → AC-13

## Acceptance-criteria coverage

- AC-1 … commands: TTL, record body, token payload carries `sid`
- AC-2 … commands: live session `200`, revoked `401 SESSION_REVOKED`, no cookie `401 SESSION_MISSING`
- AC-3 … command: foreign owner `401 SESSION_REVOKED` with the record left in place
- AC-4 … command: logout `204` four ways, record gone, cookie refused afterwards
- AC-5 … command: the second session of the same user keeps answering `200`
- AC-6 … commands: password change and account deletion revoke the calling token only
- AC-7 … command: store stopped answers `401 SESSION_STORE_UNAVAILABLE`
- AC-8 … command: `/health` `503` with the store down, `200` with it up, on both services
- AC-9 … UI step on the cookie expiry and the `TTL` command
- AC-10 … command: a token without `sid` is refused as `SESSION_REVOKED`
- AC-11 … UI steps: logout with the backend up and with it down
- AC-12 … UI steps: one toast and one redirect from a burst, and no cookie cleared while the store is down
- AC-13 … command: the store modules throw without `REDIS_URL`, and the prod compose resolves the password at run time
- AC-14 … covered by the unit suite in `apps/auth-astrum/src/auth/auth.service.spec.ts` (a failed write answers `503` and issues no token)
