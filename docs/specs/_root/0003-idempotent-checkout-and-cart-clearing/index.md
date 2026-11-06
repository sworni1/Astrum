---

id: 0003
slug: idempotent-checkout-and-cart-clearing
status: Accepted
adrs: []
date: 2026-11-04
---

# Idempotent checkout and cart clearing

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

A second click on Place order, or a retry after a timeout, can create two identical orders today, and the cart is never emptied on the server: the storefront only reloads it, so the same lines sit there after a successful checkout. This spec gives the checkout an idempotency key (a client generated identifier sent in the `Idempotency-Key` request header) which is stored on the order together with a fingerprint (a hash of the order fields), so a repeat returns the first order instead of creating a twin. The ordered lines also leave the cart inside the same database transaction that takes the stock, while lines the customer did not select stay where they are.

## Requirements

**User stories**:

- As a customer, I want a second click or a retry after a timeout to end on the same order, so that I am never charged twice for one purchase.
- As a customer, I want the products I just bought to disappear from my cart, so that the cart reflects what is left to buy.
- As a customer, I want the rest of my cart untouched, so that starting a new order does not cost me the lines I did not select.

**Acceptance criteria**:

- **AC-1**: `POST /api/orders` accepts an optional `Idempotency-Key` request header, valid when it is 8 to 128 characters from `[A-Za-z0-9_-]`. With the header, the created `Order` stores the value in `idempotencyKey` and the sha256 hex digest of the canonical request body in `idempotencyHash`, both written in the same statement that creates the order. Without the header the request behaves exactly as in spec 0001: `201`, both columns `NULL`, no replay check.
- **AC-2**: a resubmission with the same key and the same canonical body answers `200` with the first order body (same `id`, `status`, `totalPrice`, `currency` and lines) plus the response header `Idempotent-Replay: true`; it creates no second `Order` and no `OrderItem`, takes no stock, and clears no cart line a second time.
- **AC-3**: the same key with a different canonical body answers `409` with `{ "code": "IDEMPOTENCY_KEY_REUSED", "message": "..." }` and writes nothing: no order row, no stock change, the cart exactly as it was. The same answer holds when the second request races the first, because every path that finds the key compares the fingerprint.
- **AC-4**: a key shorter than 8 characters, longer than 128, or holding a character outside `[A-Za-z0-9_-]` answers `422` with `{ "code": "VALIDATION", "message": "...", "errors": [{ "property": "Idempotency-Key", ... }] }` before any cart or stock read.
- **AC-5**: on a successful create the ordered lines leave the cart in the same transaction that takes the stock: a `CartItem` whose `quantity` is at or below the ordered quantity is deleted, a row holding more than the ordered quantity is decreased by exactly the ordered quantity and stays, and a `CartItem` of a product the order does not name is untouched. A refused order leaves the cart exactly as it was.
- **AC-6**: two requests with the same key sent at the same time produce exactly one `Order`, one set of `OrderItem` rows and one stock deduction, and both callers end on that order. A racing request can be refused before it ever reaches the unique index, because its conditional stock update blocks on the winner's row and then touches zero rows, so any refusal and any transaction error raised while a key is present first re-reads `(userId, idempotencyKey)` on the plain database client, up to three times 100 ms apart. A row with the same fingerprint answers `200` with `Idempotent-Replay: true`, a row with a different fingerprint answers `409`, and only when no order exists under the key does the original refusal stand.
- **AC-7**: a repeat whose first order is already `CANCELED` (spec 0002) answers `200` with that order as it stands today, `status` included, and writes nothing.
- **AC-8**: when a cart row of an ordered product is deleted by another request before the clear runs, the clear touches zero rows for it: the order still commits, every remaining cart row keeps the value the customer set, and the skipped clear is logged as `cart.clear.skipped` with the order id and the product id. Any other database error inside the clear aborts the whole transaction, so no order, no stock change and no cart change survive, and the client may retry under the same key.
- **AC-9**: the key is scoped to its user through `@@unique([userId, idempotencyKey])`, so two customers who happen to send the same key each create their own order, and no request can read, replay or learn about another customer's order through a key.
- **AC-10**: the storefront sends `Idempotency-Key` on every checkout `POST`, generated from 16 random bytes as hex. It sends the same key again after a network error, a client timeout or a `5xx`, discards it after any `2xx` or any other `4xx`, and treats a `200` replay exactly like a `201`: success toast and navigation to the order screen. On a `409` it shows the server message and submits nothing further by itself, because a fresh key would silently create a second order.
- **AC-11**: the gateway CORS options allow the `Idempotency-Key` request header and expose `Idempotent-Replay`, so a call from the allowed development origin passes its preflight and the browser can read the replay header.
- **AC-12**: neither `idempotencyKey` nor `idempotencyHash` appears in any order JSON answer (create, replay, list, detail): `order.mapper.ts` drops both before serialising, since it spreads the whole row.

