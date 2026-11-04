# Rationale: Idempotent checkout and cart clearing

_Decision record for [spec 0003](index.md). `/develop` skips this file; a human or a later `/architect` reads it._

## Context

> ⚠️ Premise note: the twin order is not caused by the server alone. The storefront HTTP client gives up after 10000 ms, while the server transaction is allowed `maxWait` 5000 plus `timeout` 10000 (spec 0001). The client therefore abandons a checkout exactly when the server may still be committing, so a retry is unavoidable rather than rare. An idempotency key makes that retry safe, which is what this spec delivers, but the timeout budget itself should be aligned in a separate change (recorded in Follow-up). The right framing is: make the retry safe now, stop provoking the retry next.

The order path was rebuilt in spec 0001: the server decides price, stock and total, and writes the whole order in one transaction behind a conditional stock update. What that spec left open is the identity of a checkout attempt. Nothing on the request says "this is the same attempt I already sent", so the server has no way to tell a deliberate second order from a duplicated submission.

The storefront submits checkout through `useCheckout` (`apps/customer/src/hooks/order/useCheckout.ts`), which posts to `/api-gateway/orders`, then reloads `/cart` and `/orders`. The cart, however, is never changed: `CartItem` rows survive a successful checkout, and the reload simply re-reads them. So the scope row's phrasing "the cart is only cleared in the browser" is optimistic; in the current code nothing clears it at all, and a customer who returns to `/cart` finds the products they just bought.

Three forces shape the decision:

- **The write moves money and stock.** A duplicate order is not a cosmetic bug: it reserves stock a second time and, once payments exist, would charge twice. The feature carries the `GA` tag for that reason.
- **The gateway runs as three replicas behind a load balancer** (`docker-compose.prod.yml`), so any in-process memory of "attempts I have seen" is useless: the retry lands on another replica.
- **The order write is already one transaction with a fixed check precedence** (visibility and stock, then cart, then currency, then shipping method). The cart clear belongs inside that same transaction, or the two can disagree.

The consequence of not deciding: a second click or a retry after a timeout keeps producing twin orders, and the cart keeps advertising products that are already bought.

## Options considered

### Option 1: the key lives on the order, the cart clears inside the order transaction

`Order` gains `idempotencyKey` and `idempotencyHash`, unique per `(userId, idempotencyKey)`. A repeat is recognised by that row: the same fingerprint answers the existing order, a different one is refused. The ordered cart lines are deleted or decreased after the order insert, inside the same transaction.

**Pros**:
- One row of truth: the key exists exactly when an order exists, so a refused attempt leaves no state to expire.
- The index is the concurrency guard, with no extra table, no status column and no cleanup job.
- The cart cannot disagree with the stock, because both change in one commit.

**Cons**:
- The `Order` table carries two columns that only the checkout reads.
- A key cannot record an attempt that is still in flight, so the concurrent case is resolved by waiting on the index rather than by a status row.
- The fingerprint must be maintained by hand as order fields grow.

### Option 2: a separate `IdempotencyKey` table with a status

A dedicated table holds the key, the user, a status (`in_progress`, `completed`), the response body, a created time and a TTL.

**Pros**:
- Can hold an attempt before an order exists, so a concurrent duplicate can be told "in progress" instead of waiting.
- Generalises to other endpoints and to providers that need a stored response body.
- Cleanup by TTL is natural.

**Cons**:
- Two states to keep consistent (the key row and the order row) and a job that must clean the abandoned `in_progress` rows.
- On this stack it buys nothing today: the only duplicate risk is the order create, which the unique index already resolves.
- More code, more failure modes, for a feature with no external provider yet.

### Option 3: no key, deduplicate on the request body

Hash the body with the user id and refuse a create whose hash matches an order made in the last few minutes.

**Pros**:
- No client change at all, nothing for the storefront to send.

**Cons**:
- Refuses a legitimate second order of the same products, which is a normal thing to buy twice.
- No way to tell a retry from a new purchase, so the rule is either too loose or too strict.
- A time window is an arbitrary number nobody can defend.

### Option 4: keep the client responsible

Disable the submit button while the request runs, delete the cart lines from the browser after success, and accept the remaining risk.

**Pros**:
- Smallest change, no schema work.

**Cons**:
- A timeout, a closed tab or a refresh all defeat it; the server still creates the twin.
- A browser side cart clear fails silently on a dropped connection, which is the exact state this feature exists to remove.
- Nothing proves anything to a tester or a reviewer.

## Rationale

