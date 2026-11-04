---

id: 0004
slug: session-store-in-redis
status: Accepted
adrs: []
date: 2026-11-04
---

# Session store in Redis

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md)._

## Summary

A session today is only a signed token. The auth service signs the user id for one day, the gateway checks the signature, and nothing on the server remembers that the session exists, so a copied token works until it expires and logging out does nothing beyond deleting the cookie in one browser. This spec keeps one record per session in Redis, gives each token its own session id, and makes the gateway look that record up on every protected request. Logging out, changing the password, or deleting the account deletes the record, and the same token is refused on every replica at the next request.

## Requirements

**User stories**:

- As a signed in customer, I want the logout button to really end my session, so that a copy of the cookie stops working.
- As a signed in customer, I want the shop to stay fast while it checks my session, so that a safe session costs me no visible delay.
- As the person who runs the shop, I want a dead session store to be visible instead of silently accepting tokens, so that I know the difference between a quiet shop and a broken one.

**Acceptance criteria**:

- **AC-1**: `POST /api/auth/register` and `POST /api/auth/signin` create one session record before answering: key `session:<sid>` with value `{"userId": "<uuid>", "createdAt": "<ISO 8601>", "userAgent": "<string up to 512 characters, or null>"}`, written with `SET key value EX 86400` (one command, expiry in the same write). The token they return carries `{ userId, sid }`, where `sid` is 32 random bytes from `crypto.randomBytes` in base64url (43 characters). The `userAgent` comes from the `User-Agent` header of the auth call (the controller method takes `@Headers("user-agent")` and passes it as `signToken(userId, userAgent)`), truncated to 512 characters, `null` when the header is absent. `createdAt` and `userAgent` are write only in this spec, read by nothing until the device list in Follow-up.
- **AC-2**: `authenticateToken` on the gateway, after the signature check succeeds, reads `session:<sid>` and lets the request through only when the record exists. A missing record (revoked or expired) answers `401` with `{ "code": "SESSION_REVOKED", "message": "..." }`, the handler never runs, and one structured log line `session.missing` is written with `req.method`, `req.baseUrl + req.path` and the first 8 characters of the sid. A request with no `__auth` cookie answers `401` with `{ "code": "SESSION_MISSING" }`, and a cookie whose signature or expiry fails answers `401` with `{ "code": "TOKEN_INVALID" }`, both before any store read.
- **AC-3**: a record whose `userId` differs from the token's `userId` is treated as revoked: `401` with code `SESSION_REVOKED`, handler not reached, log line `session.identity.mismatch` with `req.method`, `req.baseUrl + req.path` and the first 8 characters of the sid. The record is left in place.
- **AC-4**: `POST /api/auth/logout` deletes the record for the sid in the `__auth` cookie and answers `204` with no body. It deletes before answering, so the next request on any of the three `api` replicas answers `401 SESSION_REVOKED`. Called twice, or called without a cookie, or called with an expired token, it still answers `204` and deletes nothing that does not exist. One log line `session.revoked` per real deletion.
- **AC-5**: logging out on one device leaves the other sessions of the same user working: a second sign in produces a different `sid`, and revoking the first record does not touch the second token, which keeps passing the gateway.
- **AC-6**: `PATCH /api/users/me/password` and `DELETE /api/users/me` delete the session record of the requesting token before answering success, so the token used for the call is refused on its next request. A failed password change (wrong old password) deletes nothing. The order is fixed: delete the session record first, then the user row, with no transaction, so a partial failure signs the customer out instead of leaving a live session behind, and a failed delete is logged as `session.revoke.failed` and still answers success.
- **AC-7**: when the Redis lookup itself fails (connection refused, timeout), the gateway answers `401` with `{ "code": "SESSION_STORE_UNAVAILABLE", "message": "..." }`, never a `5xx`, and never reaches a handler. The failure is logged once per failed lookup as `session.store.error` with `req.method`, `req.baseUrl + req.path` and the error message. A record that exists but does not parse as JSON answers `401 SESSION_REVOKED` and is logged as `session.record.invalid` with the sid prefix, so a broken store and a broken record are told apart from a store outage in the logs and in the response body.
- **AC-8**: `GET /health` on `api` and on `auth` answers `503` when the Redis ping fails and `200` with the existing body when both Postgres and Redis answer. The ping uses the same client as the request path and must not hang the probe: a command timeout of 1000 ms or less bounds it.
- **AC-9**: the session and the cookie agree on one lifetime: the `__auth` cookie is set with `expires` one day ahead in `createSession`, the token keeps `expiresIn: "1d"`, and the record's TTL is 86400 seconds. `updateSession` in `apps/customer/src/common/helpers/session.ts` is deleted: it has no caller and it rewrites the cookie seven days ahead of the token. No renewal happens on activity: a session lives one day from sign in and then ends.
- **AC-10**: a token without a `sid` claim (any token issued before this change) is refused with `401 SESSION_REVOKED` and logged as `session.missing` with a `reason: "no_sid"` field. There is no transitional path that accepts a signature alone, so every user signs in once after deploy.
- **AC-11**: the logout button on the profile page calls a server action that first sends `fetch(`${API_GATEWAY_INTERNAL_URL}/api/auth/logout`, { method: "POST", headers: { cookie: `__auth=${token}` }, signal: AbortSignal.timeout(2000) })` with the token read from `cookies()`, then deletes the cookie, then redirects to `/auth/signin`. When that call fails or takes longer than 2000 ms, the cookie is still deleted and the failure is logged as `session.logout.remote_failed`, so a broken backend never traps the user inside the account.
- **AC-12**: the `401` handling lives in one place, the axios instance built by `createAxiosInstance` in `apps/customer/src/hooks/useFetcher.ts`, with a module level flag so it fires once. A `401` with code `SESSION_REVOKED`, `TOKEN_INVALID` or `SESSION_MISSING` clears the cookie through the existing server action, shows one toast («Сессия завершена, войдите снова») and sends the customer to `/auth/signin`. A `401` with code `SESSION_STORE_UNAVAILABLE` clears nothing, because the session behind it is still alive, and shows a retry toast instead. The flag resets after a successful sign in, so the next session ends once as well. Parallel failures, including the SWR retries (`errorRetryCount` 3 in `useUser`, 2 in the shared config), produce a single toast and a single navigation.
- **AC-13**: `REDIS_URL` is a required variable for `api` and for `auth`: the process throws at boot when it is missing, rather than falling back to a local default. Both compose files carry the store: `docker-compose.prod.yml` gets a `redis` service (`redis:7-alpine`, `--requirepass` from `.env.prod`, no volume and no persistence, health check `redis-cli -a $$REDIS_PASSWORD ping`, no port published) that `api` and `auth` reach through `depends_on: redis: condition: service_healthy`; the dev `docker-compose.yml` gets the same service next to `astrum-db` and the same wiring for `astrum-api` and `astrum-auth`. `.env.example` and `.env.prod.example` document the variable, and the password inside `REDIS_URL` is URL encoded, so a generated secret holding `@`, `:` or `/` still forms a valid URL.
- **AC-14**: when the session write fails, sign in and register answer `503` with `{ "code": "SESSION_STORE_UNAVAILABLE", "message": "..." }` and issue no token, and the failure is logged as `session.write.failed` with the account id. A registration that already created the user row therefore leaves an account that cannot be signed out of anything but can sign in once the store answers again, and the message says so. A sign in that fails this way creates no session record and no cookie on the client, because no token was returned.

