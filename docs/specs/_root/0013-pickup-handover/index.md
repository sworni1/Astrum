# 0013. Pickup handover

**Date**: 2026-11-12
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The shop has no way to close an order: a line can be shipped, and nothing marks it as collected. Pickup is how this shop hands goods over, so a customer picks one of the shop's own pickup points at checkout, the parcel travels there, and the seller marks the handover. This decision adds a `PickupPoint` table owned by the platform (not by a seller), a pickup flag on the delivery method, a point select in the checkout, a handover action in the seller panel that turns every ready line into `DELIVERED` in one transaction, and the point and the handover date on the customer order screen. It also closes the debt spec 0002 left open: the line `receiptDate` finally has a writer.

## Requirements

**User stories**:

- As a customer, I want to collect my order at a pickup point I chose at checkout, so that I do not depend on a courier address.
- As a customer, I want the order screen to show the point I chose and the day the order was handed over, so that I can tell whether my parcel is still there.
- As a seller, I want one action that marks the whole parcel as handed over at the point, so that a collection takes one click, not one click per line.
- As the shop operator, I want the pickup points to be rows I can add and switch off without a deploy, so that opening or closing a point is an operational change.

**Acceptance criteria** (the contract):

- **AC-1**: The schema gains a `PickupPoint` model: `id String @id @default(cuid())`, `name String @unique`, `address String`, `isActive Boolean @default(true)`, `createdAt DateTime @default(now())`, and the relation `Order[]`. `ShippingMethod` gains `isPickup Boolean @default(false)`. `Order` gains `pickupPointId String?` with `pickupPoint PickupPoint? @relation(fields: [pickupPointId], references: [id], onDelete: Restrict, onUpdate: Cascade)`, `pickupPointName String?`, `pickupPointAddress String?`, `handedOverAt DateTime?`, and an index on `pickupPointId`; `Order.deliveryAddress` becomes `String?`. The model lands in `packages/Astrum-db/prisma/schema.prisma`, in `apps/api-astrum/prisma/schema.prisma` (byte identical to it), and in the trimmed copies of `apps/auth-astrum` and `apps/worker`, which carry the `Order` and `ShippingMethod` models and therefore also need the `PickupPoint` model block, because a relation needs its target. `pnpm prisma:generate` rebuilds all four clients. The migration creates the table, adds the four `Order` columns, drops `NOT NULL` from `Order.deliveryAddress`, adds the foreign key with `ON DELETE RESTRICT ON UPDATE CASCADE` and the index, and inserts the pickup method row by name: `Pickup at the shop`, `isPickup = true`, `price = 0.00`, `currency = 'RUB'`, `"isActive" = true`, through `INSERT ... ON CONFLICT (name) DO UPDATE SET price = EXCLUDED.price, currency = EXCLUDED.currency, "isPickup" = true, "isActive" = true`, with the `id` supplied as `'sm_' || replace(gen_random_uuid()::text, '-', '')` because the table has no database default. No pickup point row is seeded, no existing order is backfilled, and no already delivered order receives a `handedOverAt`, because the moment was never recorded and a value derived from `updatedAt` would be a guess.
- **AC-2**: `pnpm db:pickup-point add "<name>" "<address>"` creates one point and prints its id, name, address and switch; `pnpm db:pickup-point list` prints every point; `pnpm db:pickup-point on "<name>"` and `pnpm db:pickup-point off "<name>"` switch a row by name. The script lives at `packages/Astrum-db/scripts/pickupPoint.ts`, uses the `prisma` client exported by `@astrum/db` (which falls back to `packages/Astrum-db/.env`), writes `add` in one transaction, refuses a name that already exists with a clear message and a non zero exit (a re `add` must never silently re address a real point), refuses an unknown name in `on`, `off` and the address argument when it is shorter than 5 characters, and is not reachable over HTTP. The root `package.json` gains the alias `db:pickup-point` beside `db:assign-business`.
- **AC-3**: `GET /api/pickup-points` answers `200` with `{ points: [...] }`, holding only rows whose `isActive` is `true`, ordered by `name` ascending, each item exactly `{ id, name, address }`. The module lives at `apps/api-astrum/src/modules/pickup/` (`pickup.controller.ts`, `pickup.service.ts`, `pickup.routes.ts`) and its router joins the existing `app.use("/api", authenticateToken, ...)` chain in `apps/api-astrum/src/app.ts`, so the session middleware runs once per request; it is not added as a second `/api/...` mount. A request without a valid session answers `401` in the existing error shape. A `PENDING` account reads the list, because spec 0005 lets an unconfirmed account browse and closes only writes.
- **AC-4**: `GET /api/shipping-methods` carries `isPickup` on every method. `SHIPPING_METHOD_SELECT` in `apps/api-astrum/src/modules/shipping/shipping.service.ts` gains `isPickup: true`, `ShippingRow` and `toShippingMethodJson` in `shipping.mapper.ts` carry it, and each item is `{ id, name, price, currency, isPickup }`. This amends spec 0009, AC-4, whose four field list is superseded on this one field. The read keeps its active only filter, its name order and its `PENDING` account access, and a read spec proves the flag answers `true` for the pickup row and `false` for a courier row.
- **AC-5**: The storefront data layer is in place. `apps/customer/src/common/types/order.types.ts` gains `export interface PickupPoint { id: string; name: string; address: string }`, `isPickup: boolean` on `ShippingMethod`, and on both order types `pickupPointId: string | null`, `pickupPointName: string | null`, `pickupPointAddress: string | null`, `handedOverAt: string | null`, with `deliveryAddress` typed `string | null`. `apps/customer/src/hooks/pickup/usePickupPoints.ts` mirrors `useShippingMethods`: SWR over `/pickup-points` through the existing fetcher, exposing `points`, `isLoading`, `error` and `mutate`. `apps/customer/src/common/zodSchemes/checkout.scheme.ts` exports the same factory with a second argument, `isPickup: boolean`: `deliveryAddress` keeps the 10 character minimum only while `isPickup` is false, and `pickupPointId` carries the `pickupPointRequired` message while `isPickup` is true, that key living in the `validation` namespace the factory's translator is typed to (`apps/customer/src/common/zodSchemes/translator.ts`), beside `deliveryAddressTooShort`. A table test proves both modes: with `isPickup` false a missing address fails and a missing point passes, with `isPickup` true the reverse holds.
- **AC-6**: The checkout keeps one delivery block with one of two fields, never both. While the selected method has `isPickup` false it renders the `deliveryAddress` textarea as today; while it has `isPickup` true it renders a point select instead, each option printing the point name and address, the trigger printing the chosen point name, and the chosen id bound to `pickupPointId`. While no method is selected the address textarea renders, which is the initial state of the form and the state a refused method leaves behind. The address requirement and the point requirement follow the selected method through the schema of AC-5, and the submit control stays disabled while the selected method is pickup and `pickupPointId` is the empty string. While the points request is in flight the select is disabled and its trigger reads `cart.pickupLoading`; when the request fails the select is disabled beside a `cart.pickupRetry` control that revalidates the hook, and the form still sends nothing. When the list answers no active points, every method option whose `isPickup` is true renders disabled with the `cart.pickupUnavailable` line under its name and cannot be chosen, while a method without `isPickup` stays selectable; a `shippingMethodId` that names a pickup method at a moment when no point exists counts as no choice and keeps the submit disabled. Switching the method from pickup to a courier method restores the address requirement and leaves any typed address as it was, and switching back restores the point requirement. The field is its own component, `apps/customer/src/features/pages/Cart/components/CheckoutForm/components/PickupPointField/index.tsx`, because `CheckoutForm/index.tsx` counts 376 code lines against the 400 line ceiling of `S1` and the select, its loading, failure and empty states and its option content do not fit beside the rest. A `409 PICKUP_POINT_INACTIVE`, `409 UNKNOWN_PICKUP_POINT` or `409 PICKUP_POINT_NOT_ALLOWED` shows one toast with that code's text: `CHECKOUT_ERROR_KEYS` in `apps/customer/src/hooks/order/checkoutErrors.ts` gains the three codes with a `resetPoint` flag on the reaction, the form refetches the points and clears `pickupPointId` for the first two, resets the method for the third, and keeps the address, date and payment fields exactly as typed.
- **AC-7**: `POST /api/orders` accepts an optional `pickupPointId` (exposed string, not empty when present). `CreateOrderDto.deliveryAddress` becomes required only when `pickupPointId` is absent, expressed with `@ValidateIf((dto) => !dto.pickupPointId)` before `@IsNotEmpty()` and `@IsString()`, so a body without a point and without an address still answers `422 VALIDATION` with its field error as today. Inside the existing order transaction, after the method checks of spec 0009, the service reads the chosen method's `isPickup`: with `isPickup` false and a `pickupPointId` present it answers `409 PICKUP_POINT_NOT_ALLOWED`; with `isPickup` true it answers `409 PICKUP_POINT_REQUIRED` when the point is absent, `409 UNKNOWN_PICKUP_POINT` when the id matches no row, and `409 PICKUP_POINT_INACTIVE` when the row has `isActive` false, in that order. Each refusal answers the existing body shape with its own `code` and writes no order, takes no stock and clears no cart line. Every refusal code lives in `ORDER_ERROR_CODES`. A successful pickup order stores `pickupPointId`, `pickupPointName` from the row's `name`, `pickupPointAddress` from the row's `address`, and `deliveryAddress` as `null` whatever the body carried; a successful order without `isPickup` stores no pickup field. `canonicalOrderBody` in `idempotency.ts` hashes `deliveryAddress` as `null` whenever the body carries a `pickupPointId`, because two pickup bodies that differ only in a typed address describe one order, and it appends `pickupPointId` after `shippingMethodId` only when the body carries one, so a body without a point keeps exactly the pre image it had before this change and a replay of an order placed earlier is answered as a replay, never as a reused key. A replay that names a different point answers `409 IDEMPOTENCY_KEY_REUSED` under the rule of spec 0003.
- **AC-8**: Every customer order answer carries `pickupPointId`, `pickupPointName`, `pickupPointAddress`, `handedOverAt` and the nullable `deliveryAddress`: the detail read and the list read already build on `include` with the row spread, so the fields reach JSON without a mapper branch, and `handedOverAt` reaches JSON as an ISO string or `null`, never an empty string. `apps/customer/src/common/types/order.types.ts` mirrors the answered shape per AC-5. The answer carries no `isPickup` field: a pickup order is one whose `pickupPointId` is not null, and that is the test every surface and the handover route use.
- **AC-9**: The customer surfaces read the snapshot and print no null. On the order screen, `OrderOverviewCard` renders, for a pickup order, the `orders.pickupPoint` label with `pickupPointName` and `pickupPointAddress` in place of the address block, and renders the `orders.handedOverAt` label with the date from the formatter when `handedOverAt` is set; `DeliveryStatusCard` labels the expected date with `orders.pickupDate` for a pickup order and prints `handedOverAt` through `useFormatter` once the order is handed over. On the order list, `OrderCard` prints the method name and, for a pickup order, the point name on the delivery line, with the date line labelled `orders.pickupDate`. No surface prints an empty address block, a literal `null` or the string `undefined`, and every amount keeps the rules of spec 0009. A pickup order means `pickupPointId` is not null on the row, so an order placed on the method before the migration flagged it as pickup, carrying no point, renders exactly as it did before this change.
- **AC-10**: `GET /api/seller/orders` order rows gain `isPickup` (from `shippingMethod.isPickup`), `pickupPointName`, `pickupPointAddress` and `handedOverAt`, because the seller must know where the parcel goes and whether it was collected. The order select in `seller-order.service.ts` gains the four values and the `shippingMethod: { select: { isPickup: true } }` join, and the answer maps `shippingMethod.isPickup` onto a boolean `isPickup` field rather than exposing the nested object. No buyer address, buyer name or buyer contact reaches the seller answer, which keeps the rule of spec 0002, AC-5. The storefront seller types mirror the four fields. The panel branches on `pickupPointId` and not on `isPickup`, because an order placed on the method before it carried the flag has no point and must render neither a point block nor a handover control.
- **AC-11**: `PATCH /api/seller/orders/:orderId/handover` changes no line status except `DELIVERED`, and it is the only route that accepts `CONFIRMED` to `DELIVERED`. It runs `authenticateToken` on the mount, then `requireActiveAccount` (`403 EMAIL_NOT_CONFIRMED`, `503 ACCOUNT_STATUS_UNAVAILABLE`), then the controller; the `requireSellerOrderWorkflow` gate this criterion named was removed on 2026-11-13. It works in one transaction with `ORDER_TRANSACTION_OPTIONS` and `lockOrder`: an order that does not exist, and an order that holds no line of the caller's business, both answer `404 ORDER_NOT_FOUND`, so ownership is never revealed; an order whose `pickupPointId` is null answers `409 HANDOVER_REQUIRES_PICKUP`, which is the same test the panel uses; every owned line in `CONFIRMED` or `SHIPPED` becomes `DELIVERED` with `receiptDate` set to the same server timestamp, every owned line in any other status is left untouched, `recomputeOrderStatus` runs in the same transaction, and when the status `recomputeOrderStatus` returns is `DELIVERED` while `handedOverAt` is null it is written with that same timestamp. `recomputeOrderStatus` returns the `OrderStatus` it computes, which is the one change this feature makes to `order-status.helpers.ts`; its two existing callers ignore the value and keep their behaviour. When no owned line was ready, the route answers `200` with the current group and writes nothing if every owned line is already `DELIVERED` (an idempotent repeat), and answers `409 NOTHING_TO_HAND_OVER` otherwise, which is the case of an order whose owned lines are still `PENDING`. The success answer is `{ order }` in the shape of AC-10 with its owned lines, and the move writes one structured log line with the actor id, the order id, the business id, the delivered line count and the result code.
- **AC-12**: The existing `PATCH /api/order-items/:orderItemId/status` writes `receiptDate` with the server timestamp when a line becomes `DELIVERED`, and writes `handedOverAt` in the same transaction when the status `recomputeOrderStatus` returns is `DELIVERED` while the field is null, so a courier order also records its handover moment. The transition table of spec 0002 is unchanged: `CONFIRMED` to `DELIVERED` stays refused on this route and is reachable only through the handover route of AC-11, for an order whose `pickupPointId` is not null; `SHIPPED` to `DELIVERED` stays available on this route for every order, so a courier delivery still closes through it. A repeat of `DELIVERED` on an already delivered line stays the no op of spec 0002, AC-9, and rewrites neither `receiptDate` nor `handedOverAt`.
- **AC-13**: The seller panel renders a pickup group as its own case. `SellerOrderGroup` shows `pickupPointName` and `pickupPointAddress` for a group whose `pickupPointId` is not null and the handover date when `handedOverAt` is set, and renders a `Hand over` control while the group holds a line in `CONFIRMED` or `SHIPPED` and `actionsDisabled` is false, which keeps the rule of spec 0007, AC-11 for a `PENDING` account. The control opens a confirmation dialog that names the point and the number of lines it will deliver, and only the confirm control sends the request; Escape and the keep control close it and write nothing. While the request runs the control shows its busy state and accepts no second press. On success the answered order replaces the group and the page revalidates, so the group counts follow. A refusal raises one toast whose text comes from the `seller` catalog keyed by the response `code` (`NOTHING_TO_HAND_OVER`, `HANDOVER_REQUIRES_PICKUP`, `ORDER_NOT_FOUND`, `INVALID_STATUS_TRANSITION`, `VALIDATION`, `EMAIL_NOT_CONFIRMED`, `ACCOUNT_STATUS_UNAVAILABLE`) and revalidates the page; a `500` or a client timeout shows the generic failure text with a retry. `refusalToastFor` in `SellerOrders/lib/refusals.ts` gains `NOTHING_TO_HAND_OVER`, `HANDOVER_REQUIRES_PICKUP` and `ORDER_NOT_FOUND`, none of them retryable, because a second attempt can only be refused again. For a pickup group the line rows offer no `Deliver` action, because the group owns that move, while `Ship` and `Cancel` keep their rules; the action map in `SellerOrders/lib/actionMap.ts` gains the pickup case, and its parity test covers it.
- **AC-14**: Every new string lives in both `apps/customer/messages/en.json` and `apps/customer/messages/ru.json` and the two catalogs stay in parity through `apps/customer/src/i18n/messages.test.ts`. The `cart` namespace gains `pickupPoint`, `pickupSelect`, `pickupLoading`, `pickupRetry`, `pickupUnavailable`, `pickupLoadFailed`, `unknownPickupPoint`, `pickupInactive` and `pickupNotAllowed`, while `pickupPointRequired` lives in the `validation` namespace beside `deliveryAddressTooShort`, because the checkout schema reads that translator. The `orders` namespace gains `pickupPoint`, `pickupDate` and `handedOverAt`. The `seller` namespace gains `handover`, `handoverTitle`, `handoverText`, `handoverConfirm`, `handoverBusy`, `handoverKeep`, `handedOverAt`, `nothingToHandOver`, `handoverRequiresPickup`, `handoverFailed` and `orderNotFound`. No component carries a hardcoded English or Cyrillic string, and dates go through the `next-intl` formatter. Delivery method names stay English data, which keeps the rule of spec 0009, AC-13.
- **AC-15**: The behaviour is covered by tests. Gateway jest: the points read (active only, name order, the narrowed row, `401` without a session and one session middleware call per request); order create (each of the four point refusals and their precedence, the stored snapshot, the null address, the stored `deliveryPrice` 0.00 and `grandTotal` equal to `totalPrice`, and a body carrying the snapshot fields reaching the service without them); idempotency (a replay with the same key and a different `pickupPointId` answers `409 IDEMPOTENCY_KEY_REUSED`); the handover route (the ownership `404`, `409 HANDOVER_REQUIRES_PICKUP`, the partial delivery of `CONFIRMED` and `SHIPPED` lines, the untouched `PENDING` line, the idempotent `200` repeat with one `handedOverAt`, the `409 NOTHING_TO_HAND_OVER` case, and the `receiptDate` of every delivered line); the handling of two sellers handing over the same order at once on the real database with `ORDER_DB_TESTS=1`, proving the order row lock serialises them and `handedOverAt` is written once. Storefront vitest: the two hooks, the schema table test of both modes, the checkout states, the seller action map parity with the pickup case, the group header and dialog states, the checkout refusal map proving the three point codes reach their own toast and reaction, and the two catalog parity checks. Gateway jest also covers the shipping read of AC-4 and the `OrderStatus` return of `recomputeOrderStatus`. `pnpm quality-gate` is green.
- **AC-16**: The path is walked on the running stack: a point created through `pnpm db:pickup-point add` appears in `GET /api/pickup-points` and in the checkout; an order placed there stores the snapshot, `deliveryAddress` null and `deliveryPrice` 0.00; the seller panel shows the point, hands the parcel over in one action, and the order becomes `DELIVERED`; the order screen shows the point and the handover date; a point switched off between page load and submit produces its coded refusal and the form refetches the list; the seller read carries no buyer address. The steps and their output live in `verify.md`.

