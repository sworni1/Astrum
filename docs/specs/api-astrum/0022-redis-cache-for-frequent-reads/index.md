# 0022. Redis cache for frequent reads

**Date**: 2026-11-16
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The gateway reads the same catalogue rows on every visit: one recommendations page of eight cards costs eighteen Postgres queries, because the product rows, the rating aggregate and two per card mark reads all run again. This decision puts the shared part of five reads (product detail, recommendations, category page, product reviews, shipping methods) into Redis, keyed so that any write that changes a card makes the next read fresh, and keeps the caller's own cart and wishlist marks as live queries batched to two per page instead of two per card. Every cached answer carries a lifetime, every cache read writes one log line, and a slow or broken cache falls back to the database instead of failing the screen.

## Requirements

**User stories**:

- As a customer, I want a catalogue page to answer quickly on a repeat visit, so that browsing feels instant.
- As a customer, I want the price and the stock on the screen to match what the shop will charge, so that checkout holds no surprise.
- As an engineer, I want two accounts to read one cached card and still see their own cart and wishlist marks, so that a shared cache never shows another account's state.
- As an operator, I want one log line per cache read, so that I can prove a route answered from Redis and see how long it took.

**Acceptance criteria** (the contract):

- **AC-1**: The cache lives in its own module, `apps/api-astrum/src/cache/`, mirroring `src/session/`. `cacheStore.ts` builds one `ioredis` client per process with `commandTimeout: 100`, `connectTimeout: 100`, `enableOfflineQueue: false`, `maxRetriesPerRequest: 1`, `lazyConnect: true`, a `retryStrategy` capped at 2 seconds, an `error` listener writing `{"event":"cache.connection"}` at `warn`, and a URL from `CACHE_REDIS_URL` falling back to `REDIS_URL`. `cacheKeys.ts` holds one builder per key, with two namespaces: cached payloads under `cache:v1:`, counters under `cache:meta:`. `cache.ts` exposes `getOrSet` and the invalidation calls. With `CACHE_ENABLED=false` no client is constructed and no socket is opened: after one request to each of the five routes, `docker exec astrum-redis redis-cli --scan --pattern 'cache:*' | wc -l` answers `0`.
- **AC-2**: `GET /api/products/:productId` serves the product row from `cache:v1:product:<id>:v<ver>`, where `<ver>` is the value of `cache:meta:ver:product:<id>` and `0` when that key is absent, written with `SET ... EX` and a lifetime of `60 + Math.floor(Math.random() * 7)` seconds, so `redis-cli ttl` prints an integer from 60 through 66. Two identical requests answer byte identical bodies (`diff` of the two saved bodies is empty) and the second writes one `{"event":"cache.read","hit":true}` line. Only a fetched row is cached: an unknown id answers its `404` as today and writes no key.
- **AC-3**: The caller's marks stay live and per account. Two signed in accounts request the same product: the one holding it in the wishlist reads `isWishlisted: true`, the other reads `false`, both from that one cache entry. `quantityInCart` follows each account's own cart line, and `reviewState` each account's own delivered lines. No cache key and no cached value carries an account id: `docker exec astrum-redis redis-cli --scan --pattern 'cache:*'` prints keys that carry no account uuid, and `grep -c` over the values of those keys answers `0` for each test account id.
- **AC-4**: The mark reads are batched on the list path. `getRecommendations`, and therefore `getCategoryProducts`, reads the page's cart lines and wishlist lines in two queries in total, never two per card. A jest suite with a call counting Prisma double asserts exactly 4 queries for a page of 8 on a miss (product page, rating aggregate, cart batch, wishlist batch) and exactly 2 on a hit (the same two batches). `getProduct` keeps its two `findUnique` calls, one per table, which are already two queries and are not a loop.
- **AC-5**: `GET /api/products/:productId/reviews` serves `cache:v1:reviews:<productId>:v<rev>:<limit>:<after>` with a lifetime of `60 + Math.floor(Math.random() * 7)` seconds, where `<rev>` is the value of `cache:meta:ver:reviews:<productId>` and `0` when absent, and where `<limit>` is the value the service clamps through its own `parseLimit` (20 by default, 50 at most) rather than the raw query string, so two different raw values that clamp to one page share one key. A hit answers the same body as the miss and costs no Postgres query at all; the miss costs 5 when `after` is present (cursor check, page, count, average, distribution) and 4 when it is absent. The cursor check runs only on a miss, because a key exists only for a cursor that already passed it.
- **AC-6**: `GET /api/shipping-methods` serves `cache:v1:shipping` with a lifetime of `30 + Math.floor(Math.random() * 4)` seconds. The second request is a hit, and `methods` still answers the same rows through `toShippingMethodListJson`, so `price` stays a number.
- **AC-7**: Every write that changes a cached answer makes the next read show the new value. The proof pairs, run on the dev stack:
  - (a) a created order decrements `quantity` and sets `isOutOfStock`: the next `GET /api/products/:id` answers the decremented quantity and `cache:meta:ver:product:<id>` has grown by one per line of the order;
  - (b) a stock return of any kind grows the same counter: the customer cancel through `PATCH /api/orders/:orderId/status`, the staff cancels `PATCH /api/staff/point/orders/:orderId/cancel` and `PATCH /api/staff/courier/orders/:orderId/cancel`, and the expiry cancel of the payment paths, all of which reach `returnOrderStock` (`apps/api-astrum/src/modules/order/order-status.helpers.ts:51`) through `closeOrder` or `cancelOrderLines`; the next read answers the returned quantity;
  - (c) a created review changes the card: the next recommendations read answers the new `averageRating` and `reviewCount`, and `cache:meta:epoch:lists` has grown by one;
  - (d) a like, an unlike, a comment and a comment deletion each grow `cache:meta:ver:reviews:<productId>`, which requires the two guards of the module (`requireApprovedReview`, `requireReview`) to return the review's `productId` beside its `id`, because those writes carry a review id only;
  - (e) `POST /api/products` grows `cache:meta:epoch:lists`.