## Decision

**Chosen option**: Option 2: one Redis record per session, its id carried in the token, the gateway checks the record on every protected request.

A sign in writes `session:<sid>` with a one day expiry and puts `sid` into the same JWT that already carries `userId`. The gateway keeps verifying the signature and then reads that key, so a missing record refuses the request with `401 SESSION_REVOKED` on whichever replica serves it. Logout, password change and account deletion remove the key. A failing store refuses the request with `401 SESSION_STORE_UNAVAILABLE` and takes the replica out of rotation through `/health`.

**Implementation skills**: `redis-core` (`redis/agent-skills`, `.agents/skills/redis-core/`) · `redis-connections` (`redis/agent-skills`, `.agents/skills/redis-connections/`) · `redis-security` (`redis/agent-skills`, `.agents/skills/redis-security/`)

Decisions taken here rather than asked (each with the runner up):

- **Where the lookup lives**: `apps/api-astrum/src/middlewares/authenticateToken.ts` becomes async and does signature then `GET session:<sid>`, so every protected router inherits the check from the one place that already guards them. Runner up: a second middleware after `authenticateToken`, rejected because two guards in a row invite a new router to mount only the first.
- **One Redis client per process**: a module that builds a single `ioredis` instance from `REDIS_URL` with `maxRetriesPerRequest: 1`, `enableOfflineQueue: false` and `commandTimeout: 1000`, exported for the gateway and provided as a Nest provider for auth. Runner up: a per request client, rejected because a connection per request turns a busy shop into a Redis connection storm.
- **Refusal shape**: four `401` codes through the existing `{ code, message }` shape: `SESSION_MISSING` (no cookie), `TOKEN_INVALID` (signature or expiry), `SESSION_REVOKED` (missing record, mismatched owner, unreadable record, token without `sid`) and `SESSION_STORE_UNAVAILABLE` (the store itself failed, and the only one that also covers a failed write at sign in). Runner up: `403` for a revoked session, rejected because the client cannot retry it with a fresh cookie and the storefront handles both cases the same way.
- **Where sessions are written and deleted**: only the auth service writes them, because it is the only place that signs a token; the gateway reads them and the api deletes them on password change and account deletion, since those two routes live there. Runner up: the gateway writes the record after a successful auth proxy call, rejected because it would have to read a response body it does not own.
- **Logout is idempotent at `204`**: no cookie, an expired token and a second call all answer `204`. Runner up: `401` for a missing cookie, rejected because the storefront calls logout exactly when it is least able to handle an error.
- **How auth reads the cookie**: `cookie-parser` mounted in the auth service, then `req.cookies.__auth`, verified with the same `JWT_SECRET`. Runner up: parsing the `Cookie` header by hand, rejected because it duplicates a parser that is one dependency away.
- **Health failure is the point**: including Redis in `/health` is what turns a store outage into replicas leaving rotation instead of every request answering `401` from a healthy looking process. Runner up: leave health green and log loudly, rejected because the balancer would keep sending traffic to a replica that cannot serve it.
- **Test seams**: the gateway middleware and the auth service take the client through a small interface (`get`, `set`, `del`, `ping`), so tests pass a fake in memory instead of reaching for a container. Runner up: hit a real Redis in unit tests, rejected because the existing suites run without Docker.