## Decision

**Chosen option**: Option 3: platform owned pickup points, an operator script, and the seller marks the handover.

The pickup point is a platform entity with no owner. A migration creates its table and inserts one delivery method named `Pickup at the shop` with `isPickup` true and price 0.00, and no point row. An operator script adds and switches points. The checkout lists the active points and requires one as soon as the chosen method carries `isPickup`. The order stores the point id and its name and address as a snapshot. The seller panel gets one `Hand over` control per pickup group, and one route delivers every ready line of that seller in a single transaction, after which the existing order status rule closes the order when nothing is left undelivered.

**Implementation skills**: none installed that shape this decision. The repository conventions in `AGENTS.md` (module per folder, `authenticateToken` on every mount, the error body shape, the order transaction rules of spec 0002) and the storefront coding standard in `apps/customer/AGENTS.md` (`S1` to `S5`) govern the build.

## Rationale

Reasoning, options and the measured state before the decision: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

| Entity | Field | Type | Change |
| --- | --- | --- | --- |
| `PickupPoint` | `id` | `String @id @default(cuid())` | new table |
| `PickupPoint` | `name` | `String @unique` | new, the operator addresses a row by it |
| `PickupPoint` | `address` | `String` | new |
| `PickupPoint` | `isActive` | `Boolean @default(true)` | new |
| `PickupPoint` | `createdAt` | `DateTime @default(now())` | new |
| `ShippingMethod` | `isPickup` | `Boolean @default(false)` | new |
| `Order` | `pickupPointId` | `String?`, FK to `PickupPoint`, `ON DELETE RESTRICT` | new |
| `Order` | `pickupPointName` | `String?` | new, snapshot |
| `Order` | `pickupPointAddress` | `String?` | new, snapshot |
| `Order` | `handedOverAt` | `DateTime?` | new, written once |
| `Order` | `deliveryAddress` | `String?` | was required |
| `OrderItem` | `receiptDate` | `DateTime?` | already exists, first writer here |