- **AC-8**: A cache that fails never fails a read and never fails a write. With `CACHE_REDIS_URL=redis://127.0.0.1:6390`, all five routes answer `200` with the same bodies they answer with the cache up, a created order still answers its `201` or `200`, and the log carries one `{"event":"cache.error"}` at `warn` per failed cache operation plus one `{"event":"cache.invalidate.error"}` at `warn` per failed invalidation. No request answers `500` because of the cache.
- **AC-9**: A slow cache costs at most one tenth of a second. The client carries `commandTimeout: 100` and `connectTimeout: 100` (asserted by a suite that reads the options off the built client), and a suite whose store never settles proves the route answers from Postgres after that budget rejects instead of waiting on the cache.
- **AC-10**: Every cached payload expires. After one request to each of the five routes, `for k in $(docker exec astrum-redis redis-cli --scan --pattern 'cache:v1:*'); do docker exec astrum-redis redis-cli ttl "$k"; done` prints only integers from 30 through 66, and the count of `-1` among them is `0`. The counters under `cache:meta:` are the exception and answer `-1` on purpose: they must outlive every payload key that names them.
- **AC-11**: Every cache read writes exactly one line through `logger.info`, shaped `{"level":"info","time":"<iso>","event":"cache.read","key":"<key>","hit":true|false,"ms":<integer>}`, with the epoch key added as its own `"epochKey"` field on a list read, because a list read reads two keys. `docker logs astrum-api 2>&1 | grep -c '"event":"cache.read"'` grows by one per route read, and `grep '"event":"cache.read"' | grep -c '"hit":true'` grows on the second pass over each route.
- **AC-12**: Nothing on the wire changes. The five routes answer the same status codes, the same fields and the same JSON types as before: a cached `createdAt` reaches JSON as the same ISO string it reaches today, a shipping `price` stays the number `toMoney` produces, and the storefront types need no edit. `pnpm --filter @astrum/api test`, `pnpm --filter @astrum/customer test` and `pnpm check-types` are green, and `git status --short apps/customer/src` lists no changed file.
- **AC-13**: The configuration is wired and documented. `CACHE_ENABLED`, `CACHE_LIST_TTL_SECONDS`, `CACHE_PRODUCT_TTL_SECONDS` and `CACHE_REDIS_URL` are present in `apps/api-astrum/.env.example`, in the root `.env.example`, and in `.env.prod.example`, which the api service already reads through `env_file: .env.prod`; the service block needs no `environment:` entry. Each variable falls back to `true`, `30`, `60` and `REDIS_URL` when missing, and `docker compose -f docker-compose.prod.yml --env-file .env.prod config --quiet` exits `0`.
- **AC-14**: The plan stays honest. `docs/scope/api-astrum/scope.md` feature 1 carries the corrected `Done when:` line (the shared part from Redis, the marks at two queries per page, a refusal only on a slow or broken cache, invalidation on the writers that exist today), its `Design it (spec)` box is ticked with the path to this spec, and `docs/scope/index.md` still maps the workspace as `0 done / 1 planned`.

