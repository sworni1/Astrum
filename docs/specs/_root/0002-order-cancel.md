# 0002. Order cancellation and seller owned order status

**Date**: 2026-11-07
**Status**: In Progress

## Summary

This decision extends customer cancellation to cover seller owned order lines and their status path. The API will tie each line to a business when the order is created and check the business owner on every seller request. Status changes and stock returns will share one database transaction, so repeated or competing requests cannot return stock twice.

## Context

The order service currently supports customer cancellation at the order level. The storefront also has a hook for changing one order line, but the API has no matching route. An order line does not record the product business that must fulfill it.

Products already carry a `businessId`, but it is a random value with no relation to a user. Authentication provides a verified `userId`, not a seller role. The order and line status enums contain more states than the service supports, and a single order may contain products from different businesses.

Checkout decreases stock before fulfillment. Cancellation restores it. Partial status changes therefore affect stock and the order status, and two requests may try to change the same line at once. The existing order total is a checkout snapshot, and payment refunds are not part of this feature.

## Requirements

**User stories**:

* As a customer, I want to cancel an eligible order and see a clear result, so that stock is returned once and my order state is accurate.
* As a seller, I want to see and update only the lines owned by my business, so that I can fulfill my own orders without seeing another seller's products.
* As the shop, I want each order line to keep the business that owned its product at checkout, so that later product changes do not reassign old orders.

**Acceptance criteria**:

* **AC-1**: The migration creates one `Business` row for each distinct existing `Product.businessId`, keeps that identifier, and leaves `ownerUserId` empty. It adds nullable `OrderItem.businessId` and backfills it from the related product. Immediately before making the field required or adding foreign keys, after old API replicas have been drained, the migration checks that every order line has a product, every line has a business snapshot, every product business has a `Business` row, and no line has status `RETURNED`, `BACKORDERED`, or `REPLACED`. If a check fails, rollout stops with the affected row count; it does not guess an owner or rewrite a status. After the checks pass, the migration makes the field required and adds the indexes and foreign keys. No historical business is assigned to a user without an explicit assignment.
* **AC-2**: A `Business` has one nullable, unique `ownerUserId` related to `User.id`. A user can own at most one business. Ownership is assigned through an administrative data change, not by a public endpoint or a client supplied role. Seller authorization reads the current database ownership for each request and does not rely on a role cached in the session token.
* **AC-3**: `POST /api/products` associates a new product with the authenticated user's assigned business. Its DTO strips any caller supplied `businessId`, and the service sets that field from the authenticated user. A caller without an assigned business receives `403` with code `SELLER_NOT_ASSIGNED`.
* **AC-4**: `POST /api/orders` copies each product's `businessId` into the new `OrderItem.businessId` in the same order transaction. The value is an ownership snapshot. Customer order responses do not expose `businessId` or `ownerUserId`.
* **AC-5**: `GET /api/seller/orders` returns `{ orders, page, limit, total, totalPages }`, with orders containing only the caller's owned lines. An order with lines from multiple businesses includes only the caller's lines. Orders are sorted by `createdAt` descending, then `id` ascending; lines within each order are sorted by `id` ascending. Each order includes its id and creation time. Each line includes its id, product id, name, image, quantity, unit price, currency, and status. These line values come from the order line's checkout snapshots, not the current product record, and remain available if the product is later deleted. Neither this response nor the seller status response includes another seller's lines, `userId`, `businessId`, delivery address, payment details, or the full order total. Results use positive integer `page` and `limit` values, default to page 1 and 20 rows, and cap `limit` at 50. A supplied `limit` above 50 is treated as 50. `total` counts distinct orders containing at least one owned line, and `totalPages` is `ceil(total / limit)`. Invalid pagination receives `422 VALIDATION`. A user without an assigned business receives `403 SELLER_NOT_ASSIGNED`.
* **AC-6**: `PATCH /api/order-items/:orderItemId/status` permits only these line transitions: `PENDING` to `CONFIRMED`, `OUT_OF_STOCK`, or `CANCELLED`; `CONFIRMED` to `SHIPPED` or `CANCELLED`; and `SHIPPED` to `DELIVERED`. `CANCELLED`, `OUT_OF_STOCK`, and `DELIVERED` are terminal. `RETURNED`, `BACKORDERED`, and `REPLACED` are not enabled by this feature.
* **AC-7**: The seller status route checks `OrderItem.businessId` against a business whose `ownerUserId` equals the authenticated `userId`. A missing line and a line owned by another user both return `404 ORDER_ITEM_NOT_FOUND`, without revealing which case occurred. Its success response contains only the seller safe line fields in AC-5 and the parent order id. An invalid transition returns `409 INVALID_STATUS_TRANSITION` with `from` and `to`. An invalid status value returns `422 VALIDATION`.
* **AC-8**: After each successful line transition, `Order.status` is recomputed in the same transaction. `CANCELLED` and `OUT_OF_STOCK` lines are excluded. If no active lines remain, the order is `CANCELED`; otherwise the order is set to the earliest status among active lines in this order: `PENDING`, `CONFIRMED`, `SHIPPED`, then `DELIVERED`.
* **AC-9**: Changing a line from `PENDING` or `CONFIRMED` to `CANCELLED` restores its quantity to the product once and clears `isOutOfStock` in the same atomic product update. The quantity change uses a database increment, not a read followed by a write, so concurrent cancellations for different orders containing the same product cannot overwrite each other's stock return. A line moved to `OUT_OF_STOCK` does not change product quantity or the stock flag. Seller line cancellation does not change `Order.paymentStatus`, including when it is `PENDING`. Repeating the same accepted target status returns the current line without a second stock change.
* **AC-10**: Customer cancellation remains `PATCH /api/orders/:orderId/status` with `status: "CANCELED"`. A foreign or missing order returns `404 ORDER_NOT_FOUND`. Cancellation is refused with `409 INVALID_STATUS_TRANSITION` and writes nothing if any line is `SHIPPED`, `DELIVERED`, `RETURNED`, `BACKORDERED`, or `REPLACED`. Otherwise all `PENDING` and `CONFIRMED` lines are cancelled and their stock is restored once using an atomic database increment; existing `CANCELLED` and `OUT_OF_STOCK` lines are unchanged. The order status is recomputed by AC-8 in the same transaction, so an order with no remaining active lines is `CANCELED`. The line statuses, order status, stock changes, and the existing pending payment cancellation update commit atomically. Repeating cancellation returns the current order without another stock change.
* **AC-11**: A status change and its order status recalculation are atomic. Every status write locks the parent order row before reading line state. Concurrent seller and customer changes to the same order serialize on that row. Product stock returns use an atomic database increment, also protecting simultaneous cancellations on different orders that share a product. The transaction uses the existing 5000 millisecond wait limit, 10000 millisecond timeout, and Read Committed isolation, with no retry loop. A failed operation leaves line status, order status, stock quantity, and stock flag unchanged; an unexpected database error uses the existing `500` response.
* **AC-12**: `Order.totalPrice` remains the amount recorded at checkout when a line is cancelled or marked `OUT_OF_STOCK`. This feature does not recalculate payment amounts, issue refunds, or change a non pending `paymentStatus`. Customer cancellation keeps the existing rule that a `PENDING` payment becomes `CANCELLED`.
* **AC-13**: When `SELLER_ORDER_WORKFLOW_ENABLED` is false or absent, the seller list and line status endpoints return `503 SELLER_ORDER_WORKFLOW_DISABLED`. Only the literal values `true` and `false` are valid; any other configured value prevents the API from starting. Customer order reads, checkout, and customer cancellation remain available. When enabled, seller endpoints use the ownership checks above.
* **AC-14**: Structured logs record successful seller status changes and refused changes with the actor id, order id when the line exists (otherwise `null`), line id from the route, target status when valid, and result code. Logs do not contain delivery addresses, payment details, or other seller lines.

## Options considered

### Option 1: Extend the existing order service

Keep the current order routes and cancellation service, then add business ownership, line status changes, and seller reads to the same order domain.

**Pros**:

* The existing order transaction remains the single place that owns status changes and stock restoration.
* The existing customer status hook already uses the line status route shape.
* The migration and response mapping remain close to the product and order models.

**Cons**:

* The order module gains seller specific queries and ownership checks.
* The schema needs a staged migration because older API replicas do not write the new line field.

### Option 2: Add a separate seller order module

Build seller reads and status updates in a new module while keeping customer cancellation in the current order module.

**Pros**:

* Seller permissions can be kept behind a seller focused route boundary.
* The module can later support the seller panel without changing customer routes.

**Cons**:

* Two modules would need to coordinate line status, order status, and stock changes.
* Shared transaction rules would be easier to implement inconsistently.