Cardinality: `PickupPoint 1:N Order` with the order side nullable, `ShippingMethod 1:N Order` unchanged. The order is the only writer of the three `pickup*` columns and of `handedOverAt`.

**State transitions**:

The line table of spec 0002 keeps its shape. One move is added for an order whose `pickupPointId` is not null, and only through the handover route:

| Current line status | Allowed targets | Route |
| --- | --- | --- |
| `PENDING` | `CONFIRMED`, `OUT_OF_STOCK`, `CANCELLED` | line status route |
| `CONFIRMED` | `SHIPPED`, `CANCELLED` | line status route |
| `CONFIRMED` | `DELIVERED` | handover route only, on an order with a point |
| `SHIPPED` | `DELIVERED` | line status route for every order, and the handover route too on an order with a point |
| `CANCELLED`, `OUT_OF_STOCK`, `DELIVERED` | none | none |

`Order.status` stays derived by `recomputeOrderStatus` from the active lines: `CANCELLED` and `OUT_OF_STOCK` are ignored, the least advanced active line wins, and an order with no active line is `CANCELED`. The order reaches `DELIVERED` only when every active line is `DELIVERED`.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
| --- | --- | --- | --- | --- | --- |
| `/api/shipping-methods` | GET | none | `{ methods: [{ id, name, price, currency, isPickup }] }`, active only, by name | session cookie | `401` |
| `/api/pickup-points` | GET | none | `{ points: [{ id, name, address }] }`, active only, by name | session cookie | `401` |
| `/api/orders` | POST | the existing body, `pickupPointId` optional, `deliveryAddress` required only without it | the order with the pickup snapshot and a null address on a pickup order | session, active account | `409 PICKUP_POINT_NOT_ALLOWED`, `409 PICKUP_POINT_REQUIRED`, `409 UNKNOWN_PICKUP_POINT`, `409 PICKUP_POINT_INACTIVE`, plus the codes of specs 0009 and 0003 |
| `/api/seller/orders` | GET | `page`, `limit` | order rows adding `isPickup`, `pickupPointName`, `pickupPointAddress`, `handedOverAt` | session, active account, owned business | unchanged |
| `/api/seller/orders/{orderId}/handover` | PATCH | none | `{ order }` with its owned lines delivered | session, active account, owning business | `404 ORDER_NOT_FOUND`, `409 HANDOVER_REQUIRES_PICKUP`, `409 NOTHING_TO_HAND_OVER`, `403 EMAIL_NOT_CONFIRMED` |
| `/api/order-items/{orderItemId}/status` | PATCH | `status` | the line, now also writing `receiptDate` at `DELIVERED` | unchanged | unchanged |