## Feature design

**Data model sketch**:

| Piece | Shape |
| --- | --- |
| JWT payload | `{ userId: string, sid: string }` plus `iat` and `exp` |
| Redis key | `session:<sid>` |
| Redis value | JSON `{ "userId": string, "createdAt": string (ISO 8601), "userAgent": string \| null }` |
| Expiry | 86400 seconds, set in the writing command (`SET ... EX 86400`) |
| Secondary index | none in this spec; a `user:<id>:sessions` set is deferred to Follow-up |
| Gone from the store | token refused with `401 SESSION_REVOKED` |

**State transitions**:

```
absent --sign in / register--> live (TTL 86400)
live   --logout / password change / account delete--> absent
live   --TTL expiry--> absent
```

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
| --- | --- | --- | --- | --- | --- |
| `/api/auth/register`, `/api/auth/signin` | POST | existing DTO | `{ token, expiresIn }`, token now carries `sid`; one Redis `SET ... EX` before the answer | none | unchanged (`403` on bad credentials) |
| `/api/auth/logout` | POST | `__auth` cookie | `204`, no body | cookie, verified; missing or invalid still `204` | none in the body; a store failure is logged and still answers `204` |
| every router behind `authenticateToken` | any | `__auth` cookie | unchanged | signature plus `session:<sid>` | `401 SESSION_REVOKED`, `401 SESSION_STORE_UNAVAILABLE` |
| `/api/users/me/password` | PATCH | `oldPassword`, `newPassword` | unchanged | signature plus session | `401` as above, existing password errors unchanged |
| `/api/users/me` | DELETE | none | unchanged | signature plus session | `401` as above |
| `/health` (`api`, `auth`) | GET | none | `{ status: "ok", instance }` | none | `503` when Postgres or Redis does not answer |

**Value sourcing**:

| Action | Value produced / displayed | Source |
| --- | --- | --- |
| sign in | `sid` in the token | `crypto.randomBytes(32).toString("base64url")` at sign time |
| sign in | record expiry | fixed 86400 seconds, the same constant as the token lifetime (`expiresIn: "1d"`) |
| sign in | `userAgent` in the record | the `User-Agent` request header on the auth call, truncated to 512 |
| sign in | `createdAt` in the record | `new Date().toISOString()` at write time |
| gateway check | `userId` to compare with the record | the verified token payload (`decoded.userId`) |
| gateway check | route and method in the log line | `req.method` and `req.baseUrl + req.path` on the Express request (`req.route` is undefined in a mounted middleware) |
| gateway refusal | which of the four codes to answer | the branch taken: no cookie, failed signature, store read failure, or a record check |
| sign in, register | whether a token is issued at all | the result of the session write: a rejected write answers `503` and issues none |
| gateway refusal | `code` in the body | the branch: `SESSION_REVOKED` or `SESSION_STORE_UNAVAILABLE` |
| logout | key to delete | `sid` from the verified `__auth` cookie |
| password change, account delete | key to delete | `sid` from the verified token of the same request |
| storefront toast | the reason shown to the customer | the gateway `code` on the `401` answer |
| storefront logout | whether the remote call worked | the server action's awaited `fetch` result and its `AbortSignal.timeout(2000)` |
| storefront session end | where the handling is attached and how it runs once | a module level flag in `createAxiosInstance` (`useFetcher.ts`), reset on a successful sign in |

**Key invariants**:

- A protected handler runs only when the token's signature is valid, a record exists, and the record's `userId` equals the token's `userId`.
- The record's TTL never exceeds the token's remaining life; both start at one day at sign in.
- The gateway holds no in process session cache: every request reads the store, otherwise revocation would take effect per replica at an unpredictable moment.
- `sid` is never logged in full; log lines carry its first 8 characters.
- The same sid never appears in two records, and a re sign in always produces a new sid.
- Deleting a session is idempotent: a second delete of the same key is not an error.
- A record that cannot be parsed is treated exactly like a missing one, never like an allowed session.
- The storefront clears the cookie only on codes that mean the session is gone, never on `SESSION_STORE_UNAVAILABLE`.
- The storefront never treats a `401 SESSION_REVOKED` as a cause to retry the request blindly; it ends the session locally first.

**Security model**:

- Revocation authority belongs to the holder of the token: logout ends that one session. The same user ends their current session through a password change and through account deletion. No admin surface and no revoke another person's session in this spec.
- Redis is reachable only inside the compose network, protected by `--requirepass`, and never published. In local development the store runs without a password and listens on `localhost` only.
- A token copied before logout stops working at the next request, which is the whole point of the change; a token copied while the session is live still works, because this spec does not bind sessions to an address or a device fingerprint.
- `sid` is a bearer handle inside a signed token: it is only useful together with the token, so it carries no secret of its own. It must not be reused across users, which 32 random bytes guarantee.
- The account deletion path deletes the session before the user row, so a deleted user's token cannot outlive the deletion through a live record.

**Configuration required**:

- `REDIS_URL`: connection string for the session store, for `api` and `auth`. Compose prod value `redis://:<REDIS_PASSWORD>@redis:6379`, dev value `redis://astrum-redis:6379` inside compose or `redis://localhost:6379` outside it. Required: boot fails without it.
- `REDIS_PASSWORD`: the `--requirepass` value for the prod compose service, read from `.env.prod`. Not needed in development, where the service runs without a password.

**Critical test scenarios**:

- Happy path: sign in writes the record and the token carries `sid`; a protected call with that cookie answers `200`, verifies **AC-1**, **AC-2**.
- Revocation: logout answers `204`, then the same cookie answers `401 SESSION_REVOKED` on a second gateway instance, verifies **AC-4**, **AC-5**.
- Forgery: a valid signature whose `sid` names no record, and a record owned by another user, both answer `401 SESSION_REVOKED` without reaching a handler, verifies **AC-2**, **AC-3**.
- Store down: with the client forced to fail, a protected call answers `401 SESSION_STORE_UNAVAILABLE` and `/health` answers `503`, verifies **AC-7**, **AC-8**.
- Legacy token: a token signed without `sid` is refused, verifies **AC-10**.
- Lifetimes: a fresh sign in sets a cookie expiring one day ahead and a record expiring in 86400 seconds, verifies **AC-9**.
- Session ending on the other side of the shop: a password change and an account deletion each refuse the token they were called with, verifies **AC-6**.
- Storefront: logout with the backend unreachable still clears the cookie and lands on the sign in page; a burst of `401` answers produces one toast and one navigation, verifies **AC-11**, **AC-12**.
- Configuration: `api` and `auth` refuse to boot without `REDIS_URL`; both compose files declare the store and its health wiring, verifies **AC-13**.