### Option 3: Replace the current order status path

Replace the existing cancellation flow with a new workflow service and move every status operation at once.

**Pros**:

* The state machine could be centralized before more status features are added.

**Cons**:

* It would widen the change and put working customer cancellation at risk.
* A full replacement is not needed to add the missing line route.

## Decision

**Chosen option**: Option 1: Extend the existing order service.

Add a `Business` record owned by one existing user, preserve that link on every order line, and extend the order service to enforce seller access and line transitions. Keep current customer cancellation and make its stock return line based and atomic.

**Implementation skills**: none consulted.

## Rationale

The order service already creates orders and restores stock in transactions, and the storefront already calls the planned order line status path. Keeping those operations in one service avoids two sources of truth for stock and status. A separate seller module would still need to coordinate with the same order rows and would make races harder to reason about.

`businessId` already exists on products, so a `Business` table gives that identifier a real owner without treating a random identifier as an authenticated user. Existing business identifiers are preserved but remain unassigned until an administrator supplies an owner. The cost is a staged migration and a manual seller provisioning step. It avoids fabricating ownership for existing products.

## Feature design

**Data model sketch**:

| Entity | Fields | Relationships and rules |
| --- | --- | --- |
| `User` | Existing `id` | A user owns zero or one `Business`. |
| `Business` | `id` primary key, nullable unique `ownerUserId`, `createdAt` | `ownerUserId` references `User.id`. Existing businesses may have no owner. |
| `Product` | Existing required `businessId` | References `Business.id`. New products use the authenticated user's assigned business. |
| `OrderItem` | New required `businessId` | References `Business.id` and snapshots the product business at checkout. An index supports seller line queries. |

Existing product business identifiers seed `Business.id`. Existing order lines copy the related product identifier into `OrderItem.businessId`. Owner assignments for old businesses are not inferred.

**State transitions**:

| Current line status | Allowed target statuses |
| --- | --- |
| `PENDING` | `CONFIRMED`, `OUT_OF_STOCK`, `CANCELLED` |
| `CONFIRMED` | `SHIPPED`, `CANCELLED` |
| `SHIPPED` | `DELIVERED` |
| `CANCELLED`, `OUT_OF_STOCK`, `DELIVERED` | None |

`Order.status` is derived from its lines. Cancelled and out of stock lines are ignored. If no active line remains, the order is `CANCELED`. Otherwise the least advanced active line determines the order status, using `PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED` in that order.

Every line change locks its parent order row before it reads line state. The service validates ownership and the transition, writes the line, returns stock only for a successful cancellation, then recalculates the order status. These steps share one database transaction using the existing transaction limits and Read Committed isolation. A repeat of the same accepted target is a no op. A repeat cancellation cannot return stock twice.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
| --- | --- | --- | --- | --- | --- |
| `/api/products` | POST | Product fields, no trusted `businessId` | Product associated with the caller's business | Existing session | `403 SELLER_NOT_ASSIGNED`, validation error |
| `/api/orders` | POST | Existing checkout DTO | Customer order, with seller snapshot kept internal | Existing session and active account | Existing checkout errors |
| `/api/seller/orders` | GET | `page`, `limit` | Paginated orders with only the caller's lines | Existing session and assigned business | `403 SELLER_NOT_ASSIGNED`, `422 VALIDATION`, `503 SELLER_ORDER_WORKFLOW_DISABLED` |
| `/api/order-items/:orderItemId/status` | PATCH | `status` | Updated line with its order id | Existing session and owning business | `404 ORDER_ITEM_NOT_FOUND`, `409 INVALID_STATUS_TRANSITION`, `422 VALIDATION`, `503 SELLER_ORDER_WORKFLOW_DISABLED` |
| `/api/orders/:orderId/status` | PATCH | `status: "CANCELED"` | Updated customer order | Existing session and order owner | `404 ORDER_NOT_FOUND`, `409 INVALID_STATUS_TRANSITION`, `422 VALIDATION` |

The seller list response carries `orders`, `page`, `limit`, `total`, and `totalPages`. Each order carries `id`, `createdAt`, and only the owned `orderItems`. Each line carries `id`, `productId`, `name`, `previewImage`, `quantity`, `price`, `currency`, and `status`. `total` counts distinct orders with at least one owned line, and `totalPages` is `ceil(total / limit)`. The seller status response carries the same safe line fields and `orderId`. Expected business errors use the existing `AppError` response shape with `code`, `message`, and transition details when applicable. Unexpected database failures remain server errors through the current error handler.