**Value sourcing**:

| Action | Value produced or displayed | Source |
| --- | --- | --- |
| checkout point list | `id`, `name`, `address` per point | `PickupPoint` columns, active rows only, `name` ascending |
| checkout point list | whether the pickup method can be chosen | the points hook length: an empty list disables every `isPickup` option |
| checkout field choice | address textarea or point select | `ShippingMethod.isPickup` of the selected method, carried by the methods answer under AC-4 |
| checkout required field | which of the two fields the schema requires | the same `isPickup` value, passed into the schema factory |
| checkout money block | delivery price, total | the method price (0.00 for the pickup row) through `formatMoney`, as spec 0009 |
| order create | `pickupPointId` | the request `pickupPointId`, validated against the row |
| order create | `pickupPointName`, `pickupPointAddress` | the `PickupPoint` row read inside the order transaction |
| order create | `deliveryAddress` | the request address for an order without `isPickup`, `null` for a pickup order |
| order create | `deliveryPrice`, `grandTotal` | the method row and `totalPrice + deliveryPrice`, as spec 0009 |
| order create | replay identity | `canonicalOrderBody` over the request fields, with the address null when a point is named and `pickupPointId` only when present, sha256 |
| handover | which lines move | owned lines (`OrderItem.businessId` to `Business.ownerUserId`) in `CONFIRMED` or `SHIPPED`, on an order whose `pickupPointId` is not null |
| handover | `receiptDate` of each delivered line, `handedOverAt` of the order | one server timestamp taken inside the transaction |
| handover | the order status after the move | the `OrderStatus` that `recomputeOrderStatus` returns |
| seller group header | point name, point address, handover date | `pickupPointName`, `pickupPointAddress`, `handedOverAt` of the seller read |
| seller group header | the number in the dialog | the owned lines in `CONFIRMED` or `SHIPPED` on the current page, counted in the client |
| customer order screen | point name, point address, handover date, expected date | the order row fields, dates through `useFormatter` |
| customer order card | point name, expected date | `pickupPointName`, `deliveryDate` |
| refusals | the text the customer or the seller reads | `cart` and `seller` catalogs keyed by the response `code`, never the server `message` |

