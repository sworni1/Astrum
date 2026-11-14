# 0020. Read only seller panel

**Date**: 2026-11-14
**Status**: In Progress

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

A parcel is handed over at the collection point or by a courier now, so the seller keeps sight of their own orders and loses every action. The panel becomes one table of five columns (order number, product, price, placed date, line status), with the facts of each order in a band above its lines. The two routes that let a shop owner move a line or close a parcel are removed and answer a typed refusal, and every file that existed only to send those actions goes with them. The database schema does not change, and the seller read keeps the shape it has today.

## Requirements

**User stories**:

- As a seller, I want one table of my order lines with their status, so that I can watch what the shop still owes me without opening every card.
- As a seller, I want to see where each parcel goes and when it was handed over, so that I can answer a buyer without a database console.
- As the shop, I want the seller panel to hold no authority at all, so that the point worker and the courier are the only hands that close a parcel.

**Acceptance criteria** (the contract):

- **AC-1**: `/seller/orders` keeps the page header it has today (`seller.title`, `seller.subtitle` and `seller.found` with `data.total`), then renders one `<table>` inside the storefront content container the page uses today (`mx-auto max-w-screen-xl`, `p-4 md:p-6`), with `aria-label={t("title")}` so the table carries an accessible name. Its `<thead>` carries exactly five `<th scope="col">` labels in this order: `seller.columns.orderNumber` (new key, "Order" and "Заказ"), `seller.columns.product`, `seller.columns.subtotal` (the key and its copies stay as they are, "Subtotal" and "Сумма", because the value is a line sum), `seller.columns.date` (new key, "Date" and "Дата"), `seller.columns.status`. Its `<tbody>` holds one order band (AC-2) followed by one row per line of that order, in the order the API returns. The component tree is `SellerOrders` (composition), `SellerOrderBand` and `SellerOrderRow` (one file each), with `lib/format.ts` and `StateScreen` kept; `SellerOrderLine/` becomes `SellerOrderRow/`, and `lib/grid.ts` goes with the grid it sized.
- **AC-2**: The order band is a row of the same table. Its first cell sits under the order number column and prints `seller.orderNumber` with `order.id.slice(-8)` and `title={order.id}`, the display convention spec 0007, AC-4 set. Its second cell spans the remaining four columns and prints every fact a group header prints today, each only when it has a value, and the cell renders empty when none of them applies: the payment badge when `paymentMethod` is `ONLINE_CARD` and `paymentStatus` is not `PAID`, reading `seller.paymentLabel` with the label `paymentStatusKey` returns, resolved through the `orders.paymentStatus` namespace as the panel does today; the status counts of `countLinesByStatus` as `seller.statusCount` badges; the pickup point name and address when `order.pickupPointId` is not null, with the `MapPin` icon, which is the rule the panel already uses (`SellerOrderGroup/index.tsx:61`) and not the `isPickup` flag of the payload, because the panel prints a point and the two values can differ; the handover date through `seller.handedOverAt` with `dateStyle: "medium"` and `timeZone: browserTimeZone()` when `handedOverAt` is not null. The placed date is the only fact that leaves the band, and it moves to the date column (AC-3).
- **AC-3**: The date cell prints `order.createdAt` through `useFormatter` with `dateStyle: "medium"`, `timeStyle: "short"` and `timeZone: browserTimeZone()`, because the intl request config pins the formatter to UTC. The band prints no date. `Order.deliveryDate` and `OrderItem.receiptDate` are not printed anywhere in the panel.
- **AC-4**: The price cell prints `formatMoney(lineSubtotal(line), line.currency)`, where `lineSubtotal` keeps its rounding to two decimals, and the product cell carries the product thumbnail, its name as a link to `/products/{productId}`, and the quantity as a suffix of the name (`{name} × {quantity}`), so the sum can be checked against what was ordered, and the product cell keeps the two fallbacks the panel has today: the `Package` icon when `previewImage` is empty, and `seller.productFallback` with the product id when `name` is empty. Neither cell uses `toFixed`, a currency symbol in JSX, or `getCurrencyEmoji`.
- **AC-5**: The page offers no control that sends a request. No component of the page imports `useSellerHandover`, `useSellerOrderItemStatus`, `patchItem` or `postItem`, and the table holds no `<button>`. The only interactive controls left are the two pagination buttons, the `Retry` control of the failure screen and the `Open your shop` link of the not a seller screen. The page renders no dialog.
- **AC-6**: Neither the payload nor the page carries a buyer identity. `GET /api/seller/orders` keeps its current select, which reads no `Order.userId` and no `OrderItem.userId`, and the `Order` model holds no buyer name, email or phone column. A gateway test asserts each order object has exactly the keys `id`, `createdAt`, `paymentStatus`, `paymentMethod`, `isPickup`, `pickupPointId`, `pickupPointName`, `pickupPointAddress`, `handedOverAt`, `orderItems`, and each line has exactly `id`, `productId`, `name`, `previewImage`, `quantity`, `price`, `currency`, `status`.
- **AC-7**: The four states of spec 0007, AC-5 and AC-11 keep working and never show two at once: the skeleton with `states.loadingLabel` on the first load; the empty state with `states.emptyTitle` and `states.emptyText` when `total` is 0; the not a seller screen for `403 SELLER_NOT_ASSIGNED`; the failure screen with `states.failureTitle` and a `Retry` control for every other answer, which covers a `500`, a client timeout and any refusal `sellerErrorKind` does not read as `notSeller`; `503 ACCOUNT_STATUS_UNAVAILABLE` cannot come from this read, because `GET /seller/orders` mounts no `requireActiveAccount`, and the failure screen catches it like any other error. A page change keeps the rows of the previous page under a loading strip, and an answer with no rows and `total` above zero requests the last page instead of rendering `Page 3 of 2`. The pending notice and its two catalog keys are gone, because the panel no longer holds a write to withhold, and the `useUser` call and its import go with it, so the page reads no profile at all.
- **AC-8**: At 360 px the table has no horizontal scrolling: the `<thead>` is hidden below `sm`, every row stacks into a card inside its order band, each line value carries a visible label at that width (the label cells that are `sr-only` at `sm` and up become visible below it), and the band prints the labels of its own facts too. At `sm` and above the five column labels sit in a sticky head at the offset the page uses today (`top-16`), with an opaque background so the rows never show through. Every control that remains (pagination buttons, `Retry`, the shop link) is reachable by keyboard, keeps the project `focus-visible` ring and is at least 32 px high.
- **AC-9**: `PATCH /api/seller/orders/:orderId/handover` and `PATCH /api/order-items/:orderItemId/status` answer `404` with the body `{ code: "SELLER_PANEL_READ_ONLY", message: "Seller writes were removed; the panel is read only." }`, for every well formed request that reaches the handler, and they write nothing: no order row, no line row, no stock, no receipt date. Both paths mount one exported handler, `refuseSellerWrite`, in `apps/api-astrum/src/modules/order/seller-order.routes.ts`, inside the existing `app.use("/api", authenticateToken, ...)` chain of `src/app.ts`, so a caller with no session keeps answering `401` from `authenticateToken` before the handler runs. The handler calls `handleErrors(res, new AppError(404, ...))` directly and never throws, because `app.ts` mounts no error middleware and a thrown error would reach the Express default handler and answer HTML; it calls no method of `SellerOrderService` and mounts no `requireActiveAccount` and no `validateDto`. A malformed JSON body is refused by `express.json()` in `src/app.ts` before any router runs and answers the Express default `400`, which no route can change. Each call writes one `logger.warn` line with `event: "seller.write_refused"`, `userId` (from the session, never from the body), `method`, `path` (from `req.originalUrl`, so the query string stays in it as the access log keeps it) and either `orderId` or `orderItemId`, taken from `req.params`; the line carries no body, no cookie and no token. The body of the answer carries no stack and no database detail. The code joins `ORDER_ERROR_CODES` as `sellerPanelReadOnly`.
- **AC-10**: The write machinery is deleted and the read stays. `SellerOrderService` keeps `getSellerOrders`, `countSellerOrders`, `findSellerOrders`, `toSellerOrderGroupJson` and its row type; `handOverOrder`, `runHandover`, `updateSellerOrderItemStatus`, `runStatusTransaction`, `transitionOrderItem`, `applyOrderItemStatus`, `ALLOWED_LINE_TRANSITIONS`, `HANDOVER_READY_STATUSES`, `SellerOrderItemResult`, `SELLER_ORDER_ITEM_SELECT` and the three helper errors (`orderItemNotFound`, `orderNotFound`, `nothingToHandOver`) are gone, and so are the imports that only they used (`lockOrder`, `ORDER_TRANSACTION_OPTIONS`, `recomputeOrderStatus`, `returnOrderStock`, `logger`, `Prisma`, `OrderItemStatus`). `OrderController.handOverOrder` and `OrderController.updateSellerOrderItemStatus` are gone, and `dto/update-order-item-status.dto.ts` with them, so `apps/api-astrum/src/middlewares/__tests__/validateDto.spec.ts` moves its line status fixture from that DTO to the existing `UpdateOrderStatusDto` and keeps its case about an unknown status. The suites `seller-order.transitions.spec.ts`, `seller-order-delivery.spec.ts` and `seller-order-handover.spec.ts` are deleted; the write cases inside `seller-order.service.spec.ts` and `order.controller.spec.ts` are deleted with them; the refusal cases of AC-9 live in `seller-order-access.spec.ts`, which already builds a real Express app around `sellerOrderRoutes` and is the one suite that can prove the mount chain and the answer body; and the read cases of every suite stay. In `pickup-handover.integration.spec.ts` the test named `сериализует выдачу двумя продавцами и пишет дату один раз` is deleted, because its subject is the seller handover, and the same guarantee (two workers racing one handover, one `handedOverAt` and one `receiptDate` per line) is proved by `apps/api-astrum/src/modules/staff/__tests__/point-handover.integration.spec.ts:179`; `seller-order.integration.spec.ts` keeps its read coverage and loses its write coverage.
- **AC-11**: The storefront loses every file and catalog key that only served an action: `hooks/seller/useSellerHandover.ts`, `hooks/seller/useSellerOrderItemStatus.ts` with its test, `features/pages/SellerOrders/lib/actionMap.ts`, `lib/handover.ts`, `lib/pageData.ts`, `lib/refusals.ts` with their tests, `features/pages/SellerOrders/SellerOrderGroup/` as a whole, `features/pages/SellerOrders/SellerOrderLine/` (replaced by `SellerOrderRow/`, which carries no control), and `lib/grid.ts`, while `lib/format.ts` stays. In both `apps/customer/messages/en.json` and `ru.json` the `seller` namespace loses `handover`, `handoverTitle`, `handoverText`, `handoverCourierText`, `handoverConfirm`, `handoverBusy`, `handoverKeep`, the whole `actions` group, the whole `dialog` group, the whole `toasts` group, `columns.quantity`, `columns.unitPrice`, `columns.actions`, `states.pendingTitle` and `states.pendingText`; it gains `columns.orderNumber` and `columns.date`. Both files carry the same `seller` keys after the change, and every key this criterion names is read by nothing left in `apps/customer/src`.
- **AC-12**: The behaviour is covered by tests. Gateway jest, in `seller-order-access.spec.ts`: both refusal paths answer `404` with the code for a session that owns a business, leave the order row and the line row byte identical, answer `401` with no cookie, and write one `seller.write_refused` line carrying the five fields; the seller read keeps its ownership case, its pagination case and its exact key set of AC-6. Storefront vitest: the page renders the five column labels in the order of AC-1; a band prints the order number, the payment badge, the counts, the point and the handover date; the date cell prints the placed date and the band prints none; the price cell prints the rounded line sum; the page carries no control that sends a request and no dialog; the four states render one at a time and the last page fallback works; each cell carries its own label markup for the narrow width; and `apps/customer/src/i18n/__tests__/messages.test.ts` passes with the trimmed catalogs. `pnpm quality-gate` is green.
- **AC-13**: The path is walked on the running stack, with the steps and their output recorded in [verify.md](verify.md): the seller signs in and reads the table with its five column labels; a line sum equals price times quantity; the band prints the point and the handover date; a handover request and a status request sent with the seller cookie answer `404 SELLER_PANEL_READ_ONLY` and change nothing in the database; the gateway log carries one `seller.write_refused` line per call; the page at 360 px scrolls sideways nowhere and keeps its empty, loading and failure states; both languages render with no literal English in Russian.