## Decision

**Chosen option**: Option 3: cache the shared catalogue answers in Redis, version every key, keep the caller's marks live and batched.

The five read routes keep their contract exactly. What they read differently is where the shared part comes from: Redis when a fresh key exists, Postgres otherwise, and the caller's own marks always from Postgres in two batched queries. Every payload key carries a version taken from a counter that the writes bump, so an invalidation never has to find a key: the next read asks a different key, and the old one dies by its lifetime.

**Implementation skills**: none consulted. The gateway follows `apps/api-astrum/AGENTS.md` (one folder per module, `__tests__/` beside the module, `constants/` for literals, the single `logger` helper).

## Feature design

**Cache key model** (the data model of this decision). Cached payloads live under `cache:v1:` and always carry a lifetime; the three counters live under `cache:meta:`, carry no lifetime, and exist only to make a payload key unreachable:

| Route | Key | Lifetime | Invalidated by |
|---|---|---|---|
| `GET /api/products/:id` | `cache:v1:product:<id>:v<ver>`, `<ver>` from `cache:meta:ver:product:<id>` | 60 through 66 s | `INCR cache:meta:ver:product:<id>` |
| `GET /api/products/recommendations` | `cache:v1:lists:<epoch>:recs:<sha256(cursor)>` | 30 through 33 s | `INCR cache:meta:epoch:lists` |
| `GET /api/products/categories/:c` | `cache:v1:lists:<epoch>:cat:<c>:<sha256(search_query + cursor)>` | 30 through 33 s | `INCR cache:meta:epoch:lists` |
| `GET /api/products/:id/reviews` | `cache:v1:reviews:<id>:v<rev>:<limit>:<after>`, `<limit>` clamped | 60 through 66 s | `INCR cache:meta:ver:reviews:<id>` |
| `GET /api/shipping-methods` | `cache:v1:shipping` | 30 through 33 s | lifetime only |

**Cache value shape**, one JSON string per payload key, holding the shared part only:

| Route | Value |
|---|---|
| product detail | the `productPublicSelect` row, before the marks and `reviewState` are merged |
| recommendations, category | `{ products: [...preview row with averageRating and reviewCount], nextCursor, hasNextPage }`, the cursor of the page included because it belongs to the page and not to the caller |
| reviews | `{ reviews, nextCursor, hasNextPage, aggregate }` |
| shipping | `{ methods: [...] }` through `toShippingMethodListJson` |

**Invalidation matrix** (each call runs after the commit, in one pipelined batch, with no retry; a failure writes one `warn` line and the data lives until its lifetime):

| Writer that exists today | Bumps |
|---|---|
| `ProductService.createProduct` | `cache:meta:epoch:lists` |
| order creation, stock decrement inside the order transaction | `cache:meta:epoch:lists` plus `cache:meta:ver:product:<id>` per line |
| every stock return, all through `returnOrderStock`: the customer cancel through `closeOrder`, the staff point and courier cancels through `cancelOrderLines`, the expiry cancel of the payment paths | `cache:meta:epoch:lists` plus `cache:meta:ver:product:<id>` per line |
| `ReviewsService.createReview` | `cache:meta:epoch:lists` plus `cache:meta:ver:reviews:<productId>` |
| like and unlike | `cache:meta:ver:reviews:<productId>` of the review |
| comment creation and deletion | `cache:meta:ver:reviews:<productId>` of the review |
| shipping methods | no writer route exists, lifetime is the only bound |