## Build plan

Ordered for the project's Tracer Bullet approach: the thinnest thread that writes a session, reads it at the gateway, and revokes it runs end to end first, then the refusals, the surfaces and the health wiring thicken it.

1. Store and client in place: `redis` service in `docker-compose.prod.yml` and `astrum-redis` in `docker-compose.yml` with health checks, `REDIS_URL` in both env templates, `ioredis` in `apps/api-astrum` and `apps/auth-astrum`, one client module per app that throws at boot without the variable, satisfies **AC-13**. — done 2026-11-04: both compose files carry the service, `REDIS_URL` sits in the four env templates, `ioredis` 6.0.0 is installed in both apps, and each store module was run with `REDIS_URL` unset and threw the required message; `docker compose -f docker-compose.prod.yml config` keeps `$$REDIS_PASSWORD` for the container shell.
2. Thin thread: `sid` generated in `signToken`, `SET session:<sid> ... EX 86400` before the answer in `register` and `signin`, `JwtData` carrying `sid`, and an async `authenticateToken` that reads the record and lets a live session through, satisfies **AC-1**, **AC-2**, **AC-9**. The same task answers `503` and issues no token when the write fails, satisfies **AC-14**, and deletes the unused `updateSession` helper. — done 2026-11-04: on the dev stack a register answered with a token carrying `sid`, the record held TTL 86399 and the documented JSON, `/api/users/me` answered 200, and `updateSession` is gone.
3. Refusals in the guard: no cookie, failed signature, missing record, unreadable record, owner mismatch, token without `sid`, store failure with its own code, the four `code` values and one structured log line per branch, satisfies **AC-2**, **AC-3**, **AC-7**, **AC-10**. — done 2026-11-04: live, a token without `sid` and a token naming another user's record both answered `401 SESSION_REVOKED` while the record survived, and the log carried `session.missing reason=no_sid` and `session.identity.mismatch`; with the store stopped the answer was `401 SESSION_STORE_UNAVAILABLE` plus `session.store.error`.
4. Logout: `cookie-parser` in the auth service, `POST /api/auth/logout` with its idempotent `204`, the verified sid read from the cookie, satisfies **AC-4**, **AC-5**. — done 2026-11-04: live through the gateway proxy, logout answered 204 for a valid token, a repeat, no cookie and a garbage token; the record disappeared and the same cookie then answered `401 SESSION_REVOKED`. A second sign in of the same user kept its own record working.
5. Session ending next to the current one: revoke on `PATCH /api/users/me/password` (only on success) and on `DELETE /api/users/me`, satisfies **AC-6**. — done 2026-11-04: live, a password change and an account deletion each answered 200, refused the token they were called with, and the record was gone; a wrong old password left the session working (that path answers 500 as it did before this change).
6. Health: Redis ping added to `/health` on `api` and on `auth`, bounded by the command timeout, satisfies **AC-8**. — done 2026-11-04: with the store stopped `/health` answered 503 on both services, and 200 on both after `docker start`, with no probe hanging.
7. Storefront logout: server action that calls the gateway first with the cookie, 2000 ms timeout, deletes the cookie whatever the answer, and the hook wired to it, satisfies **AC-11**. — done 2026-11-04: `endSession` in `apps/customer/src/common/helpers/session.ts` calls the gateway with the cookie and a 2000 ms timeout, deletes the cookie whatever the answer, then redirects; `useLogOut` calls it. The browser flow is owed to `/check verify`.
8. Storefront session end: one axios response interceptor attached in `createAxiosInstance`, a module level once flag reset on a successful sign in, the cookie cleared through the existing server action on `SESSION_REVOKED`, `TOKEN_INVALID` and `SESSION_MISSING`, a retry toast on `SESSION_STORE_UNAVAILABLE`, one navigation, satisfies **AC-12**. — done 2026-11-04: the interceptor lives in `createAxiosInstance`, the once flag is module level with `resetSessionEnded` called after `createSession` in `useAuth.ts`, and the store outage path shows a warning toast without clearing the cookie. The browser burst is owed to `/check verify`.