Option 1 wins on the forces that matter here. The unit of identity is the checkout attempt, and an attempt that succeeded has an order, so storing the key on that order makes the state impossible to desynchronise: there is no second row to expire, and a refused attempt (out of stock, cart mismatch) leaves nothing behind, which is exactly what a customer needs in order to fix the line and submit again with the same key.

Option 2 is the right shape once a payment provider with its own retries enters the picture, because then an attempt exists before an order does. Today it would be machinery without a consumer, and the repository has no scheduler to clean abandoned rows. Option 3 fails the "buy the same thing twice" case outright. Option 4 leaves the server unprotected, which the `GA` tag rules out.

The concurrent case is settled by the database rather than by application logic: `@@unique([userId, idempotencyKey])` makes Postgres block the second insert until the winner commits, so the loser's index violation arrives precisely when the winner's row is visible. The loser's own stock changes roll back with its aborted transaction. That is why the fallback re-read runs on the plain client outside the transaction, the same pattern `outOfStockError` already uses after a rollback. The fast path read at the start of the transaction is an optimisation, not the guarantee.

An independent read of the first draft of this spec found that the index alone is not enough, and it was right. When the last unit of stock is the contested row, the loser blocks on the winner's product update, not on the index: after the winner commits, its conditional `updateMany` re-evaluates, touches zero rows, and the service raises `OUT_OF_STOCK` before it ever attempts the order insert. That answer is worse than useless, because the storefront treats a refusal as terminal, discards its key, and a retry then creates the twin this feature exists to prevent. So the key is consulted on the refusal path too: any refusal or transaction error raised while a key is present re-reads `(userId, idempotencyKey)` on the plain client, compares the fingerprint, and answers the replay or the conflict instead. Three paths, one answer, and the fingerprint check is carried by every one of them, otherwise a racing request with other goods would receive an order it never sent.

The same read caught three smaller defects that the build would otherwise have inherited: `deliveryDate` is a string at runtime (the DTO has no `@Type(() => Date)`), so the fingerprint must parse it rather than call `toISOString` on it; `order.mapper.ts` spreads the whole row, so both new columns would have leaked into every order answer; and the client must discard its key after a success, or a genuine second purchase from the same page would replay the first.

Clearing the cart inside the same transaction is the only version that keeps the invariant "the customer owns what the order took": both statements commit or neither does. Decreasing rather than deleting a row is the version that never destroys units the customer did not order, and two conditional statements (`deleteMany` where `quantity <= ordered`, then `updateMany` with a `decrement` where `quantity >= ordered`) touch zero rows instead of writing a wrong number when another request changed the row in between.

Leaving the header optional is a deliberate trade: it keeps the contract backwards compatible for a cached storefront bundle during a deploy and for the curl steps in spec 0001's `verify.md`, and it costs only the protection a client that never sends a key would have had anyway.

## Code survey

Read before writing this spec (source file count 232 TypeScript files):

- `apps/api-astrum/src/modules/order/order.service.ts`: `createOrder` merges lines, runs one transaction (`maxWait` 5000, `timeout` 10000, Read Committed, no retry), `buildOrder` reads products and the cart inside it (`assertInCart`), then takes stock conditionally and inserts the order with its lines.
- `apps/api-astrum/src/modules/order/order.routes.ts`: `authenticateToken`, then `validateDto(CreateOrderDto, { status: 422, code: VALIDATION })`. No header handling anywhere.
- `apps/api-astrum/src/middlewares/validateDto.ts`: reads `req.body` only, and already accepts an optional status and machine code, so the header needs its own reader.
- `apps/api-astrum/src/common/helpers/errorHandler.ts` and `appError.ts`: one `AppError` carrier mapped to its own status and code, everything else `500`.
- `apps/api-astrum/src/modules/order/order.controller.ts` and `order.mapper.ts`: the controller answers `201` on create and the mapper turns `Decimal` into a number.
- `apps/api-astrum/src/modules/cart/cart.service.ts`: cart rows are only created, changed and deleted by the cart routes; nothing in the order path touches `CartItem` after the read.
- `apps/customer/src/hooks/order/useCheckout.ts`: posts the order, then `mutate("/cart")` and `mutate("/orders")`, which re-read and never delete.
- `apps/customer/src/hooks/useFetcher.ts`: a shared axios instance, `withCredentials`, 10000 ms timeout, `postItem` takes no headers.
- `apps/api-astrum/src/middlewares/corsOptions.ts`: `allowedHeaders` names three headers only, so a custom header fails the dev preflight.
- `packages/Astrum-db/prisma/schema.prisma`: `Order`, `OrderItem` and `CartItem` as used above; `apps/api-astrum/prisma/schema.prisma` is byte identical today and must stay so.
