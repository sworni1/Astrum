---

id: 0001
slug: order-price-and-stock
status: In Progress
adrs: []
date: 2026-11-04
---

# Order price and stock decided by the server

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

Today the checkout form decides what a product costs and how many are left: it sends the price and the name, and the gateway stores them as received. This spec moves both decisions to the server, which reads the product, checks the cart and the stock, and writes the whole order in one transaction, so a line can never carry a made up price and two buyers cannot buy the same last unit. Money fields become exact decimals instead of floating point numbers, and the order screen is refused for anyone but its owner.

## Requirements

**User stories**:

- As a customer, I want the price I see in the cart to be the price of the order, so that a stale tab cannot change what I pay.
- As a shop, I want stock to be checked and taken at the moment of the order, so that two customers never buy the same unit.
- As a customer, I want a clear message when an item ran out, so that I know which line to fix instead of guessing.

**Acceptance criteria**:

- **AC-1**: `POST /api/orders` accepts a line with only `productId` and `quantity`. Any `price`, `name` or `previewImage` in the body is dropped by the DTO, and the saved `OrderItem` carries `price` equal to `Product.price` rounded to two decimals at the time of the order, plus the product's `name` and `previewImage`.
- **AC-2**: `Order.totalPrice` equals the sum of the rounded unit price times quantity over the saved lines, computed with `Prisma.Decimal` (no JavaScript floating point) and stored with two decimals in the order currency; every saved line carries its own `currency`, copied from the product.
- **AC-3**: each ordered product's `quantity` drops by the ordered amount inside the same transaction that creates the order, and `isOutOfStock` becomes `true` when the remaining stock reaches zero.
- **AC-4**: when any line asks for more than the available stock, the whole order is refused with `409` and body `{ "code": "OUT_OF_STOCK", "message": "...", "items": [{ "productId", "requested", "available" }] }`, where `message` names the product and reads well in a toast, and `available` is re-read after the refusal so it is never the stale value from before the race. No order row, no line and no stock change remain afterwards.
- **AC-5**: a product that is deleted, not `Published`, not `Public`, or whose available stock is zero (`quantity` is zero or `isOutOfStock` is set) is refused in the same `409` shape with the same item list, so a customer never learns which of several checks failed.
- **AC-6**: a line whose product is not in the caller's cart, or asks for more than the cart holds, is refused with `409`, code `CART_MISMATCH` and a `message`, and the cart stays as it was. The cart rows are read inside the same transaction that takes the stock.
- **AC-7**: `quantity` is an integer from 1 to 999 per line and at most 50 lines are accepted; repeated `productId` values are merged in the service after validation, and a merged quantity above 999 or a list that shrinks to zero lines is refused with `422` and code `VALIDATION`.
- **AC-8**: `GET /api/orders/:orderId` answers `404` (raised as `AppError`, not as a generic bad request) for an order that belongs to another user or does not exist, and the order list still returns only the caller's orders.
- **AC-9**: a successful create answers `201` with the order including `id`, `status`, `totalPrice`, `currency` and its lines; money reaches JSON as a number with at most two decimals in all three order handlers (create, list, detail).
- **AC-10**: an unknown `shippingMethodId` is refused with `409` and code `UNKNOWN_SHIPPING_METHOD` before any stock is taken, because an order cannot be priced without its delivery method.

## Decision

**Chosen option**: Option 2: Server reads everything, writes in one transaction.

The server owns price, name, stock and totals; the browser sends which products and how many. The write is one transaction guarded by a conditional stock update, and money moves to exact decimals.

**Implementation skills**: none consulted (no community skill is installed for this stack).

Decisions taken here rather than asked (each with the runner up):