## Decision

**Chosen option**: Option 1: Delete the write surface, keep one read table.

The seller panel becomes one read only table built from the answer `GET /api/seller/orders` already returns, the two seller write routes answer `404 SELLER_PANEL_READ_ONLY` from one shared handler that logs the attempt, and the whole write machinery (service methods, transition table, DTO, hooks, dialogs, catalog keys) is deleted with them.

Where this spec and an older one disagree, this spec wins: it replaces the actions of spec 0007, AC-6 to AC-10 and the action column of AC-16, the seller handover of spec 0013, AC-13, and the two seller moves of spec 0016, AC-5 and AC-8. Everything else those specs set (the route, the read, the isSeller flag, the navigation entry, the states, the density, the money and date helpers) stays in force.

**Implementation skills**: none consulted. No community skill in this repo covers a storefront table, and the storefront standard in `apps/customer/AGENTS.md` (S1 to S5: one file one job, feature folder shape, placement, money and dates, imports) governs the shape of every file this feature touches.

## Feature design

**Data model sketch**:

Nothing new is persisted and no column changes. The feature reads what specs 0002 and 0013 store, and the four `schema.prisma` copies stay byte identical.

| Entity      | Fields read                                                                          | Notes                                                                |
| ----------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `Order`     | `id`, `createdAt`, `paymentStatus`, `paymentMethod`, `pickupPointName`, `pickupPointAddress`, `handedOverAt`, `shippingMethod.isPickup` | The band of AC-2 reads all of it. `deliveryDate` is not read          |
| `OrderItem` | `id`, `productId`, `name`, `previewImage`, `quantity`, `price`, `currency`, `status` | One row of the table per line. No `userId`, no `orderId`              |
| `Business`  | `id`, `ownerUserId`                                                                  | Scopes the read to the caller's shop and answers `403 SELLER_NOT_ASSIGNED` |