**Value sourcing**:

| Action | Value produced or displayed | Source |
| --- | --- | --- |
| Product creation | Seller business id | Authenticated `userId` matched to `Business.ownerUserId` |
| Order creation | Line business id | `Product.businessId` read inside the order transaction |
| Customer order response | Public order and line fields | Existing order mapper; `businessId` and owner id are omitted |
| Seller order list | Owned lines and page totals | `OrderItem.businessId`, `Business.ownerUserId`, order line checkout snapshots, and query `page` and `limit`; orders sort by `createdAt` descending then `id` ascending, lines by `id` ascending |
| Seller status update | New line status | Validated request `status` and stored `OrderItem.status` |
| Order status | Aggregate status | Persisted line statuses and the state order in this spec |
| Cancellation stock return | Product quantity and stock flag | Atomic database increment by stored line quantity and set `isOutOfStock` to `false` in the same transaction |
| Order amount | Original total | Existing `Order.totalPrice` checkout snapshot |

**Key invariants**:

* The authenticated user id comes from the existing verified session, never from the request body or a query parameter.
* Seller authorization is checked from current `Business.ownerUserId` data on each request.
* Each order line keeps the business identifier that applied when checkout committed.
* A status write, stock change, and order status recalculation either all commit or all roll back.
* A line that is already cancelled never restores stock again.
* `isOutOfStock` is cleared only when a cancelled line returns stock. Marking a line out of stock does not change the product record.
* Seller responses contain only the seller's own lines and do not include customer addresses, payment details, or another seller's data.
* The checkout total and payment status rules remain unchanged apart from the existing pending payment cancellation rule.

**Security model**:

All routes remain behind the existing `__auth` session middleware. A seller is a signed in user who currently owns a `Business`. Every seller query filters through that ownership relation. Foreign and missing order lines use the same `404` response. The seller list filters line items before returning grouped orders, so a seller never receives another business's lines or the full order total. Delivery address and payment details are excluded. No new regulated data is introduced.

**Configuration required**:

* `SELLER_ORDER_WORKFLOW_ENABLED`: optional boolean, default `false`. Only `true` and `false` are accepted. It gates seller order listing and seller line status changes until the migration and owner assignments are ready. Changing it requires an API restart.

**Critical test scenarios**:

* Happy path: assign a business to a user, create a product, place an order, read only its line as the seller, and advance it through each allowed status. Confirm the original order total remains unchanged, verifies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-8**, **AC-12**.
* Legacy data: preserve each current business id, leave its owner empty, and backfill old order lines from their products. After old replicas are drained, confirm the migration repeats its checks and stops with counts for a missing product, missing business snapshot, missing business row, or unsupported line status, verifies **AC-1**.
* Authorization: a user without a business cannot create a product or read seller orders. Another seller receives the same `404` for a line as for a missing line, and seller responses omit another business's lines and private order fields, verifies **AC-2**, **AC-3**, **AC-5**, **AC-7**.
* Pagination and snapshots: page through equal creation times and confirm stable order and line sorting; change or delete a product after checkout and confirm seller line values remain the checkout snapshots, verifies **AC-5**.
* Invalid state: an enum value outside the supported flow answers `422`, invalid pagination answers `422`, and a disallowed transition or cancellation after shipment answers `409` without writes, verifies **AC-5**, **AC-6**, **AC-7**, **AC-10**, **AC-11**.
* Stock race: at least three parallel cancellation requests for one line restore stock once. Also cancel lines from different orders that reference the same product in parallel and confirm both increments are retained. An out of stock line does not change stock, and a seller and customer race leave a consistent order status, verifies **AC-8**, **AC-9**, **AC-10**, **AC-11**.
* Cancellation state: customer cancellation with only out of stock lines ends with order status `CANCELED` and commits the pending payment change atomically; seller cancellation leaves payment status unchanged, verifies **AC-8**, **AC-9**, **AC-10**, **AC-11**, **AC-12**.
* Feature toggle and logs: seller endpoints answer `503` while disabled, invalid flag values prevent boot, and enabled requests enforce ownership and log no private order data. Missing lines log a null order id, verifies **AC-13**, **AC-14**.
* Error mapping: an unexpected database failure answers `500` and leaves line status, order status, stock quantity, and stock flag unchanged, verifies **AC-11**.