**API surface**: unchanged. All five routes keep their method, path, inputs, outputs, status codes and the `authenticateToken` mount. No route is added and none is removed.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| every cached read | the shared payload | the same Prisma select and serializer that build it today, serialized once with `JSON.stringify` |
| every cached read | payload key | the builders of `cacheKeys.ts` over route params, the clamped `limit`, the cursor, and a `sha256` (16 hex characters) of the search string |
| every cached read | version or epoch | `GET` on the matching `cache:meta:` counter, `0` when absent |
| every cached read | `hit` and `ms` | measured in `getOrSet` with `Date.now()` around the Redis call |
| every cached read | lifetime | `CACHE_LIST_TTL_SECONDS` (default 30) or `CACHE_PRODUCT_TTL_SECONDS` (default 60), plus `Math.floor(Math.random() * 4)` or `Math.floor(Math.random() * 7)` seconds |
| product detail, list page | `isWishlisted`, `quantityInCart` | `WishlistItem` and `CartItem` rows of the caller, two batched `findMany` calls |
| product detail | `reviewState` | `readReviewState(userId, productId)`, unchanged |
| invalidation | version and epoch numbers | `INCR` on the writer's own counter, after the commit |
| like, unlike, comment, comment deletion | the product whose reviews version to bump | the `productId` the widened `requireReview` and `requireApprovedReview` return beside the review id |

**Key invariants**:

1. No cache key and no cached value carries an account id or any per caller field.
2. Every payload key carries a lifetime above zero; no payload key is written without one. The counters are the single exception and are permanent on purpose.
3. A cache operation never throws into a request handler or into a write path: every call catches, logs at `warn`, and falls through to Postgres.
4. Invalidation runs after the commit, never inside the Postgres transaction.
5. `CACHE_ENABLED=false` means no client and no socket, not a cache that reads and skips the write.
6. A hit and a miss produce the same bytes.
7. No read issues a query per card: the marks come from two batched queries per page.
8. Only a row that was fetched is cached; a not found answer writes no key, so a missing product never becomes a cached absence.

**Security model**: the five routes keep `authenticateToken`, so every read still requires a session in Redis. The cache holds catalogue data only: no account row, no cart row, no session record. Keys carry product ids, category names, review ids, cursors, and a digest of the search string, so the search text never reaches Redis in clear and its length never reaches the key. The log line carries the key, the hit flag and the duration, never an account id. The cache client uses `CACHE_REDIS_URL`, which falls back to `REDIS_URL` and therefore to the same password the sessions use.

**Configuration required**:

- `CACHE_ENABLED`: `false` turns every cache read and write off and opens no cache connection (default `true`).
- `CACHE_LIST_TTL_SECONDS`: base lifetime of the two list keys (default `30`).
- `CACHE_PRODUCT_TTL_SECONDS`: base lifetime of the product and reviews keys (default `60`).
- `CACHE_REDIS_URL`: the cache connection, falling back to `REDIS_URL`; a separate value is what makes the failure criterion provable on a live stack without stopping the session store (default `REDIS_URL`).

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: a page of 8 recommendations answers 18 Postgres queries before the change and 4 on a miss and 2 on a hit after it, with the same body, verifies **AC-4**, **AC-12**.
- Stale by write: an order is created for a product, the detail route answers the decremented quantity, the order is then cancelled by the customer and, in a second run, by a point worker, and each next read answers the returned quantity, verifies **AC-7**.
- Two accounts, one cached card: each reads its own `isWishlisted`, `quantityInCart` and `reviewState` from one key, verifies **AC-3**.
- Cache down: `CACHE_REDIS_URL` points at a closed port, every route still answers `200`, and a write still commits while the log shows `cache.error` and `cache.invalidate.error`, verifies **AC-8**, **AC-9**.
- Cache off: `CACHE_ENABLED=false` leaves Redis without a single `cache:` key after a pass over all five routes, verifies **AC-1**.

## Build plan

Ordered as Tracer Bullet: the first slice carries one route end to end through the cache, and the following slices add one route family at a time. The mark batching lands before any list is cached, because a cached page that still issues two queries per card would answer a hit with sixteen queries and buy almost nothing.