## Decision

**Chosen option**: Option 1: the key lives on the order, the cart clears inside the order transaction.

The `Order` row carries `idempotencyKey` plus `idempotencyHash`, guarded by a unique index on `(userId, idempotencyKey)`. A repeated request is answered from that row on three separate paths, and the ordered cart lines are deleted or decreased inside the same transaction that takes the stock.

**Implementation skills**: none consulted (no community skill is installed for this stack).

Decisions taken here rather than asked (each with the runner up):

- **Fingerprint column**: `idempotencyHash String?` holding a sha256 hex digest, `@db.VarChar(64)`. Runner up: `@db.Char(64)`, rejected because a fixed width column pads with spaces and compares space insensitive; storing no hash at all was declined by the engineer in favour of a loud `409`.
- **Fingerprint input**: a canonical JSON of the validated DTO after `mergeOrderLines`, with keys in a fixed order, lines sorted by `productId`, and `deliveryDate` normalised through `new Date(dto.deliveryDate).toISOString()`. The DTO carries no `@Type(() => Date)`, so the value is a string at runtime and calling `toISOString` on it directly would throw; parsing it makes an offset (`+03:00`) and a `Z` body hash alike, and a malformed value is already refused by `@IsDateString`. Extra fields such as a tampered `price` are stripped by the DTO, so they neither change the fingerprint nor read as a different body. Runner up: hash the raw bytes, rejected because a reordered JSON body would read as a different order.
- **Replay detection**: three paths, one answer. A `findFirst` on `(userId, idempotencyKey)` at the start of the transaction (fast path, Read Committed, so it cannot see an uncommitted winner); the unique index violation, which arrives only after the winner commits, re-read on the plain client outside the aborted transaction; and the refusal path, where a stock or cart shortfall under a key re-reads the key before the refusal leaves the gateway, because the loser of a race blocks on the winner's product row and never reaches the insert. Every path compares the fingerprint. Runner up: rely on the index alone, rejected because the loser can be refused before the insert and the client would then retry with a fresh key and create a twin.
- **Bounded re-read**: three attempts 100 ms apart, then the original refusal is rethrown. A re-read that finds the order but cannot use it is logged as `order.replay.miss`, and only that case answers `500`. Runner up: unbounded retry, rejected because it holds a database connection per duplicate.
- **Prisma error mapping**: `P2002` on the `(userId, idempotencyKey)` target is the index violation; a unique violation on any other target, `P2028` (transaction timeout) and `P2034` fall through to the bounded re-read. Runner up: treat every `P2002` as a replay, rejected because a violation on another unique index would be answered as a successful order.
- **Mapper**: `toOrderJson` and `toOrderListJson` drop `idempotencyKey` and `idempotencyHash`, since both spread the whole row. Runner up: leave them in, rejected because an internal key in every order answer is one a client could replay from.
- **Cart clear failure**: a zero row result is logged and the order commits; any other database error inside the clear aborts the transaction, so the customer gets a `500` and retries under the same key, which is safe now. Runner up: swallow the error, rejected because the transaction is already aborted at that point and swallowing it would surface as a phantom success.
- **Where the replay flag surfaces**: `OrderService.createOrder` returns `{ order, replay }` and the controller answers `200` or `201` and sets the header. Runner up: a thrown "already created" carrier, rejected because it turns the second most common answer into an exception path.
- **Header reading and validation**: a small `readIdempotencyKey(headers)` helper in `apps/api-astrum/src/modules/order/idempotency.ts` called from the route after `authenticateToken`, raising `AppError(422, VALIDATION, ..., { property: "Idempotency-Key" })`. Runner up: a DTO field, rejected because `validateDto` reads the body, never the headers.
- **Cart decrease**: `deleteMany` where `quantity <= ordered`, then, when that touches nothing, `updateMany` where `quantity >= ordered` with a `decrement`, both under `(userId, productId)`. Two conditional statements touch zero rows instead of writing a wrong number when another request changed the row. Runner up: read the row then write the new value, rejected because that writes from a stale read.
- **Where the clear runs**: inside `buildOrder`, after `tx.order.create`, so the order, the stock and the cart are one commit. Runner up: a second transaction after the commit, rejected because a failure there leaves the cart dirty with no rollback.
- **Retention**: keys live on their order forever, no expiry and no cleanup job. Runner up: a TTL column plus a scheduled cleanup, rejected because the repo has no job runner and the `Order` table is small.
- **Client key generation**: 16 bytes from `crypto.getRandomValues` rendered as 32 hex characters. Runner up: `crypto.randomUUID()`, rejected because it is undefined outside a secure context, and the demo stack can be plain HTTP.
- **Client key lifetime**: kept in a `useRef` inside `useCheckout`, discarded after any `2xx` or any terminal `4xx`, kept after a network error, a timeout or a `5xx`. Runner up: one key per form opening, rejected because editing the address after a refusal would then answer `409`, and keeping it after success would make a genuine second purchase replay the first.
- **Client on `409`**: show the server message, no automatic resubmit and no silent new key. Runner up: resubmit with a fresh key, rejected because there is no lookup by key and that would create a second order the customer never asked for.
- **Unique index versus NOT NULL**: both columns nullable, because the header is optional and Postgres treats `NULL` values as distinct in a unique index. Runner up: a required column with a default, rejected because it rewrites every historical order and breaks every client that sends no header.
- **Index keep**: the existing `@@index([userId])` stays even though the unique index leads with `userId`. Runner up: drop it, rejected because the migration would touch an index other reads rely on for no measurable gain at this size.