**Key invariants**:

- A pickup order is one whose `pickupPointId` is not null. `ShippingMethod.isPickup` decides only which field the checkout requires and what the create validates; it never decides how a placed order is read or handed over, because a method can gain the flag after orders were placed on it.
- The three `pickup*` columns are set exactly when the create runs against a method with `isPickup` true. No database constraint enforces the pairing; the order transaction is the only writer.
- `GET /api/shipping-methods` carries `isPickup`, so the client never guesses a method kind from its name.
- `pickupPointName` and `pickupPointAddress` never change after creation, so a renamed or a closed point never rewrites history.
- `receiptDate` and `handedOverAt` come from the server clock inside the transaction, never from a request body, so a seller cannot backdate a handover.
- `handedOverAt` is written once, by the first transaction that leaves the order `DELIVERED`, and never rewritten.
- A handover changes no stock, no payment status and no `totalPrice`, which keeps the rules of spec 0002, AC-9 and AC-12.
- A point that any order names is never deleted, only switched off.
- A pickup order carries no buyer address anywhere, and the seller answer carries no buyer address at all.
- The line status route never accepts `CONFIRMED` to `DELIVERED`; the handover route is the only path for that move, and only on a pickup order.

**Security model**:

Every route sits behind the `__auth` session cookie. The points read is open to a `PENDING` account, like the delivery method read, because it is a read. Order creation and the handover run behind `requireActiveAccount`, and the handover also behind `requireSellerOrderWorkflow`. Seller ownership is proved per line through `Business.ownerUserId` on every request, and an order holding none of the caller's lines answers the same `404` as a missing order. The seller sees the pickup point (public shop data) and never the buyer's address, name or contact. No new regulated data enters the browser: the point address is shop data, the address column is now nullable and empty on a pickup order. The handover log line is the audit record this feature adds, and it carries ids and a count only.