1. Build the cache module and its configuration: `src/cache/cacheStore.ts` (lazy client, bounded timeouts, capped retry, the `cache.connection` warning), `src/cache/cacheKeys.ts` (the two namespaces), `src/cache/cache.ts` (`getOrSet`, the jitter draw, the `cache.read` and `cache.error` lines, the invalidation batch with `cache.invalidate.error`). Add the four variables to `apps/api-astrum/.env.example`, the root `.env.example` and `.env.prod.example`. Close the client in the `SIGTERM` path of `src/server.ts`. Satisfies **AC-1**, **AC-13**.
2. Carry the reviews route end to end first, because it depends on nothing per caller: cache the page and the aggregate under the per product review version, and bump it from `createReview`, `likeReview`, `unlikeReview`, `createReviewComment` and `deleteReviewComment`, which means widening `requireReview` and `requireApprovedReview` to return the review's `productId`. Prove a miss, a hit, a lifetime and an invalidation on the live stack. Satisfies **AC-5**, **AC-7** (d), **AC-10**, **AC-11**.
3. Add the shipping route, which has no writer and lifetimes only. Satisfies **AC-6**.
4. Batch the caller's marks on the list path: replace the two calls inside the per card loop of `getRecommendations` with one `CartItem` and one `WishlistItem` query per page, and write the read path suite for it. `getProduct` keeps its two `findUnique` calls, which are not a loop and need no change. Satisfies **AC-3**, **AC-4**.
5. Cache the two list routes under the catalogue epoch, merge the batched marks after the parse, and bump the epoch from `createProduct`. Satisfies **AC-2** for the shared half, **AC-7** (e), **AC-12**.
6. Cache the product detail under its per product version, merge the marks and `reviewState` after the parse. Satisfies **AC-2**, **AC-7** (a).
7. Bump the per product version from every stock writer: order creation, and each of the four paths that reach `returnOrderStock`, which is the customer cancel, the staff point cancel, the staff courier cancel and the expiry cancel of the payment layer. Satisfies **AC-7** (a), **AC-7** (b).
8. Add the failure suite: a store that rejects, a store that never settles, a write whose invalidation fails, and `CACHE_ENABLED=false`. Satisfies **AC-8**, **AC-9**, **AC-1**.
9. Run the gates, walk the five routes on the dev stack, and correct the scope row and its `Done when:` line. Satisfies **AC-12**, **AC-14**.

## Consequences

**Positive**:

- A recommendations page drops from 18 Postgres queries to 4 on a miss and 2 on a hit, and the batched marks alone remove the per card query pattern.
- A reviews page and a shipping read answer with no Postgres query at all on a hit.
- Every payload key has a named bound on its staleness, and every read is traceable in one log line.
- The routes keep their contract, so the storefront is untouched.

**Negative / tradeoffs**:

- The detail route saves one query on a hit (5 down to 4), because the marks and `reviewState` stay live, and it pays one extra Redis round trip for the version. Its win is the payload assembly, not the round trips.
- A list page can be up to 33 seconds old and a detail page up to 66 when a write lands between a read and its population, so a changed price is visible to a browsing customer with that delay.
- Every order bumps the catalogue epoch, so all list pages go cold after each order. At the current volume that is invisible, at a few hundred orders a minute the list cache would never warm and the family has to split.
- A failed invalidation after the commit leaves stale data until the lifetime runs out, and only a `warn` line records it.
- One more Redis client per process, so three replicas hold three cache connections beside their session ones.
- `search_query` is hashed to 16 hex characters, so two different searches whose digests collide share a key; with 64 bits and a 33 second lifetime the risk is not worth a longer key.
- The counters are permanent keys, a few thousand at most for 4752 products, and a flushed Redis restarts them at zero, which only makes keys that are already gone unreachable.

**Neutral**:

- No schema change, no migration, no storefront change, no new route.
- The production Redis runs without persistence (`--save "" --appendonly no`) and without `--maxmemory`, so a restart empties the cache and costs one cold pass, and nothing evicts payload keys early: their lifetimes are what bounds the footprint.
- The payload lifetime keeps the footprint to a few megabytes against a catalogue of 4752 rows of about 706 bytes.

## Migration plan

**Strategy**: no migration needed. The schema and the seeded data stay as they are, and the change is deployed with the code: `CACHE_ENABLED=false` on the first rollout answers exactly what the service answers today, and turning it on is one variable.

## Follow-up

- [ ] No route updates or deletes a product today. When one lands it must bump `cache:meta:epoch:lists` and `INCR cache:meta:ver:product:<id>`; the matrix in this spec is the list it has to join.
- [ ] No route writes shipping methods today. An admin route must `DEL cache:v1:shipping` in the same pass.
- [ ] Split `cache:meta:epoch:lists` into per family epochs if order volume stops the list cache from warming between writes.
- [ ] `Product.stars` stays as spec 0021 left it: the card reads the live aggregate and no writer maintains the column. This spec does not change that.
- [ ] The cache stores fetched rows, so a product that leaves the catalogue by a direct database edit stays visible until its lifetime ends; a delete route would close that, and none exists.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