**State transitions**:

The panel has no state machine of its own any more. A line status is read and never written from this surface, and the moves that remain belong to the staff routes of specs 0018 and 0019 (handover and cancel at the point, handover and cancel by the courier) and to the customer cancel of spec 0011.

**API surface**:

| Endpoint                                | Method | Key inputs                          | Key outputs                                                                    | Auth                                     | Key errors                                                            |
| --------------------------------------- | ------ | ----------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------- |
| `/api/seller/orders`                    | GET    | `page`, `limit` (optional, 1 and 20, cap 50) | `orders[]` in the shape of AC-6, `page`, `limit`, `total`, `totalPages` | session cookie, owning business             | `403 SELLER_NOT_ASSIGNED`, `422 VALIDATION`, `401` with no session      |
| `/api/seller/orders/{orderId}/handover` | PATCH  | none (the path is all it accepts)   | nothing                                                                        | session cookie                             | `404 SELLER_PANEL_READ_ONLY`, `401` with no session                     |
| `/api/order-items/{orderItemId}/status` | PATCH  | none (the path is all it accepts)   | nothing                                                                        | session cookie                             | `404 SELLER_PANEL_READ_ONLY`, `401` with no session                     |

**Value sourcing** (every value each surface produces or displays, and where it comes from):

| Action | Value produced or displayed | Source |
|---|---|---|
| The table | the five column labels | `seller.columns.*` in both catalogs (AC-1) |
| The table | one row order, order band first | the order of `findSellerOrders` (`createdAt` descending, `id` ascending) and of its line select (`id` ascending) |
| The band | order number | `Order.id` through `slice(-8)`, spec 0007, AC-4 |
| The band | payment badge | `Order.paymentMethod` and `Order.paymentStatus`, label from `paymentStatusKey` |
| The band | status counts | `countLinesByStatus(order.orderItems)`, a client count over the lines the read returned |
| The band | pickup point name and address | `Order.pickupPointName` and `Order.pickupPointAddress`, printed only when `shippingMethod.isPickup` is true |
| The band | handover date | `Order.handedOverAt`, `null` until a staff handover writes it |
| Product cell | name, thumbnail, quantity, link | `OrderItem.name`, `previewImage`, `quantity`, `productId` |
| Price cell | line sum | `OrderItem.price` times `OrderItem.quantity` through `lineSubtotal` and `formatMoney` |
| Date cell | placed date and time | `Order.createdAt` through `useFormatter` with `browserTimeZone()` |
| Status cell | status label | `OrderItem.status` through `itemStatusKey` and the `orders.itemStatus` catalog |
| The pagination | page, total pages | `page` and `totalPages` of the answer, as spec 0007, AC-5 set |
| The refusal | status and code | the shared handler of AC-9, no value from the request body |