## Feature design

**Data model sketch**:

| Entity     | Field                                | Type                        | Rule                                                                                             |
| ---------- | ------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------ |
| `Order`    | `idempotencyKey`                     | `String?`                   | the `Idempotency-Key` of the request that created it; `NULL` when the request carried none       |
| `Order`    | `idempotencyHash`                    | `String?` `@db.VarChar(64)` | sha256 hex of the canonical request body; `NULL` when there is no key                            |
| `Order`    | `@@unique([userId, idempotencyKey])` | index                       | one order per customer per key; `NULL` rows are distinct, so orders without a key are unaffected |
| `CartItem` | unchanged                            |                             | read, then deleted or decreased inside the order transaction                                     |

No new table, no new relation. The migration is one file and adds two nullable columns plus one unique index.

**State transitions** (a checkout request):

| State    | How it is entered                                                   | Answer                                             |
| -------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| fresh    | no row for `(userId, key)`, or no key at all                        | `201` with the new order                           |
| replay   | a row exists on any path and the fingerprint matches                | `200` with that order, `Idempotent-Replay: true`   |
| conflict | a row exists and the fingerprint differs                            | `409` `IDEMPOTENCY_KEY_REUSED`, nothing written    |
| refused  | any order rule from spec 0001 fails and no row exists under the key | the spec 0001 code, nothing written, no key stored |

**API surface**:

| Endpoint      | Method | Key inputs                                                                     | Key outputs                                                     | Auth            | Key errors                                                                                                                                                         |
| ------------- | ------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/orders` | POST   | header `Idempotency-Key`: string (optional); body `CreateOrderDto` (unchanged) | `201` new order, or `200` replay with `Idempotent-Replay: true` | `__auth` cookie | `409` `IDEMPOTENCY_KEY_REUSED`, `422` `VALIDATION`, plus the spec 0001 codes (`OUT_OF_STOCK`, `CART_MISMATCH`, `MIXED_CURRENCY`, `UNKNOWN_SHIPPING_METHOD`, `404`) |

**Value sourcing**:

| Action                 | Value produced / displayed               | Source                                                                                                        |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| create, new order      | stored key                               | the `Idempotency-Key` request header, validated by `readIdempotencyKey`                                       |
| create, new order      | stored fingerprint                       | derived: sha256 of the canonical JSON of the validated DTO after `mergeOrderLines`                            |
| create, canonical body | the normalised delivery date             | derived: `new Date(dto.deliveryDate).toISOString()`, because the DTO holds a string at runtime                |
| create, new order      | order id, status, total, currency, lines | the `Order` and `OrderItem` rows written in the transaction (spec 0001)                                       |
| create, any answer     | the order answered                       | the `Order` row found by `(userId, idempotencyKey)`                                                           |
| create, keyed refusal  | whether the refusal is really a replay   | the `Order` row re-read by `(userId, idempotencyKey)` on the plain client, three attempts 100 ms apart (AC-6) |
| create, replay         | the `Idempotent-Replay` header           | derived: the `replay` flag returned by `OrderService.createOrder`                                             |
| create, replay         | the screen the customer lands on         | the replay body `id`, read by `useCheckout`                                                                   |
| create, success        | which cart rows to delete or decrease    | the `CartItem` rows read inside the transaction plus the merged ordered quantities                            |
| create, out of stock   | remaining availability                   | re-read after the rollback (`outOfStockError`, spec 0001)                                                     |
| every order answer     | which columns reach JSON                 | `order.mapper.ts`, which drops `idempotencyKey` and `idempotencyHash` (AC-12)                                 |
| storefront             | the key sent                             | `useCheckout`, 16 random bytes as hex, held in a ref until a terminal answer                                  |

**Key invariants**:

- At most one `Order` per `(userId, idempotencyKey)`, enforced by the database index.
- The key and the fingerprint are written by the same statement that creates the order, so a refused order leaves no key behind and can be retried.
- Stock, order and cart change commit or roll back together.
- A cart row is deleted or decreased by an amount derived from the ordered quantity, never set from a value read before a possible race.
- A keyed refusal is resolved against the key before it leaves the gateway, so a race cannot answer a refusal to the customer whose order just committed.
- `Idempotent-Replay` appears only on a `200` replay, and `idempotencyKey` and `idempotencyHash` never appear in an answer at all.

**Security model**:

- The caller identity comes from the `__auth` cookie through `authenticateToken`, unchanged by this feature.
- A key is scoped to its user, so a leaked key can neither read nor replay another customer's order (AC-9).
- No endpoint lists or looks up keys; a replay is reachable only by sending the same key again.
- The fingerprint is a one way digest of order fields, no secret and no personal data beyond what the order already stores, and it never leaves the gateway (AC-12).

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: a create with a key writes the key and the fingerprint, answers `201`, and the ordered cart line disappears, verifies **AC-1**, **AC-5**
- Replay: the same key and body twice, the second answers `200`, `Idempotent-Replay: true`, the same `id`, one order row in the database, verifies **AC-2**
- Conflict: the same key with another address answers `409` `IDEMPOTENCY_KEY_REUSED` and writes nothing, verifies **AC-3**
- Validation: a 3 character key and a key with a space each answer `422` with `property: "Idempotency-Key"`, verifies **AC-4**
- Concurrency, index path: two creates with one key against a stock of one unit sent in parallel, one order row, one stock deduction, and the loser answers `200` with the winner's order rather than a refusal, verifies **AC-6**
- Concurrency, refusal path: the same test with the loser reaching the stock check first, proving the keyed re-read turns its shortfall into the winner's order, verifies **AC-6**
- Concurrency, conflict: the same key with two different bodies in parallel, one `201` and one `409`, one order, verifies **AC-3**
- Partial cart: a cart holding 5 with an order of 2 leaves 3 in the cart, and an unselected product stays in the cart, verifies **AC-5**
- Refusal: an out of stock order with a key leaves the cart and the stock untouched and stores no key, verifies **AC-5**
- Cart race: the cart row deleted between the read and the clear, the order commits and `cart.clear.skipped` is logged, verifies **AC-8**
- Cart failure: a database error injected into the clear leaves no order, no stock change and no cart change, verifies **AC-8**
- Cancel then repeat: cancel the order, send the same key again, `200` with `CANCELED`, verifies **AC-7**
- Isolation: the same key from another user answers `201` with that user's own order, verifies **AC-9**
- No leak: the create, replay, list and detail answers carry neither new column, verifies **AC-12**
- Storefront: a rejected request then an edited address sends a new key; a timeout retry sends the same key; a success discards it, verifies **AC-10**
- Preflight: `OPTIONS /api/orders` from the allowed origin names `Idempotency-Key` in `Access-Control-Allow-Headers`, verifies **AC-11**

## Build plan

Tracer Bullet: the first two tasks stand up the thin end to end thread (a header that reaches the database and comes back as a replay), then the cart clear, the storefront and the tests thicken it. Each task ships green on its own.

1. Migration and schema: two nullable columns and the unique index on `Order` in `packages/Astrum-db/prisma/schema.prisma`, the same file copied byte for byte to `apps/api-astrum/prisma/schema.prisma`, `pnpm db:generate`, one migration from the repo root; satisfies **AC-1** — done in `packages/Astrum-db/prisma/migrations/20261104150202_order_idempotency`, applied and confirmed live
2. Gateway idempotency core: `order.constants.ts` gains `IDEMPOTENCY_REUSED`, `idempotency.ts` gains `readIdempotencyKey` and `canonicalOrderBody` (with the parsed delivery date), `order.routes.ts` calls the reader after `authenticateToken`, `order.service.ts` writes the key and the fingerprint, adds the fast path read, the index violation fallback with the fingerprint compare and the bounded re-read on a keyed refusal, `order.mapper.ts` drops both columns, `order.controller.ts` answers `200` or `201` and sets the header; satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-6**, **AC-7**, **AC-9**, **AC-12** — done: `idempotency.ts` (reader, fingerprint, header middleware), the three replay paths in `order.service.ts`, `200`/`201` plus `Idempotent-Replay` in the controller, both columns dropped in `order.mapper.ts`; proved on the live database (repeat returns the first order, one row, stock taken once, `409` on another body)
3. Cart clearing: `assertInCart` returns the rows it read, `buildOrder` deletes or decreases them after the order insert, the zero row case logs `cart.clear.skipped`, any other error aborts the transaction; satisfies **AC-5**, **AC-8** — done: `clearCart` inside the order transaction, the skipped case logged with the order id and product id, proved by three database specs
4. CORS: `corsOptions.ts` allows `Idempotency-Key` and exposes `Idempotent-Replay`; satisfies **AC-11** — done: the preflight on the live gateway lists both headers
5. Storefront: `postItem` takes an optional headers argument, `useCheckout` generates and holds the key in a ref, discards it after a `2xx` or a terminal `4xx`, sends it on every attempt, treats `200` and `201` alike and leaves a `409` to the customer; satisfies **AC-10** — done: the key helpers sit in `apps/customer/src/hooks/order/idempotency.ts` under vitest, and the five UI steps were confirmed on the running stack by the owner
6. Tests: unit specs for `readIdempotencyKey` and `canonicalOrderBody` (including two equivalent date offsets), service specs for the replay, conflict and keyed refusal branches, mapper specs for the dropped columns, and database backed specs for the parallel pair and the cart clear behind `ORDER_DB_TESTS=1`; satisfies **AC-1** to **AC-9**, **AC-12** — done: 71 tests in the api package with `ORDER_DB_TESTS=1`, 10 in the customer package
7. Docs: `verify.md` walked against the running stack, `docs/DEVELOPMENT.md` gains the header contract; satisfies **AC-10**, **AC-11** — done: the contract is in `docs/DEVELOPMENT.md`, `verify.md` carries the run log of 19 command steps plus the five UI steps confirmed by the owner

## Consequences

**Positive**:

- A double click, a retried timeout or a refresh mid submit can no longer produce a twin order, because the second request is answered from the first on every path, including the race that fails the stock check.
- The cart finally matches reality after checkout: bought lines leave it on the server, and the storefront reload only reflects the truth.
- The cart clear cannot leave the cart and the stock disagreeing, because both are one commit.
- A key reused with another body is refused loudly instead of silently returning a stranger's order.

**Negative / tradeoffs**:

- Every keyed refusal now costs an extra read on the plain client (three in the worst case), paid only on the unhappy path, in exchange for never answering a refusal to the customer whose order just committed.
- A customer who edits the checkout form after an ambiguous timeout keeps the old key from the client, so the edit cannot be sent under that key; the client gets `409` and must submit again with a new one. One extra click in a rare path.
- A replay returns the order in its current state, not the state at creation (its lines may already be `CANCELLED` from spec 0002), so nobody may assume the replay body is byte identical to the first answer.
- The gateway now writes two extra columns on every order and maintains a unique index, which costs a little write time and disk on the `Order` table.
- The optional header means a client that never sends one keeps today's exposure: no keys, no protection. Only the shipped storefront and future clients that send it are covered.
- The fingerprint set is duplicated knowledge: a new order field must be added to `canonicalOrderBody`, or two genuinely different orders will read as the same body.

**Neutral**:

- One migration, additive and nullable, safe to run before the deploy.
- The storefront's `useCreateOrder` hook stays untouched and still sends no key; it is not on the checkout path.
- No new environment variable, no new service, no new dependency.

## Follow-up

- [ ] `/check review`: the fingerprint input is the one place this feature can rot. When feature 3 adds shipping price fields or feature 7 adds a pickup point, add them to `canonicalOrderBody` in the same change, and add a test that two bodies differing only in the new field answer `409`.
- [ ] `apps/customer/src/hooks/order/useCreateOrder.ts` is not used by any page and does not send the key. Decide whether to delete it or to route the checkout through it, so two order create hooks stop existing side by side.
- [ ] A cleanup of old idempotency keys is not needed now. Revisit if the `Order` table grows large enough that the unique index hurts writes, or if a customer can reach an old order with a recycled key.
- [ ] The storefront axios timeout is 10000 ms while the server transaction budget is `maxWait` 5000 plus `timeout` 10000 (spec 0001). The client therefore gives up exactly while the server may still be committing, which is the very case this feature has to absorb. Raise the client timeout above the server budget (or lower the server budget) in a separate change, so a slow but healthy checkout is not reported as a network failure.
- [ ] The storefront checkout has no test harness (no React testing library in the package, see spec 0001). AC-10 is verified by hand in `verify.md` until feature 9 brings the end to end test.

## Rationale

Reasoning, options and the code survey: see [rationale.md](rationale.md).

## Migration plan

**Strategy**: big bang within one deployment (additive and nullable, no data transformation)

**Phases**:

1. Apply the migration: two `NULL`able columns and the unique index on `Order`. Existing rows keep `NULL` and are unaffected, since Postgres treats `NULL` values as distinct.
2. Deploy the gateway and the storefront together. The gateway accepts the header before the storefront sends it, so the order of the two deploys is safe either way.
3. Verify with `verify.md`, then close the scope row.

**Rollback**: revert the deploy. The two columns and the index are unused by the old code and harmless, so no down migration is needed to restore service; a later migration can drop them.

**Risks**: the schema lives in two copies (`packages/Astrum-db/prisma/schema.prisma` and `apps/api-astrum/prisma/schema.prisma`), and a drifted copy surfaces as a compile error on a field name, so edit the package copy first and copy it over. A migration applied before the code deploy leaves two unused columns, which costs nothing. A storefront deployed first would send a header a gateway ignores, which is also harmless.