## Consequences

**Positive**:

- Logout becomes real: a stolen or copied cookie stops working at the next request instead of surviving up to a day.
- Password change and account deletion stop leaving a working token behind.
- The session model becomes the place where a future "log out everywhere", a device list and an idle timeout can land without another redesign.
- Sessions become visible infrastructure: one key per session, one lookup per request, a `503` when the store is gone.

**Negative / tradeoffs**:

- Every protected request now costs one network round trip to Redis, roughly a fraction of a millisecond inside the compose network, but a new dependency on the path of every request.
- A Redis outage stops the whole shop instead of degrading it: requests answer `401 SESSION_STORE_UNAVAILABLE` at first, and after about 50 seconds (five probes 10 seconds apart) the replicas leave rotation and Caddy answers `502` with no code at all, so the retry toast is the last useful signal the storefront gets.
- Logging out during an outage answers `204` and revokes nothing, so that token stays usable for the rest of its day while the browser no longer holds it; accepted, and logged as `session.revoke.failed`.
- A rollout invalidates every token in the wild: all users sign in once after deploy (AC-10 accepts this on purpose).
- Sessions live one day flat, so a customer who works all day is signed out mid session with no renewal; adding a refresh belongs to a later decision.
- The storefront guard still trusts a signature it cannot revoke, so a revoked customer can see page shells until the first API call answers `401`. The data is safe, the chrome is not.

**Neutral**:

- The gateway middleware becomes asynchronous; every router behind it inherits that without changes.
- The auth service gains its first cookie parsing and its first store dependency; the api gains a store dependency and a health probe.
- `README.md` currently calls the replicas stateless, which stops being true, and the development docs need the new variable; both belong to `/document`, not to this build.
- Nothing in the database changes, so no migration and no backfill.

## Follow-up

- [ ] A `user:<id>:sessions` index, so "выйти на всех устройствах" (log out everywhere) and a device list become possible without a redesign. Deferred here because the engineer chose revocation of the current session only.
- [ ] Sliding renewal (refresh the token and the record while the customer is active), if a one day flat session turns out to annoy in practice.
- [ ] Metrics and an alert on `session.store.error` and on `/health` `503` from the replicas; today the failure is only in the logs.
- [ ] Rate limiting on `/api/auth/signin`, which becomes more attractive once sessions are revocable.
- [ ] The storefront guard could ask the gateway for the session state on navigation; deferred because it adds a hop to every render for a chrome only benefit.

## Migration plan

**Strategy**: big bang, in a fixed deploy order, with one accepted user visible effect.

**Phases**:

1. Bring the store up: deploy the compose change and `REDIS_URL` first, so the service is healthy before any code needs it.
2. Deploy `auth` with session writing and `POST /api/auth/logout`. New tokens carry `sid` and every session is written; `api` replicas still running the old guard ignore `sid` and keep accepting both new and old tokens, so nothing breaks during the window.
3. Deploy `customer` next, with the logout call and the `401` handling. It works against the old `api`, because the logout route is on `auth`, and it is what makes a refused token end the session cleanly.
4. Deploy `api` with the guard last. Once every replica runs it, tokens without `sid` are refused, and the storefront deployed in phase 3 already handles that answer: cookie cleared, one toast, sign in page. Deploying `api` before `customer` would refuse tokens to a client that has no handler yet, so the order matters.

**Rollback**: revert the `api` deploy and old tokens pass again. That rollback also re opens every session revoked during the new deploy for the rest of its day, which is a security consequence, not only a convenience: a token taken from a logged out browser works again until it expires. The store keeps collecting keys that nothing reads and their TTL removes them within a day. Reverting `auth` stops writing new sessions while records written before still expire on their own. The Redis container can stay up through either rollback because nothing else depends on it.

**Risks**:

- A mixed fleet during phase 3 means some requests are refused while others are not, which reads as flapping to one customer. Mitigated by deploying `api` in one `docker compose up -d --no-deps --scale` cycle rather than one replica at a time.
- If `REDIS_URL` is wrong in one environment, boot fails loudly rather than silently accepting tokens, which is the intended outcome but does take that service down until the value is fixed.
- A Redis restart empties the store (no persistence by decision), so every live session ends and everyone signs in again. Accepted: sessions are ephemeral, no data is lost.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
