# Context

The shop already runs as several replicas behind one balancer: three `api` processes, two `customer` processes, one `auth` process. That shape was chosen on the promise that the application layer keeps no state, and today it holds: the session is a JWT signed by `auth` with `{ userId }` and a one day expiry, the gateway verifies the signature with `jsonwebtoken`, the storefront verifies the same token with `jose`, and no process remembers anything. The cookie lives in the browser as `__auth`, `HttpOnly`, and is the only handle a request carries.

Two problems follow from that. A token cannot be taken back: logout in the storefront deletes the cookie and nothing else, so a copy of the same cookie, taken before the logout, keeps working on every replica until the token expires. And the account's own controls cannot take a session back either: a password change or an account deletion leaves the old token valid for the rest of its day, which is exactly the window an attacker who has the token wants.

There is also a smaller lie in the current code: the cookie is written with a seven day expiry while the token inside it dies after one day, so a customer is shown as signed in by the storefront guard for a moment and then bounced by the first API call.

The decision is how a session gets a server side state that all replicas agree on, without giving up the container topology the project just settled, and what the system does when that state is unavailable. Not deciding keeps the shop in a shape where "выйти" is a client side gesture.

> ⚠️ Premise note: this change puts a new component on the path of every protected request, which is a real availability trade for a shop whose replicas were stateless on purpose. A store outage will now refuse traffic (the engineer chose refusal over silently trusting signatures), and `/health` will pull replicas out of rotation rather than pretending they are ready. That is the honest reading of the same decision, but it should be an accepted cost, not a surprise: the shop's uptime now includes Redis, and the store has no persistence, so a Redis restart logs every customer out at once. The alternative framing (a revocation list that fails open) keeps more availability and loses part of the guarantee; it is recorded as Option 3 and was declined.

# Options considered

### Option 1: Shorter token, no store

Keep the session stateless and cut the token lifetime to minutes, so a copied token expires quickly on its own, with a refresh on activity to keep the customer signed in.

**Pros**:
- No new component, no new failure mode, nothing to operate.
- Replicas stay genuinely stateless, which is the property the topology was designed around.

**Cons**:
- Logout still keeps working until the shortened token dies, which is the complaint being fixed.
- A short token plus refresh means a refresh endpoint, rotation and replay handling, which is more delicate than a store and still cannot revoke on demand.
- Password change and account deletion still cannot end a session.

### Option 2: One record per session, its id inside the token (chosen)

Sign in writes `session:<sid>` with a one day expiry and puts `sid` into the JWT. The gateway verifies the signature and then reads the record; logout, password change and account deletion delete it.

**Pros**:
- Revocation is immediate and shared: one `DEL` and every replica refuses the token at its next request.
- The check is one `GET` on a key that exists or does not, so the code path has two outcomes and no reconciliation.
- The store is a plain key value with expiry, the least surprising piece of infrastructure a small team can run.
- It leaves room for a later device list or "log out everywhere" without another redesign.

**Cons**:
- Every protected request depends on Redis; the shop's availability now includes it.
- The engineer chose refusal when the store is down, so an outage stops the shop instead of degrading it.
- Sessions become ephemeral server state that a restart wipes.

### Option 3: Revocation list (denylist)

Keep the token as the only session, and write a key only when a session is revoked, so every request looks up "revoked?" instead of "session?".

**Pros**:
- Fewer writes: nothing is stored for the common case of a session that stays alive.
- Under a store failure it can fail open with a bounded exposure, because the token's own expiry still limits the damage.

**Cons**:
- Revocation only works while the denylist entry exists, so the entry must outlive the token, which means tracking expiry by hand in two places.
- The system cannot answer "which sessions are alive", so a device list or "log out everywhere" needs a redesign anyway.
- A missing entry means "allowed", so any bug in writing the key fails silently open.

### Option 4: Sessions in process, sticky at the balancer

Each replica keeps its sessions in memory and the balancer pins a customer to one replica by cookie, so no shared store is needed.

**Pros**:
- No new service, no network hop, the fastest check possible.
- Trivially deployed with the existing replicas.

**Cons**:
- Revocation only reaches the replica that holds the session, so "выход сразу на всех репликах" is impossible by construction.
- A replica restart or a rolling deploy logs out everyone pinned to it, and rebalancing moves sessions between processes.
- Caddy would need sticky routing, which the project deliberately avoided in ADR 0003.

# Rationale