**Key invariants**:

- No seller route writes anything. The only writers of `OrderItem.status` are the staff routes of specs 0018 and 0019, the payment confirmation of spec 0016 and the customer cancel of spec 0011.
- The seller read returns no buyer identifier, no buyer name, no email and no phone, and this is asserted by key set rather than by reading the code.
- The panel sends no write request, so a browser tab holding the new bundle cannot reach a seller write even by mistake.
- The four schema copies stay byte identical (no schema edit in this feature at all).

**Security model**:

The seller read stays behind the `__auth` cookie and the business ownership lookup, and it stays open to a `PENDING` account, because an unconfirmed account browses and is refused on writes (spec 0005). The refusal paths need a session and nothing else: they answer a fixed body and take no input from the request, so there is nothing to authorize and nothing to validate. The staff routes keep their own guards (`requireActiveAccount`, `requirePointWorker`, `requireCourier`) untouched. No compliance scope applies to this feature: the panel reads no personal data at all, which is exactly the property AC-6 pins down.

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: a seller with two orders opens `/seller/orders`, sees one table with the five column labels, a band per order carrying the facts, one row per line with the placed date and the line sum, and no button anywhere, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**.
- Failure case: a handover request and a status request sent with a seller cookie answer `404 SELLER_PANEL_READ_ONLY` and leave both rows untouched, and the log carries one refusal line each, verifies **AC-9**.
- Auth/permission: a request without a cookie answers `401` on both paths before the handler runs, and a `PENDING` seller keeps reading the table, verifies **AC-7**, **AC-9**.
- Payload: the read carries exactly the documented keys, so no later writer can add a buyer field without failing a test, verifies **AC-6**.
- Width: at 360 px every row is a labelled card inside its band with no sideways scrolling, verifies **AC-8**.