## Build plan

Tracer Bullet: first preserve business ownership through one order from product creation to seller read. Then add the guarded status write and stock transaction, followed by legacy cleanup and full race coverage.

1. Add the `Business` table with a nullable owner relation and nullable `OrderItem.businessId`, seed business rows from existing products, and backfill order lines. Add the required indexes. Keep old writers compatible, satisfies **AC-1**, **AC-2**.
2. Update product creation to use the authenticated user's assigned business and checkout to snapshot the product business on each order line. Keep the new field out of customer response mappers, satisfies **AC-3**, **AC-4**.
3. Add seller order reads with bounded pagination and business scoped line selection. Add the line status route using the existing order module and the ownership check, satisfies **AC-5**, **AC-7**.
4. Add the line transition rules, parent order row lock, stock restoration for cancellation only, and order status aggregation. Preserve customer cancellation and the checkout total, satisfies **AC-6**, **AC-8**, **AC-9**, **AC-10**, **AC-11**, **AC-12**.
5. Add `SELLER_ORDER_WORKFLOW_ENABLED` with a false default to both environment templates, validate its value at startup, and add the error mapping and structured logs without private order data, satisfies **AC-7**, **AC-13**, **AC-14**.
6. After older API replicas are drained, backfill any rows written during rollout, require `OrderItem.businessId`, add the product and line foreign keys, enable the seller workflow after explicit owner assignment, and run API, database, and concurrency tests, satisfies **AC-1**, **AC-2**, **AC-11**, **AC-13**.

## Consequences

**Positive**:

* A seller can access only order lines belonging to a business they own.
* The order line retains its seller even if the product's business changes later.
* Stock restoration and status changes have one transactional owner.
* Seller permissions can be revoked by changing the business owner in the database, without waiting for a session token to expire.

**Negative / tradeoffs**:

* Business ownership requires an administrative data change because no seller provisioning screen is included.
* Existing products and order lines remain unavailable to sellers until an administrator assigns their business to a user.
* A feature flag and a staged migration add rollout steps.
* The order total remains the original checkout amount after partial cancellation, and payment refunds remain out of scope.
* The order status shows the least advanced active line, so the line statuses remain the source for exact partial progress.

**Neutral**:

* The seller panel remains a separate scope feature. This spec adds the API and data rules it needs.
* Pickup location, delivery receipt time, returns, backorders, replacements, and refunds remain for their later features.

## Follow-up

* [ ] The seller panel feature should provide a user facing way to request or manage business ownership if manual administrator assignment becomes operationally burdensome.
* [ ] The pickup handover feature should define how `receiptDate` and pickup location are written when a line reaches `DELIVERED`.
* [ ] Payment work should define partial cancellation amounts and refunds before it charges an order total containing cancelled lines.

## Migration plan

**Strategy**: Feature flagged staged migration.

**Phases**:

1. Check for order lines without a product and for unsupported legacy statuses. Stop rollout and report counts if either exists. Create `Business`, add nullable `OrderItem.businessId`, preserve current product business ids, create unassigned businesses for them, and backfill order lines. Do not add the product foreign key or require the new line field while old API replicas may still write.
2. Deploy API code that writes the business snapshot on checkout, derives new product ownership from the signed in user, and keeps seller endpoints disabled. Drain all old replicas.
3. Reconcile businesses and order lines created during rollout. Immediately before applying constraints, repeat the missing product, missing line snapshot, missing business row, and unsupported status checks, and stop with counts if any fail. Then make the field required, add the `Business.ownerUserId`, `Product.businessId`, and `OrderItem.businessId` foreign keys, and verify there are no orphan values.
4. Assign business owners through an administrative data change, enable `SELLER_ORDER_WORKFLOW_ENABLED`, and run the live seller and cancellation checks.

**Rollback**: Disable the seller workflow first. If the application must return to the old writer, remove the new foreign key constraints and keep `OrderItem.businessId` nullable so old code can continue to write. Preserve the `Business` rows and owner assignments. Do not delete the new ownership data during rollback.

**Risks**: A rollout with old replicas can create products without a registered business or order lines without a business snapshot. The final reconciliation must run after old replicas stop and before enabling the seller workflow. Enabling the feature before assigning owners leaves legacy lines inaccessible to sellers by design.