The engineer's requirement is not "make logout call a service", it is "logging out ends the session on every replica". That single sentence rules out Option 4 (a pin is not a replica independent fact) and rules out Option 1 (a shorter life is not revocation). What remains is a shared store, and between the two shapes of it, Option 2 states a session positively instead of inferring it from absence. A positive record answers both questions the project will ask next, which sessions are alive and whose they are, and it fails in the safe direction: a missing key refuses, never allows. Option 3's economy buys nothing at this size, where every customer who signs in produces exactly one key, and it carries a hand maintained expiry plus a fail open default, which is the wrong bias for a security control.

The store choice itself was settled by the topology rather than by preference: the replicas already share Postgres and already reach each other through the compose network, and Redis is the plainest way to keep a value with an expiry that every process sees. Postgres was never a serious candidate for this record because a table of one day secrets would need a cleanup job and turn every request into a query on the customer database, coupling the session path to the same connections that serve orders.

Two sub decisions deserve their reasons. The engineer chose to refuse traffic when the store is unavailable rather than pass on the signature alone: the shop's whole reason for this change is that an unverifiable session should not be trusted, and a silent fallback would hand an attacker a way to get exactly the old behaviour by waiting for a Redis outage. The cost is stated in the premise note and accepted. The engineer also chose to align the cookie with the token at one day instead of lengthening the session, which removes a lie the storefront tells today and keeps the change honest; sliding renewal is recorded in Follow-up rather than built now, because every renewal is another write on the same path this spec is trying to keep to one read.

The alternatives to the claim inside the token were a second cookie and an opaque server token. A second cookie means two places that can disagree about who is signed in, and the storefront's server side guard reads the JWT today. An opaque token would retire the JWT and change the storefront guard, `proxy.ts` and the customer's local verify in the same change; it is the cleaner end state for a greenfield system and the wrong move for a working shop mid feature.

One more consequence of refusing instead of degrading had to be handled in the client, and it is worth naming here because it is the part that can go wrong quietly. A store outage and a revoked session now answer with different codes, so the storefront ends the session only when the session is really gone. Clearing the cookie on a store outage would turn a minute of Redis downtime into an unnecessary sign in for every customer, while their sessions are still alive in the store and would have come back on their own.

Shape of the work: `auth` is the only process that signs a token, so it is the only writer; the gateway is the only process that sees every protected request, so it is the only checker; the api deletes on the two routes that end an account's access, because that is where those routes live. One writer, one checker, two deleters, and a single key shape connecting them.

# Evidence

- Session issuance and token shape: `apps/auth-astrum/src/auth/auth.service.ts` (`signToken`, `expiresIn: "1d"`), `apps/auth-astrum/src/auth/auth.controller.ts` (no logout route).
- Gateway check: `apps/api-astrum/src/middlewares/authenticateToken.ts` (signature only, sets `req.userId`), `apps/api-astrum/src/common/types/jwt.payload.ts` (`userId`, `iat`, `exp`).
- Storefront side: `apps/customer/src/common/helpers/session.ts` (cookie 7 days, `jose` verify), `apps/customer/src/proxy.ts` (guard reads the cookie), `apps/customer/src/hooks/useLogOut.ts` (deletes the cookie and nothing else), `apps/customer/src/hooks/useFetcher.ts` (no `401` handling in the axios instance).
- Routes that end access: `apps/api-astrum/src/modules/user/user.routes.ts` (`PATCH /me/password`, `DELETE /me`).
- Topology and probes: `docker-compose.prod.yml` (three `api`, two `customer`, one `auth`, `GET /health` on all three), `Caddyfile` (`dynamic a` discovery), `docs/adr/0003-container-topology-and-load-balancing.md`.
- The auth proxy passes the cookie through untouched: `apps/api-astrum/src/common/helpers/proxyOptions.ts` sets `changeOrigin` and an optional `pathRewrite` and nothing else, so `POST /api/auth/logout` reaches `auth:4580/api/auth/logout` with the `Cookie` header intact and ahead of the gateway's own parser.
- `updateSession` in `apps/customer/src/common/helpers/session.ts` has no caller (a `grep` over `apps/` finds the declaration only), and it rewrites the cookie seven days ahead, so this spec deletes it rather than fixing it.
- Probe behaviour that bounds an outage: the `api` and `auth` health checks run every 10 seconds with `retries: 5`, so a replica leaves rotation about 50 seconds after the store goes away rather than on the first failure.
- Store absence confirmed: no `redis` or `ioredis` in any manifest, no `redis` service in either compose file, no `REDIS_URL` in `.env.example` or `.env.prod.example`.