- **Error carrier**: a small `AppError` (status code, machine code, message, optional details) raised in the service and mapped by `handleErrors`; any other thrown value answers `500`, so a Prisma timeout or a foreign key failure stops looking like a bad request. Runner up: keep string messages and parse them in the controller, rejected because the storefront must tell stock from cart mismatch and a server fault must not read as a client fault.
- **Validation status**: `validateDto` gains an optional status argument and an optional machine code, defaulting to today's `400` with `{ errors }`, so only the order route answers `422` with `code: "VALIDATION"`. Runner up: fork the middleware for orders, rejected because two copies drift.
- **Cart mismatch code**: `409` with `CART_MISMATCH` instead of `422`, so the checkout form keeps one branch for "your cart moved" and one for "not enough stock". Runner up: `422`, rejected because nothing about the request syntax is wrong.
- **Check precedence**: visibility and stock, then cart, then currency, then shipping method. The first failing check decides the code, so the same broken line always reports the same thing. Runner up: any failing check wins, rejected because the reported code would depend on query order.
- **Money in JSON**: `totalPrice` and `price` are converted from `Decimal` to a number with at most two decimals in all three handlers. Runner up: send strings, safer for later money math, rejected because the storefront types and the order screen compare numbers today; feature 8 should revisit it.
- **Order currency**: taken from the products; lines with different currencies are refused with `409`, code `MIXED_CURRENCY` and body `{ "code", "message", "productIds": [...] }`. Runner up: allow mixed and sum blindly, rejected because a total in two currencies is a wrong number.
- **Product query shape**: one `findMany` with `id: { in: ids }` and a select limited to the fields the order needs, using the transaction client. Runner up: query per line, rejected at 50 lines per order.
- **Transaction settings**: an explicit interactive transaction with `maxWait` 5000 and `timeout` 10000, Read Committed isolation, and no retry loop; a timeout surfaces as `500` and the customer retries by hand. Runner up: defaults plus automatic retry, rejected because a retried checkout must be idempotent first, which is feature 2.
- **Out of stock flag**: the refusal check reads `quantity`, and `isOutOfStock` is a derived flag set to `true` when stock reaches zero. Raising stock later, through a restock or a returned line, clears it; that path belongs to feature 4 and is recorded in Follow-up.
- **Storefront transport**: `useFetcher` keeps throwing, but the checkout hook reads `error.response.data` for `code` and `message` and revalidates `/cart` and `/orders` on failure, so a stale cart cannot repeat the same refusal silently. Runner up: wrap every call in a typed error layer now, rejected as a cross cutting change out of this feature.
- **Indexes**: `Order.userId` and `OrderItem.orderId`; `productId` gets no index because no read in this spec filters by it.
- **Observability**: one structured log line per refused order (user id, code, product ids) and one per created order (order id, line count, total). Runner up: nothing, rejected because a stock refusal is the signal a shop owner needs.

## Feature design

**Data model sketch**:

| Entity      | Field                  | Type                        | Rule                                                                  |
| ----------- | ---------------------- | --------------------------- | --------------------------------------------------------------------- |
| `Order`     | `totalPrice`           | `Decimal @db.Decimal(10,2)` | sum of lines, delivery added by feature 3                             |
| `Order`     | `currency`             | `Currency`, required        | backfilled, then copied from the lines; no default left in the schema |
| `Order`     | `userId`               | index (new)                 | the order list and the owner check read it                            |
| `OrderItem` | `price`                | `Decimal @db.Decimal(10,2)` | `Product.price` rounded to two decimals, per unit                     |
| `OrderItem` | `currency`             | `Currency`, required        | backfilled, then copied from the product                              |
| `OrderItem` | `orderId`              | index (new)                 | every read of a line goes through the order                           |
| `OrderItem` | `productId`            | no foreign key, no index    | deliberate snapshot; the product may be deleted later                 |
| `OrderItem` | `userId`               | `String`, required          | kept from today's schema and written by the service                   |
| `OrderItem` | `name`, `previewImage` | `String`, required          | written by the server, never by the client                            |

`Product.discount` is a display fraction of the old price (`(oldPrice - price) / oldPrice`) and is never subtracted from `Product.price`, so the line price is exactly `Product.price`. `Product.sales` is not touched in this feature; the counter stays where it is until stock and status work settles.

**State transitions**: none in this spec. An order is created `PENDING` with `PENDING` lines, and transitions belong to feature 4.

**API surface**:

| Endpoint               | Method | Key inputs                                                                                                                                                                     | Key outputs                                       | Auth                         | Key errors                                                                                                                              |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/orders`          | POST   | `orderItems[]` of `{productId, quantity}` (req, 1..50), `deliveryAddress` (req), `deliveryDate` (req), `shippingMethodId` (req), `paymentMethod` (req), `paymentDetails` (req) | `201` with order, lines, `totalPrice`, `currency` | `__auth` cookie              | `409 OUT_OF_STOCK`, `409 CART_MISMATCH`, `409 MIXED_CURRENCY`, `409 UNKNOWN_SHIPPING_METHOD`, `422 VALIDATION`, `500` on a server fault |
| `/api/orders`          | GET    | none                                                                                                                                                                           | `200` with orders, money as numbers               | `__auth` cookie, caller only | `500`                                                                                                                                   |
| `/api/orders/:orderId` | GET    | `orderId` (req)                                                                                                                                                                | `200` with order and lines, or `404`              | `__auth` cookie, owner only  | `404` for missing or foreign, `500`                                                                                                     |

**Value sourcing**:

| Action       | Value produced / displayed        | Source                                                                                            |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| create order | line `price`                      | `Product.price` rounded to two decimals with `Prisma.Decimal`, read inside the transaction        |
| create order | line `name`, `previewImage`       | `Product.name`, `Product.previewImage`                                                            |
| create order | line `currency`, order `currency` | `Product.currency`, all lines must agree                                                          |
| create order | line `quantity`                   | request `orderItems[].quantity`, merged by product in the service after validation, capped at 999 |
| create order | `totalPrice`                      | `sum(unitPrice * quantity)` in `Prisma.Decimal`, delivery excluded until feature 3                |
| create order | remaining stock                   | `Product.quantity` minus the ordered amount, written by the conditional update                    |
| create order | `isOutOfStock`                    | `true` when the remaining stock is zero                                                           |
| create order | `userId` on order and lines       | `req.userId` set by `authenticateToken`                                                           |
| create order | cart quantity per product         | `cartItem.findMany` read with the transaction client                                              |
| refuse order | `items[].requested`               | the merged line                                                                                   |
| refuse order | `items[].available`               | re-read of the failed products after the rollback, never the pre-race value                       |
| refuse order | `code`, `message`                 | the `AppError` raised in the service, mapped by `handleErrors`                                    |
| refuse order | `productIds` on `MIXED_CURRENCY`  | the products whose currency differs from the first line                                           |
| read order   | owner decision                    | `Order.userId` compared with `req.userId`                                                         |
| read order   | money in JSON                     | `Decimal` converted to a number with at most two decimals in every handler                        |

**Key invariants**:

- An order's total equals the sum of its lines at all times.
- A line's price and currency never change after the order is created.
- Stock plus the sum of the ordered quantities of a product never exceeds what the product had before the order.
- A stock change and its order exist in the same transaction or neither exists.
- The cart read and the stock write happen inside one transaction, so the cart check cannot race the decrement.
- A caller reads only orders where `Order.userId` equals `req.userId`.
- The first failing check decides the error code, in the fixed precedence order.

**Security model**: every order route sits behind `authenticateToken`, so `userId` comes from the JWT cookie and never from the body. Read access is owner only, orders are never public. Validation rejects non public products, which also blocks ordering a draft or deleted item by id. No new PII is stored; no compliance scope (PCI and payment providers arrive in a later feature).

**Critical test scenarios**:

- Happy path: two lines, one product with stock 5, order for 3, order created, stock 2, total is `unitPrice * 3 + unitPrice2 * qty2`, verifies **AC-1**, **AC-2**, **AC-3**.
- Tampered body: the same request with `price: 1` and `name: "lol"` saved as the real product price and name, verifies **AC-1**.
- Failure case: 20 parallel requests for a product with stock 5, exactly 5 units ordered in total, stock never negative, every extra request answers `409` with a fresh `available`, verifies **AC-3**, **AC-4**.
- Failure case: order for 3 while the cart holds 2, `409 CART_MISMATCH`, cart unchanged, verifies **AC-6**.
- Failure case: line with `quantity: 0`, a list of 51 lines, and two lines of 600 for one product, all `422 VALIDATION`, verifies **AC-7**.
- Failure case: unknown `shippingMethodId`, `409 UNKNOWN_SHIPPING_METHOD`, stock unchanged, verifies **AC-10**.
- Failure case: a database failure inside the transaction answers `500` and leaves no order, verifies **AC-8** through the error mapping.
- Auth/permission: another user's `GET /api/orders/:id` answers `404`, verifies **AC-8**.

## Build plan

Tracer Bullet: the thin thread is one real order created end to end with a server price and a taken stock, then each guard thickens around it. Steps 1 and 2 make the thread possible, steps 3 to 6 harden it, step 7 carries it to the storefront.

1. Migration: `totalPrice` and `price` to `numeric(10,2)`, add `currency` to `Order` and `OrderItem` as nullable, backfill both from the related product in SQL, set them required and drop the default, add indexes on `Order.userId` and `OrderItem.orderId`, run `pnpm db:generate`, satisfies **AC-2**.
2. Narrow the DTOs: `OrderItemDto` keeps only `productId` and `quantity` with integer bounds, `CreateOrderDto` gets array size bounds, and `validateDto` gains the optional status and code so this route answers `422 VALIDATION`, satisfies **AC-1**, **AC-7**.
3. `AppError` in the API common helpers plus `handleErrors` mapping status, code, message and details, with any other thrown value answering `500`, satisfies **AC-4**, **AC-5**, **AC-6**, **AC-8**.
4. Rewrite `OrderService.createOrder`: load products with one transactional `findMany`, check the shipping method, visibility and stock, read the cart with the transaction client, merge repeated products, compute prices and currency with `Prisma.Decimal`, take stock with the conditional `updateMany`, write the order and lines inside `prisma.$transaction` with the explicit `maxWait` and `timeout`, and re-read availability on refusal, satisfies **AC-1** to **AC-6**, **AC-10**.
5. Owner check in `getOrderById`, `AppError(404)` for a missing or foreign order, and controller mapping of `Decimal` to numbers in all three handlers, `201` on create, satisfies **AC-8**, **AC-9**.
6. Unit and API tests: happy path, tampered body, 20 parallel requests on a stock of 5, cart mismatch, limits and merged quantities, unknown shipping method, foreign order read, database failure mapping, satisfies **AC-1** to **AC-10**.
7. Storefront: `useCheckout` sends `productId` and `quantity` only, reads `code` and `message` from `error.response.data`, shows the message in the toast, and revalidates `/cart` and `/orders` on failure as well as on success, satisfies **AC-1**, **AC-4**, **AC-6**.

## Consequences

**Positive**:
- The browser can no longer set a price, a name or a stock number.
- Stock and order agree or neither exists, including under two simultaneous buyers.
- Money in the order is exact and carries its currency, so payment can be built on it.
- A server fault now reads as `500` instead of pretending the client sent something wrong.

**Negative / tradeoffs**:
- Seven files move at once (schema, migration, DTO, validation middleware, error helper, service, controller, storefront hook), so the change cannot ship half done.
- JSON money becomes a number again at the edge, so a later payment feature should revisit returning strings.
- `Product.price` stays `Float`; a product and its order can disagree in the fourth decimal until the catalogue money type is unified.
- Until feature 2 clears the cart on the server, the same cart lines can be ordered twice in two separate submissions. The stock check still holds, so the damage is a duplicate order the customer cancels by hand, not an oversold product. This window is accepted on purpose to keep one feature one change.

**Neutral**:
- One migration runs before the API starts in the compose stack; demo orders are backfilled from their products rather than blindly set to `RUB`.
- The checkout form still adds a hardcoded delivery price on top of the server total, so the visible total and `Order.totalPrice` differ until feature 3 lands.
- The order route answers `422` while the rest of the API answers `400`; the difference is intentional and lives in one shared middleware.

## Migration plan

**Strategy**: no migration needed beyond one schema migration, the stack deploys together and the database holds demo data.
**Phases**:
1. Apply the migration: add the currency columns nullable, backfill from the related product, set them required, drop any default, change the two money columns to `numeric(10,2)`, add the indexes.
2. Deploy the API and the storefront together (the DTO and the hook are one contract), then regenerate the client.
   **Rollback**: revert the commit and apply the inverse migration; orders created in the new shape keep their decimals, which read correctly as `Float`.
   **Risks**: an old storefront bundle that still sends `price` is harmless (the DTO drops it) and would show a total computed from stale stock; the checkout revalidates on submit, so the refusal is a `409`, not a wrong order. A backfill that finds a product with no currency aborts the migration instead of writing a wrong one.

## Follow-up

- [ ] Feature 2 must delete the ordered cart lines inside the same transaction; until then the duplicate submission window in Consequences stays open.
- [ ] Feature 3 must add the delivery price to `Order.totalPrice`, otherwise the order screen and the checkout form keep disagreeing.
- [ ] Feature 4 must decide where the seller of a line is stored and owns clearing `isOutOfStock` whenever stock is raised again.
- [ ] `Product.price` and `ShippingMethod.price` remain `Float`; unify the money type before any payment provider work.
- [ ] The demo catalogue serves images from about fifty shops, so `apps/customer/next.config.ts` now allows any host for `next/image`; the order screen crashed on `mmedia.ozone.ru` before that. A real catalogue should copy images into its own storage and drop the wildcard.
- [ ] `Product.sales` is not incremented by an order in this feature; decide in feature 4 whether a delivered order bumps it.