**Configuration required**: none. No new environment variable and no new service. The `SELLER_ORDER_WORKFLOW_ENABLED` gate specs 0002 and 0007 named was removed on 2026-11-13, so the handover route is gated by ownership like the rest.

**Critical test scenarios**:

- Happy path: a customer picks the pickup method, chooses a point, places the order, the order stores the snapshot with a null address and a 0.00 delivery, the seller hands it over in one action, and the order screen shows the point and the date, verifies **AC-1**, **AC-3**, **AC-4**, **AC-6**, **AC-7**, **AC-9**, **AC-11**, **AC-16**.
- Failure case: the chosen point is switched off between page load and submit, the create answers `409 PICKUP_POINT_INACTIVE`, and the form refetches the list, clears the choice and keeps the typed fields, verifies **AC-6**, **AC-7**.
- Failure case: the order still holds a `PENDING` line, the handover delivers the ready lines and leaves it, and a second handover on an order with nothing ready answers `409 NOTHING_TO_HAND_OVER`, verifies **AC-11**.
- Concurrency: two sellers of one multi business order hand over at the same moment, the order row lock serialises them, and `handedOverAt` is written once, on the transaction that closes the order, verifies **AC-11**, **AC-15**.
- Permission case: a seller of another business calls the handover for the order and receives `404 ORDER_NOT_FOUND`; a `PENDING` account receives `403 EMAIL_NOT_CONFIRMED`; with the workflow flag off the route answers `503`, verifies **AC-11**.
- Regression case: an order without `isPickup` keeps its address, answers no pickup field, and reaching `DELIVERED` through the line route writes `receiptDate` and `handedOverAt` once, verifies **AC-12**.