## Build plan

Approach: Tracer Bullet, the thin visible thread first and the door closed behind it. The storefront already reads everything the table needs, so slice one is end to end without a single gateway change, and the gateway then stops accepting the writes the panel no longer sends.

1. The read only table in the storefront: one `<table>` with the five columns and the order band, the product cell with the quantity suffix, the line sum in the price column, the placed date in the date column, the four states with the pending notice removed, the narrow width stack, then the deletion of `SellerOrderGroup`, `LineActions`, `dialogCopy` and `lib/handover.ts` with the handover control, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-7**, **AC-8**.
2. The gateway door: the shared refusal handler with its code, its `AppError` and its log line on both paths, then the deletion of the controller methods, the service write methods, the transition table, the DTO and the three write suites, and the rewrite of the two integration fixtures as direct `prisma.orderItem.update` writes, satisfies **AC-9**, **AC-10**.
3. The storefront sweep: delete the two hooks, `actionMap`, `pageData`, `refusals` and their tests, trim both catalogs, add the two new column keys, satisfies **AC-11**.
4. Tests and the gate: the refusal and payload suites on the gateway, the table and state suites on the storefront, the catalog parity run, then `pnpm quality-gate`, satisfies **AC-6**, **AC-12**.
5. The live walk of every step in `verify.md` on the running stack, satisfies **AC-13**.

