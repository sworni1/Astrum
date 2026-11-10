# 2026-11-04 · Idempotent checkout and cart clearing

Spec: [0003-idempotent-checkout-and-cart-clearing](../specs/_root/0003-idempotent-checkout-and-cart-clearing/index.md).

Before this change a second click on Place order, or a retry after a timeout, created a twin order, and the bought lines stayed in the cart because only the storefront reloaded it. The checkout now carries a client generated key, and the gateway answers a repeat from the first order.

## Added

- `Order.idempotencyKey` and `Order.idempotencyHash` (`VARCHAR(64)`) plus the unique index `Order_userId_idempotencyKey_key`, in `packages/Astrum-db/prisma/migrations/20261104150202_order_idempotency/migration.sql`. Both columns are nullable, so an order created without a key keeps `NULL` and the index leaves it alone.
- `apps/api-astrum/src/modules/order/idempotency.ts`: `readIdempotencyKey` validates the optional `Idempotency-Key` header (8 to 128 characters from `[A-Za-z0-9_-]`, otherwise `422` with `property: "Idempotency-Key"`), `attachIdempotencyKey` mounts it as middleware, `canonicalOrderBody` renders the fingerprint input (fixed key order, lines sorted by `productId`, `deliveryDate` parsed and then emitted as ISO, so a `+03:00` body and the same instant in `Z` hash alike) and `idempotencyOf` hashes it with sha256.
- `IDEMPOTENCY_KEY_REUSED` in `order.constants.ts`, answered as `409` when a key comes back with another body. `REPLAY_ATTEMPTS` (3) and `REPLAY_RETRY_DELAY_MS` (100) bound the repeat read after a keyed failure.
- `apps/customer/src/hooks/order/idempotency.ts`: `createIdempotencyKey` renders 16 bytes from `crypto.getRandomValues` as 32 hex characters, and `isTerminalAnswer` decides when a key is spent.

## Changed

- `POST /api/orders` answers `201` for a new order and `200` with `Idempotent-Replay: true` for a replay. The route runs `attachIdempotencyKey` after `requireActiveAccount` and before `validateDto`, so a malformed key is refused before any cart or stock read.
- `OrderService.createOrder` returns `{ order, replay }`. `buildOrder` reads `(userId, idempotencyKey)` first, inside the transaction, and answers from that row. A keyed failure reads the key again on the plain database client, three times 100 ms apart before the refusal leaves the gateway, because the loser of a race is refused by the stock or the cart check before it ever reaches the unique index.
- `OrderService.clearCart` runs inside the order transaction, after `tx.order.create`: a `CartItem` at or below the ordered quantity is deleted, a larger one is decreased by exactly the ordered quantity, and a row another request already removed is logged as `cart.clear.skipped` with the order id and the product id. Any other database error inside the clear aborts the whole transaction, so no order, no stock change and no cart change survive. Both statements are conditional, so a row another request changed touches zero rows instead of being written from a stale read.
- `order.mapper.ts` drops `idempotencyKey` and `idempotencyHash` before every order answer, so the internal key never reaches a client.
- `corsOptions.ts` allows the `Idempotency-Key` request header and exposes `Idempotent-Replay`.
- `useCheckout` holds the key in a ref for the whole attempt, sends it on every `POST`, discards it after any `2xx` or any other `4xx`, keeps it after a network error, a timeout or a `5xx`, and treats `200` like `201`: the cart and the orders are revalidated and the customer lands on the order screen. `postItem` in `useFetcher` now takes an optional headers argument.

## Verified

- `pnpm quality-gate` on 2026-11-10: 18 of 18 tasks successful, exit 0. Customer lint reports 0 errors and 8 warnings, all of them there before this change (`react-hooks/set-state-in-effect`).
- Gateway package on the same run: 124 tests passed and 10 skipped, 20 of 22 suites. The two skipped suites are the database backed ones, which only run with `ORDER_DB_TESTS=1`.
- `pnpm --filter @astrum/api test -- idempotency order.mapper order.controller`: 20 tests in 3 suites. `pnpm --filter @astrum/customer test src/hooks/order/idempotency.test.ts`: 5 tests. The customer package overall is 93 tests in 22 files.
- The live walk of 2026-11-04 is recorded in the spec's `verify.md`: 19 command steps against `pnpm dev` with a real customer and a real shipping method. A repeat answered `200` with `Idempotent-Replay: true` and the same id while the database held one row; another body under the same key answered `409`; the offset form of the date replayed instead of conflicting; a parallel pair on the index path and another on the stock refusal path each produced one order with both callers on it; a partial order left 3 of 5 in the cart; a refused order stored no key; a cancelled order replayed as `CANCELED`; the preflight named both headers; the database suite (71 tests with `ORDER_DB_TESTS=1`) covered the cart race and the rollback.

## Open

- The five storefront steps of `AC-10` rest on the owner's confirmation on 2026-11-04, not on an automated run: the shipping method `Select` does not open under synthetic or CDP input, so the form cannot be driven headlessly. The client helpers are under vitest; the form is not. `verify.md` still closes with a paragraph saying those steps owe a human run, which contradicts the section header above it and the scope row.
- `canonicalOrderBody` lists the order fields by hand, so a new order field has to join it in the same change, otherwise two different bodies fingerprint alike. The spec's `Follow up` keeps this open for the shipping price fields and the pickup point.
- `apps/customer/src/hooks/order/useCreateOrder.ts` still exists, is used by no page and sends no key, so two order create hooks sit side by side.
- The storefront axios timeout is 10000 ms while the server transaction budget allows up to 15000 ms, so the client can give up while the order is still committing. The key makes that retry safe; the timeout itself is unchanged.
- Idempotency keys are kept forever: no expiry, no cleanup job.