## Build plan

Tracer Bullet, from the scope header: the thin thread runs from the schema to one order placed at a point and handed over in the seller panel before the surfaces thicken. No slice is UI only, and each slice after the first needs the one before it.

1. Schema, four copies, migration and clients: `PickupPoint`, `ShippingMethod.isPickup`, the four `Order` columns, the nullable address, the foreign key and index, and the `Pickup at the shop` method row, satisfies **AC-1**.
2. Operator script: `packages/Astrum-db/scripts/pickupPoint.ts` with `add`, `list`, `on` and `off`, its refusals, and the root alias, satisfies **AC-2**.
3. Gateway points read: `apps/api-astrum/src/modules/pickup/` with controller, service, router, the active only filter, the name order, the narrowed row, and its jest spec, satisfies **AC-3**.
4. Shipping read: `isPickup` in `SHIPPING_METHOD_SELECT`, the row type and `toShippingMethodJson`, with its jest spec, satisfies **AC-4**.
5. Storefront data layer: the types, `usePickupPoints`, the schema factory that takes `isPickup`, and the `validation.pickupPointRequired` key, with the table test of both modes, satisfies **AC-5**.
6. Checkout: `PickupPointField` extracted out of `CheckoutForm`, the field swap, the point select, the loading, failure and empty states, the disabled pickup option, the submit rule, the three point refusal branches with `resetPoint`, satisfies **AC-6**, **AC-14**.
7. Gateway order create: the DTO optionality, the four refusals in precedence, the snapshot, the null address, the fingerprint, and the specs, satisfies **AC-7**, **AC-15**.
8. Customer order answers and types: the field mirror on both order types, satisfies **AC-8**.
9. Customer surfaces: the order screen blocks and the card, with the handover date and the pickup date label, satisfies **AC-9**.
10. Seller read: the four fields on the list select, the `isPickup` mapping and the client types, satisfies **AC-10**.
11. Handover route: the gate chain, the transaction with `lockOrder`, the `OrderStatus` return of `recomputeOrderStatus`, the deliver of the ready lines, the single `handedOverAt`, the repeat and nothing ready answers, the log line, and its specs including the two seller race on the real database, satisfies **AC-11**, **AC-12**, **AC-15**.
12. Per line delivery dates: `receiptDate` and `handedOverAt` on the line status route, with a regression spec, satisfies **AC-12**.
13. Seller panel: the group header block, the `Hand over` control, the confirmation dialog, the busy state, the code keyed refusals, the action map pickup case and its parity test, satisfies **AC-13**, **AC-14**.
14. Locks and the walk: `pnpm quality-gate`, then the steps of `verify.md` on the running stack, satisfies **AC-15**, **AC-16**.

## Migration plan

**Strategy**: big bang, ordered inside one migration file, safe to deploy in one step because the deployable stack runs the `migrate` one shot before any service boots.

**Phases** (the file is created from the repo root with `pnpm prisma:migrate:dev` and lands in `packages/Astrum-db/prisma/migrations/`; `apps/api-astrum/prisma` holds a schema copy only and no migrations):

1. `CREATE TABLE "PickupPoint"` with `id` as the primary key, `name` with its unique index, `address`, `"isActive"` defaulting to true and `"createdAt"` defaulting to `CURRENT_TIMESTAMP`.
2. `ALTER TABLE "ShippingMethod" ADD COLUMN "isPickup" boolean NOT NULL DEFAULT false`.
3. `ALTER TABLE "Order"` adds `"pickupPointId"`, `"pickupPointName"`, `"pickupPointAddress"` and `"handedOverAt"` as nullable, and drops `NOT NULL` from `"deliveryAddress"`. Every existing row is valid at once, because nothing becomes required.
4. Add the index on `"pickupPointId"` and the foreign key with `ON DELETE RESTRICT ON UPDATE CASCADE`.
5. `INSERT ... ON CONFLICT (name) DO UPDATE SET price = EXCLUDED.price, currency = EXCLUDED.currency, "isPickup" = true, "isActive" = true` for `Pickup at the shop` at 0.00 RUB, with the id expression of AC-1. A database that already holds a row with that name keeps its id and takes the price and the flag; every other method row is untouched.
6. Regenerate all four clients and rebuild every app before the services boot.