## Consequences

**Positive**:

- One surface, one authority: a shop owner can no longer close a parcel, and the point worker and the courier are the only hands that do.
- Roughly 300 lines of gateway write code, two client hooks, three lib modules, a component, a dialog and about twenty catalog keys leave the tree.
- A stale tab that still shows the old buttons gets a response in the project shape instead of an HTML page, which a script and an operator can read; the tab's own refusal map never knew this code, so the seller sees its generic failure toast either way.
- The refusal log turns a request that should no longer exist into a signal somebody can look at.

**Negative / tradeoffs**:

- The seller cannot report a damaged or missing item from the panel any more. That move existed since spec 0016 and is gone; today the buyer or the point worker cancels the order instead.
- The delivery date is not shown, because the read does not carry `deliveryDate`. A seller who wants "when must this leave" does not get it here.
- The refusal paths are deliberate dead code: two route paths that will never succeed. They exist for stale clients and for a clear signal, and they need their own removal decision once no stale bundle can be older than one release.
- `seller-order.integration.spec.ts` shrinks to the read and the refusal, and two suites lose their seller write setup, so the point handover races are proven through a fixture that writes the row directly.

**Neutral**:

- No migration, no schema edit, no change to the four schema copies.
- `pnpm quality-gate` runs unchanged; no new dependency and no new environment variable.

## Follow-up

- [ ] The seller has no way to report a line gone (a damaged, missing or returned item) from the panel. If a seller needs it, it is a new decision with its own route, not a revert of this spec.
- [ ] The delivery date is absent from the read only panel because `GET /api/seller/orders` does not select `Order.deliveryDate`. A date column that answers "when must this leave" needs that field added to the read.
- [ ] Spec 0007 (AC-6 to AC-10, and the action column of AC-16), spec 0013 (AC-13) and spec 0016 (AC-5 and AC-8) still describe the seller actions as live. They should carry a one line note pointing here; the status of those specs does not change, so this is an edit `/sync` owns.
- [ ] The two refusal paths should be deleted once no stale storefront bundle can be older than one release. That removal is its own small decision.
- [ ] A 404 handler at the end of `app.ts` would answer every unknown path in the project shape and let both refusal paths be deleted outright. It changes the 404 body of every unknown API path, so it is its own decision; this feature keeps the two refusal paths, because the intent is a log line that names a seller write rather than a generic not found.
- [ ] `apps/customer/src/hooks/order/useUpdateOrderItemStatus.ts` has no importer and targets `/order-items/:orderItemId/status`, which always refuses after this feature; its `UpdateOrderItemStatusDto` type lives at `common/types/order.types.ts:136`. Deleting it is a small cleanup of its own.
- [ ] `docs/scope/_root/scope.md` Deferred still lists "Seller list filter and order status" from spec 0007. This feature does not change it.

## Rationale

Reasoning, the alternatives weighed and the measured state of the code: see [rationale.md](rationale.md).