**Rollback**: `UPDATE "Order" SET "deliveryAddress" = COALESCE("pickupPointAddress", '') WHERE "deliveryAddress" IS NULL`, then restore `NOT NULL` on the column, then drop the foreign key, the index, the four `Order` columns and the table, then switch the seeded method off through `"isActive" = false` rather than deleting it, because an order that names a method blocks its deletion under the rule spec 0009 set, and only then drop `isPickup`. The down migration loses the pickup destination and the handover dates of every pickup order, and a database rolled back under a running storefront bundle would read a pickup order as a courier order with an empty address, so code and schema roll back together.

**Risks**:

- The `ALTER TABLE "Order"` takes an exclusive lock. The table holds tens of rows here, so the lock is momentary; a shop at scale would split the nullable add and the constraint work across two releases, which this stack does not need yet.
- A gateway instance that boots before the migration finishes would fail on the missing columns. The deployable stack runs `migrate` before any service boots, so the window does not exist there; a rolling deploy of the gateway alone would need the schema first.
- An operator who already created a method named `Pickup at the shop` with a price gets it re priced to 0.00 and switched on. The name is the key, so the collision is visible in the migration output rather than silent.
- No pickup point row exists after the migration, so the checkout shows the pickup method disabled until the operator runs the script. That is the intended empty state, not a defect.

## Consequences

**Positive**:

- An order can finally be closed: `DELIVERED` becomes reachable through a collection, and the customer screen says where and when.
- The point history is a snapshot, so a rename or a closure never rewrites a placed order, which follows the rule spec 0009 set for the delivery method.
- Opening or closing a collection point is an operational row change, with no deploy and no migration.
- The line `receiptDate`, idle since the schema was written, finally has a writer, and `handedOverAt` gives the order one date instead of a client side calculation.
- A multi business order still fits one platform point, because the point belongs to the shop and not to a seller.

**Negative and tradeoffs**:

- The point belongs to Astrum, but no operator role exists, so the seller marks a handover at a place the seller does not staff. It is the honest compromise for this slice and the rationale records why; an operator surface is the follow-up.
- A partial handover leaves the order without `handedOverAt` until the last line moves, so a half collected order shows no order level date.
- Nothing tells the customer that the parcel reached the point or that it was handed over; a notification needs the events and the worker of spec 0005 and is not in this slice.
- No pickup code, so the handover trusts whoever stands at the counter with the order id. A short code is a follow-up, not a claim of this spec.
- `deliveryAddress` is nullable now, so every future reader and writer of an order must handle the empty case.
- A point carries no city, no hours and no phone, so the checkout lists every active point with no filter, and the customer reads an address only.
- Four schema copies move together, and the trimmed auth and worker copies gain a model they never read.
- The shipping read answer grows one field, so the four field list of spec 0009, AC-4 is amended and a client that pinned the exact shape takes the new field.
- The checkout refusal map grows from three codes to seven, and the seller refusal map from six to nine, so both grow a branch.

**Neutral**:

- The pickup method is a `ShippingMethod` row, so the checkout, the money block and the seller snapshot all keep working without a special case.
- The workflow tag is Beta, so `/check verify` and a test pass follow the build.
- `Order.handedOverAt` is written for every order, pickup or courier, which makes the column mean one thing everywhere.
- An order placed on the method before it carried `isPickup` has no point, and every surface keys on `pickupPointId`, so such an order renders and behaves exactly as it did before this change.

## Follow-up

- [ ] An operator surface: an account flag for pickup point staff, a collection screen keyed by order id, and the points management screen. The seller handover of this spec is the temporary holder of that job.
- [ ] A pickup code on the order that the customer shows at the point, with a short lived value and a log line on every failed attempt.
- [ ] A notification when the parcel reaches the point, and one when it is handed over, built on the events and the worker of spec 0005.
- [ ] A city or an area on `PickupPoint` and a filter in the checkout, once the shop runs more than one city.
- [ ] Opening hours, a phone and a map link on the point card.
- [ ] A per seller point for a multi business order, if the shop ever lets each seller choose where the customer collects.
- [ ] The partially handed over order: decide whether the customer screen should show a line level date when the order has no `handedOverAt` yet.
- [ ] The seller sees no buyer contact at all. A phone for the collection moment is its own decision, with its own personal data note.
- [ ] `PickupPoint` rows have no address normalisation, so two rows can name one address. The operator script refuses an exact duplicate name only.
- [ ] Spec 0009, AC-4 lists four fields for the methods answer; this spec amends it to five. `/sync` reconciles the older line when it next runs.
- [ ] The scope row of feature 7 carries the `Done when` seed written before this design; it stays accurate, so no correction is owed.
