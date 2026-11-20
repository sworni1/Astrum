# 0031. Issue the order after delivery

**Date**: 2026-11-20
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

Today the parcel is declared finished the moment a member of staff hands it over: the point worker and the courier write `DELIVERED` and nothing comes after it. This spec makes delivery happen by itself, after the same one minute wait the shipping pass already uses, and gives the counter the only human end of the flow: it writes a new status, `ISSUED` («Выдано»). The review gate then needs a parcel that was actually handed over, and the seller earns his money only at that press. A buyer therefore reads four moments on the rail, then the fifth when the parcel leaves the counter.

## Requirements

**User stories**:

- As a buyer, I want to see that my parcel has arrived and then that it was issued, so that I know the difference between «on its way», «waiting for me» and «in my hands».
- As a point worker or a courier, I want the queue to hold only parcels that are already here, so that the one press I can make always succeeds.
- As a seller, I want a sale to count as revenue when the parcel is handed over, so that my numbers match what I actually sold.
- As the person running the demo, I want no human to write «delivered», so that the timeline matches a real shop.

**Acceptance criteria** (the contract):

- **AC-1**: `ISSUED` exists in both enums, in the one schema, with its migration. `OrderStatus` reads `PENDING, CONFIRMED, SHIPPED, DELIVERED, ISSUED, CANCELED`; `OrderItemStatus` gains `ISSUED` after `DELIVERED`. `find . -name '*.prisma' -not -path '*/node_modules/*' -not -path '*/generated/*'` prints exactly `./packages/Astrum-db/prisma/schema.prisma` (measured 2026-11-20: one file; the scope line that says «every schema copy» is stale, spec 0030 deleted the other three). The order ranks after `DELIVERED`: `apps/api-astrum/src/modules/order/order-status.helpers.ts` gains `ISSUED` in `ACTIVE_LINE_STATUSES`, maps it to itself in `ORDER_STATUS_BY_LINE_STATUS`, and `ORDER_STATUS_PRIORITY` reads `PENDING 0, CONFIRMED 1, SHIPPED 2, DELIVERED 3, ISSUED 4, CANCELED 5`. So `recomputeOrderStatus` answers `ISSUED` only when every active line reads `ISSUED`, and `DELIVERED` while any active line still reads `DELIVERED`. The storefront enum mirror `apps/customer/src/common/types/order.types.ts` carries `ISSUED = "ISSUED"` in `OrderStatus` and in `OrderItemStatus`.

- **AC-2**: Delivery happens by itself and no human writes `DELIVERED`. `Order` gains `shippedAt DateTime?`, written by the shipping pass in the same transaction that moves the lines to `SHIPPED`. `apps/api-astrum/src/modules/order/order-shipping.ts` runs two stages in one tick, `ORDER_SHIPPING_INTERVAL_MS` (60 000 ms) apart: stage one keeps today's behaviour (`CONFIRMED` lines of an order accepted at least `ORDER_SHIPPING_DELAY_MS` ago become `SHIPPED`, then `recomputeOrderStatus`), stage two takes orders that read `SHIPPED`, hold at least one `SHIPPED` line and whose `shippedAt` is at least `ORDER_SHIPPING_DELAY_MS` old, and moves those lines to `DELIVERED` with one server timestamp written into `receiptDate`, then `recomputeOrderStatus`. Both stages take `ORDER_SHIPPING_BATCH` orders, oldest first, and each order in its own transaction that names only the status it moves, so two replicas ticking together write nothing twice. `grep -n deliveryDate apps/api-astrum/src/modules/order/order-shipping.ts` prints nothing: the wait reads `shippedAt`, never the day the buyer picked. `grep -rn 'status: "DELIVERED"' apps/api-astrum/src/modules/staff apps/api-astrum/src/modules/order/order.service.ts` prints nothing, so neither counter nor the order service writes that status any more, and the one writer left is the second stage of `order-shipping.ts`.

- **AC-3**: The counter writes `ISSUED`, and the refusal order is fixed. Both handover paths (`PATCH /api/staff/point/orders/:orderId/handover` and `PATCH /api/staff/courier/orders/:orderId/handover`) answer, in this order, under the order lock and inside one transaction: `409 ALREADY_HANDED_OVER` when `handedOverAt` is already set, then `409 ORDER_NOT_DELIVERED` when `order.status !== "DELIVERED"`, then they move every `DELIVERED` line to `ISSUED`, run `recomputeOrderStatus`, and stamp `handedOverAt` with the same server `timestamp` only when the recomputed order status reads `ISSUED` (the update names `handedOverAt: null` so a second press stamps nothing). `receiptDate` is no longer written here: it now means arrival (AC-2). The helper `deliverShippedLines` in `apps/api-astrum/src/modules/staff/staff-order.helpers.ts` becomes `issueDeliveredLines` (same file, `DELIVERED → ISSUED`, no date write) and answers the number of lines it moved, which the log line `staff.point.handed_over` and `staff.courier.handed_over` records as `issuedLineCount`. At the courier a parcel the caller does not hold answers `404` before the status is read, so `ORDER_NOT_DELIVERED` on that route is a race guard rather than a branch the flow walks, and it is proved by seeding a row (a claim accepts `DELIVERED` only, AC-4).

- **AC-4**: Both counters show only parcels that have arrived. `listPointOrders` reads `{ pickupPointId, status: "DELIVERED" }` (today `SHIPPED`), and the courier read reads the pool as `{ status: "DELIVERED", shippingMethod: { isPickup: false }, courierUserId: null }` with `scope=mine` as `{ status: "DELIVERED", courierUserId: userId }`. `classifyCourierOrder` in `apps/api-astrum/src/modules/staff/courier-order.service.ts` answers `free` and `claimedByCaller` on `DELIVERED` (today `SHIPPED`) and `notDelivered` on anything else, so a claim on a parcel that is still on its way answers `409 ORDER_NOT_DELIVERED`. A counter parcel still answers `404` to a courier, and another point's parcel still answers `404` to a counter.

- **AC-5**: An issued parcel can no longer be cancelled, and the counter may cancel a parcel that has arrived. `CANCELLABLE_STATUSES` in `apps/api-astrum/src/modules/staff/staff-order.helpers.ts` reads `PENDING, CONFIRMED, SHIPPED, DELIVERED`. The cancel path of both counters replaces its `order.status !== "SHIPPED"` guard with `order.status !== "DELIVERED"` and answers `409 ORDER_NOT_DELIVERED` otherwise, so a buyer who changes their mind next to the parcel cancels a `DELIVERED` line, the stock comes back once and the payment resolves exactly as today (`resolveCancelPayment`). An `ISSUED` line is never cancellable: the counter answers `409 NOTHING_TO_CANCEL` (`CANCELLABLE_STATUSES` excludes it) and no stock moves. The customer cancel adds `ISSUED` to `CUSTOMER_CANCELLATION_BLOCKERS` in `apps/api-astrum/src/modules/order/order.service.ts` (it already holds `SHIPPED` and `DELIVERED`), so `PATCH /api/orders/:orderId/status` with `CANCELED` answers `409 INVALID_STATUS_TRANSITION` on an issued order and returns no stock.

- **AC-6**: Reviews need a parcel that was handed over. `apps/api-astrum/src/modules/reviews/reviews.service.ts` accepts `OrderItemStatus.ISSUED` in place of `DELIVERED` for the purchase proof, and `apps/api-astrum/src/modules/reviews/review-state.ts` reads the eligible line as `status: ISSUED`. The storefront keeps rendering its review control on the server answer `ELIGIBLE`, so no client branch changes: `grep -rn "DELIVERED" apps/customer/src/features/pages/ProductOverview` prints nothing before and after. A `DELIVERED` line that was never issued offers no review: its state reads `NOT_PURCHASED` when the buyer holds no review on that product and `ALREADY_REVIEWED` when one exists (the four `review-check-*` lines land in the second case, AC-12), and a review write for it answers `403 REVIEW_ONLY_AFTER_DELIVERY`.

- **AC-7**: Both catalogues and every label map name the new state. `apps/customer/messages/en.json` and `apps/customer/messages/ru.json` gain `orders.status.issued` (`Issued` / «Выдано») and `orders.itemStatus.issued` (`Issued` / «Выдано»). `apps/customer/src/features/pages/Orders/OrderPage/lib/status.ts` gains `ISSUED` in `StatusLabelKey`, `STATUS_KEYS`, `STATUS_TONES` (`ISSUED` success, `DELIVERED` moves to neutral, because the final good state is now the handover), `DELIVERY_STEPS` (five steps: `PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `ISSUED`), `DELIVERY_PROGRESS` (`0, 25, 50, 75, 100`) and `statusStepIndex` (`0..4`). `apps/customer/src/common/helpers/itemStatus.ts` gains `issued` and narrows `ITEM_STATUS_KEYS` from `Record<string, ItemStatusKey>` to `Record<OrderItemStatus, ItemStatusKey>`, `apps/customer/src/features/pages/Orders/OrderPage/lib/status.ts` turns `statusStepIndex` into a `Record<OrderStatus, number>` table with `CANCELED: -1` written out and no `default` branch, `apps/customer/src/features/pages/Orders/lib/lineState.ts` gains `ISSUED` with the success dot, and `apps/customer/src/features/pages/SellerOrders/lib/status.ts` gains `ISSUED` in `BADGE_TONE` as `success` (`DELIVERED` moves to `secondary`, so one green badge means handed over). Narrowing the two loose tables is half the criterion: with `Record<string, …>` and a `default: -1`, a forgotten `issued` compiles and the screen prints the raw word `ISSUED`. `apps/customer/src/features/pages/Orders/components/OrderLineRow/index.tsx` stops printing `line.receiptDate` on a line that reads `ISSUED`, because that date is now the arrival and the issue date belongs to the receiving block (AC-10). `DeliveryProgress` needs no change: it reads `deliverySteps` and `DELIVERY_PROGRESS`. The rail's own test table grows to five steps and five progress widths.

- **AC-8**: The buyer's orders screen counts an issued order under delivered. `countByStatus` in `apps/api-astrum/src/modules/order/order.service.ts` sums `DELIVERED` and `ISSUED` into `delivered`, `orderListWhere` filters the `DELIVERED` wire value as `{ status: { in: ["DELIVERED", "ISSUED"] } }`, and the wire values stay `ALL`, `DELIVERED`, `CANCELED` in `ORDER_LIST_STATUSES`, so no client constant moves. The spent total gains `ISSUED` beside `DELIVERED` in its `OR` clause (`order.service.ts:516`), because a cash parcel issued at the counter keeps `paymentStatus = PENDING` (the point handover never recorded money) and would otherwise drop out of «потрачено». Measured today: 21 `DELIVERED` orders, so the tile changes for every one of them after the migration.

- **AC-9**: The seller's screen counts and earns on an issued line. `apps/api-astrum/src/modules/order/seller-order.service.ts` folds `ISSUED` into `counts.delivered` and computes `toStats` (revenue and units) over `DELIVERED` and `ISSUED` lines, and `apps/api-astrum/src/modules/order/seller-order-query.ts` filters the `DELIVERED` tab as `{ status: { in: ["DELIVERED", "ISSUED"] } }`. `apps/customer/src/features/pages/SellerOrders/lib/status.ts` keeps its two bucket tabs, so the tab, its count and the revenue tile cannot disagree.

- **AC-10**: The receiving block prints three moments, from three named sources. `apps/customer/src/features/pages/Orders/OrderPage/components/OrderReceivingCard/index.tsx` prints `expectedOn` with `order.deliveryDate` while the order has not arrived (`status` before `DELIVERED`, no `handedOverAt`), `deliveredOn` with the arrival date once it has arrived, and `handedOverOn` with `order.handedOverAt` once it was issued. The arrival date comes from the earliest non null `receiptDate` among the order's lines on the detail read (`GET /api/orders/:orderId` includes every line, and `ORDER_DETAIL_INCLUDE` sets no `orderBy`, so the block picks the value rather than the first row), because the pass writes one timestamp for all of them; the order carries no arrival column and none is added. Both catalogues carry `orders.deliveredOn` (`Delivered {date}` / «Доставлено {date}»). A cancelled order still never reaches this block.

- **AC-11**: The refusal for «not here yet» says what it means. `STAFF_ERROR_CODES.orderNotShipped` becomes `orderNotDelivered` with the value `ORDER_NOT_DELIVERED` in `apps/api-astrum/src/modules/staff/constants/staff.constants.ts`, its prose reads `This order is not delivered yet.`, and `ORDER_NOT_SHIPPED` disappears from the gateway. Both storefront refusal maps move their entry: `apps/customer/src/features/pages/PointWorkspace/lib/refusals.ts` and `apps/customer/src/features/pages/CourierWorkspace/lib/refusals.ts` key `ORDER_NOT_DELIVERED`, and both catalogues rename the copy key `notShipped` to `notDelivered` under `staff.point.queue.refusals` and `staff.courier.queue.refusals`, whose text today reads «Заказ ещё не отмечен как отправленный.» and becomes «Заказ ещё не доставлен.» (`This order is not delivered yet.`), so `grep -n "notShipped" apps/customer/messages/*.json` prints nothing.

- **AC-12**: The migration carries today's history into the new machine, and the change is honest about what it leaves behind. In the same migration that adds the values and `shippedAt`: every `DELIVERED` line of an order whose `handedOverAt` is set becomes `ISSUED` (measured 2026-11-20: 27 lines in 18 orders), every `SHIPPED` order gets `shippedAt = updatedAt` (2 orders, approximate by one write), and nothing else moves, so 10 `DELIVERED` lines in 3 orders stay `DELIVERED` as parcels that arrived and were never handed over. The 6 existing reviews keep their rows and their links: the gate governs new writes only, so a review written before the change stands on a line that now reads `ISSUED` or, for the four lines named `review-check-*`, on a line that still reads `DELIVERED`. Because of that, those four lines no longer offer a review on the product screen, and the verification pass walks a fresh order through the flow instead of claiming a fixture. The same migration fixes the parent rows, because a line moved without its order leaves 18 already handed over parcels inside the point queue where their only possible answer is `409 ALREADY_HANDED_OVER`: `UPDATE "Order" SET status='ISSUED' WHERE "handedOverAt" IS NOT NULL`. One concession is accepted and named: those 18 orders keep the `receiptDate` the old press wrote, so for them arrival and issue are the same moment.

- **AC-13**: Two presses and two replicas stay safe. A second handover answers `409 ALREADY_HANDED_OVER` and moves no line and no stock. Two replicas running the delivery pass on the same order keep the invariant that each stage names only one source status, so the second run finds nothing to move and logs nothing. Two workers pressing handover on different replicas at once answer one `200` and one `409` (the order lock plus the `handedOverAt: null` guard), and the parcel holds one `handedOverAt`.

## Decision

**Chosen option**: Option 1: make `ISSUED` the end of the machine, delivered by the pass, and move every gate that reads `DELIVERED` onto it.

The order walks `PENDING → CONFIRMED → SHIPPED → DELIVERED → ISSUED`, where the pass writes the fourth step after `ORDER_SHIPPING_DELAY_MS` from `shippedAt` and only a counter press writes the fifth. Every place that treats `DELIVERED` as «this parcel is mine now» (review eligibility, the seller's revenue, the cancelled order guard) moves to `ISSUED`; every place that treats it as a bucket the buyer reads (the delivered tab, the receiving block) folds both values in.

**Implementation skills**: `astrum-monorepo` (`sworni1/Astrum`, `C:/Users/ADMIN/AppData/Local/hermes/skills/astrum-monorepo/`, a profile skill rather than a repo one)

## Feature design

**Data model sketch**:

| Change | Where | Detail |
|---|---|---|
| `OrderStatus` gains `ISSUED` | `packages/Astrum-db/prisma/schema.prisma` | placed between `DELIVERED` and `CANCELED`; the storefront enum mirror follows |
| `OrderItemStatus` gains `ISSUED` | same file | placed after `DELIVERED`, before `RETURNED` |
| `shippedAt DateTime?` | `model Order` | nullable, written by the delivery pass stage one; today's 2 `SHIPPED` orders are backfilled from `updatedAt` |
| no other column | | `handedOverAt` keeps its name and now means «issued at»; `receiptDate` keeps its name and now means «arrived at» |

**State transitions**:

```
Order and each active line:
PENDING ──payment/creation──> CONFIRMED ──pass, accept + 60s──> SHIPPED
SHIPPED ──pass, shippedAt + 60s──> DELIVERED        (receiptDate = one server time)
DELIVERED ──counter press──> ISSUED                 (handedOverAt = one server time)
DELIVERED ──counter cancel──> CANCELLED             (stock back once, payment resolves)
ISSUED ──(nothing)──                                (no cancel, no stock)
Order status = the lowest ranked active line status (ISSUED rank 4, DELIVERED rank 3)
```

**API surface**: no new endpoint, five changed answers. The detail read and the create answer publish the new `Order.shippedAt` through the row spread in `toOrderDetail`, so the storefront `Order` interface declares `shippedAt: string | null` beside `handedOverAt`; nothing else about their shape moves.

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/staff/point/orders/:orderId/handover` | PATCH | order id from the path, point from the session | order with `status: ISSUED`, lines `ISSUED`, `handedOverAt` | point worker, active account | 404 not at this point, 409 `ALREADY_HANDED_OVER`, 409 `ORDER_NOT_DELIVERED`, 409 `PICKUP_POINT_INACTIVE` |
| `/staff/point/orders/:orderId/cancel` | PATCH | order id from the path | order with cancelled lines, stock back | point worker, active account | 409 `ORDER_NOT_DELIVERED`, 409 `NOTHING_TO_CANCEL` (an issued order), 409 `PICKUP_POINT_INACTIVE` |
| `/staff/courier/orders/:orderId/handover` | PATCH | order id from the path, courier from the session | order with `status: ISSUED`, money collected when the method collects at the door | courier, active account | 404 foreign or counter parcel, 409 `ALREADY_HANDED_OVER`, 409 `ORDER_NOT_DELIVERED` |
| `/staff/courier/orders/:orderId/claim` | POST | order id from the path | order claimed by the caller | courier, active account | 409 `ALREADY_CLAIMED`, 409 `ORDER_NOT_DELIVERED` |
| `/orders`, `/seller/orders`, `/products/:id/reviews` | GET, POST | `status` wire value | `delivered` bucket and revenue count `ISSUED`; the review proof needs `ISSUED` | session, seller, buyer | 403 `REVIEW_ONLY_AFTER_DELIVERY` on a line that never issued |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| stage one of the pass | the moment a parcel became `SHIPPED` | server `new Date()` written into `Order.shippedAt` in the same transaction |
| stage two of the pass | arrival time on every line | one server `new Date()`, written into `OrderItem.receiptDate` for all moved lines |
| handover | issue time | one server `new Date()`, written into `Order.handedOverAt` under the lock (AC-3) |
| handover | number of lines issued | the `count` returned by the `updateMany` over `DELIVERED` lines, logged as `issuedLineCount` |
| order row status | `ISSUED` or `DELIVERED` | `recomputeOrderStatus` over the active line statuses and `ORDER_STATUS_PRIORITY` |
| receiving block, before arrival | promised day | `Order.deliveryDate`, written at checkout, never read by the pass |
| receiving block, after arrival | arrived date | `receiptDate` of the first line of the detail read (`GET /api/orders/:orderId`) |
| receiving block, after issue | issued date | `Order.handedOverAt` |
| orders tab, delivered bucket | count and filter | `groupBy(status)` folded by `countByStatus`, `orderListWhere` |
| spent tile | amount | `paymentStatus: PAID` or `status` in `DELIVERED` and `ISSUED` |
| seller revenue and units | money | lines in `DELIVERED` and `ISSUED` with `paymentStatus` as today |
| every label | copy | `orders.status.<key>` and `orders.itemStatus.<key>` in both catalogues |

**Key invariants**:

- `ISSUED` is terminal: no route, pass, sweep or cancel writes anything after it. The payment sweep keeps its `status: { in: [PENDING, CONFIRMED] }` filter, so an issued cash parcel that still reads `PENDING` is never closed by it.
- Every active line of an order shares one `receiptDate` (arrival) and one `handedOverAt` (issue), because both are written once per order under the lock.
- An order reads `ISSUED` only when every active line does; a mixed order (one line cancelled at the counter, another issued) reads the lowest ranked active one.
- `DELIVERED` is written by the delivery pass alone. A grep for the status as a writer lists `order-shipping.ts` and nothing else.

**Security model**: unchanged. A point worker reads and writes only the parcels of the point the role guard resolved, and another point's parcel answers `404`; a courier reads the pool (arrived, unclaimed, not a pickup point), his own claims, and writes only his own; a buyer reads only their own orders and reviews, and the review proof still comes from their own line (`orderItemId` inside `userId`). No new surface is public.

**Configuration required**: none. `ORDER_SHIPPING_DELAY_MS`, `ORDER_SHIPPING_INTERVAL_MS` and `ORDER_SHIPPING_BATCH` keep their values, so the timeline stays 60 to 120 seconds per stage.

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: an order is created, confirmed, shipped by the pass, delivered by the pass one minute later, then issued by a counter press, and the buyer's screen walks five steps to «Выдано», verifies **AC-1**, **AC-2**, **AC-3**, **AC-7**.
- Failure case: handover pressed on a `SHIPPED` order answers `409 ORDER_NOT_DELIVERED` and writes nothing; pressed twice answers `409 ALREADY_HANDED_OVER`, verifies **AC-3**, **AC-13**.
- Failure case: a cancel pressed on an `ISSUED` order answers `409 NOTHING_TO_CANCEL` at the counter and `409 INVALID_STATUS_TRANSITION` from the buyer, with the stock unchanged, verifies **AC-5**.
- Read case: the delivered tab and the seller's revenue both count an issued order, verifies **AC-8**, **AC-9**.
- Review case: an `ISSUED` line offers a review and a `DELIVERED` line does not, verifies **AC-6**.
- Copy case: both catalogues carry `issued` for the order and the line, and the refusal key reads «не доставлен», verifies **AC-7**, **AC-11**.
- Concurrency case: two delivery passes and two handovers racing write one timestamp each, verifies **AC-13**.

## Build plan

Sliced as one thin thread through every layer (the project's build approach), so the flow is walkable in the demo after slice three.

1. **Migration**: add `ISSUED` to both enums and `shippedAt` to `Order`; backfill `shippedAt = updatedAt` for the 2 `SHIPPED` orders and move the 27 `DELIVERED` lines of the 18 stamped orders to `ISSUED`. Run `pnpm prisma:migrate:dev`, then `pnpm db:generate`, and check the row counts against AC-12 with `psql`, satisfies **AC-1**, **AC-2**, **AC-12**. — done: migration `20261120120034_issue_the_order_after_delivery` applied, `pg_enum` lists `ISSUED` in both types, `Order.shippedAt` is nullable, the backfill moved 27 lines in 18 orders and stamped the 2 `SHIPPED` orders
2. **Status machine**: `order-status.helpers.ts` gains the status, the map entry and the renumbered priority; the storefront enums gain it too. Suites: `order-status.helpers.spec.ts` grows a five case table, satisfies **AC-1**. — done: `order-status.helpers.ts` and the storefront enums carry `ISSUED`, `order-status.helpers.spec.ts` green
3. **Delivery pass**: `order-shipping.ts` writes `shippedAt` in stage one and gains stage two `deliverArrivedOrders` with its `receiptDate` write and its log line; `runOrderShipping` runs both stages in one tick. Suite: `order-shipping.spec.ts` gains the second stage, the wait from `shippedAt` and the racing replica case, satisfies **AC-2**. — done: `deliverArrivedOrders` plus the `shippedAt` write and the second replica case in `order-shipping.spec.ts`
4. **Handover**: `issueDeliveredLines` replaces `deliverShippedLines`, both services move their guard to `DELIVERED`, add `ORDER_NOT_DELIVERED` and stamp `handedOverAt` on `ISSUED`; the constants file renames the code. Suites: `point-order.service.spec.ts`, `courier-order.service.spec.ts`, `point-handover.integration.spec.ts`, `courier-order.integration.spec.ts`, satisfies **AC-3**, **AC-11**. — done: `issueDeliveredLines`, both guards read `DELIVERED`, `ORDER_NOT_DELIVERED` replaces `ORDER_NOT_SHIPPED`, `issuedLineCount` in both log lines
5. **Counters read arrived parcels**: point list and courier list, `classifyCourierOrder`, the claim guard. Suites: the two service specs plus `courierOrders.test.tsx` and `pointOrders.test.tsx` on the storefront, satisfies **AC-4**. — done: both queues read `DELIVERED`, `classifyCourierOrder` answers `notDelivered` on anything else
6. **Cancel rule**: `CANCELLABLE_STATUSES` gains `DELIVERED`, both cancel paths move their guard, `CUSTOMER_CANCELLATION_BLOCKERS` gains `ISSUED`. Suites: the two staff specs and `order.service.spec.ts`, satisfies **AC-5**. — done: `CANCELLABLE_STATUSES` carries `DELIVERED`, both cancel guards read `DELIVERED`, `CUSTOMER_CANCELLATION_BLOCKERS` carries `ISSUED`
7. **Review gate**: `reviews.service.ts` and `review-state.ts` read `ISSUED`. Suites: `review-state.spec.ts`, `reviews.service.spec.ts`, satisfies **AC-6**. — done: both reads require `ISSUED`, the refusal case now seeds an arrived line
8. **Gateway reads**: `countByStatus`, `orderListWhere`, the spent `OR`, the seller counts, `toStats` and `sellerOrderWhere`. Suites: `order-list-query.spec.ts`, `order.service.spec.ts`, `seller-order-query.spec.ts`, `seller-order.service.spec.ts`, satisfies **AC-8**, **AC-9**. — done: the delivered bucket and the seller counts fold `ISSUED`, the spent `OR` clause carries it, `toStats` covers both states
9. **Storefront labels and rail**: both catalogues, `status.ts` (labels, tones, five steps, the tightened step index), `itemStatus.ts`, `lineState.ts`, `SellerOrders/lib/status.ts`, `OrderLineRow` (the arrival date leaves an issued line), the client `Order` type, the two refusal maps, the receiving block. Suites: `status.test.ts`, `lineState.test.ts`, `tabs.test.ts`, `DeliveryProgress/__tests__`, `OrderPageHeader/__tests__`, `refusals.test.ts` on both workspaces, `SellerOrders/__tests__`, satisfies **AC-7**, **AC-10**, **AC-11**. — done: both catalogues, five step rail at 0/25/50/75/100, narrowing of `ITEM_STATUS_KEYS` and `statusStepIndex`, `receivingMoment` in `OrderPage/lib/moments.ts`, both refusal maps
10. **Gates and live pass**: `pnpm quality-gate`, then the steps in [verify.md](verify.md) on the dev stack, walking one fresh order from checkout to «Выдано» and finishing with a review on a line the flow issued, satisfies **AC-1** to **AC-13**.

## Consequences

**Positive**:

- The machine matches a shop: the buyer reads «доставлен» when the parcel is at the counter and «выдано» when it leaves, and the rail shows the step that actually happened.
- No human writes the arrival, so a demo cannot skip a stage and the numbers of the seller follow the counter rather than a page press.
- One status carries every «this parcel is mine» rule (review, revenue, cancel), so a later rule has one place to read.

**Negative / tradeoffs**:

- Two statuses now read as good news to a buyer, so the greeting copy and the tone tables carry two states instead of one (AC-7).
- Between `SHIPPED` and `DELIVERED` the parcel is visible to nobody at the counter (60 to 120 seconds in this project), because the queue shows arrived parcels only. The alternative, listing both with a disabled button, was rejected as a screen that mostly shows a control nobody may press.
- The seller loses a sale from revenue until a worker presses, so a forgotten parcel sits in the queue and outside the numbers. That is the point, and it needs the queue to be watched.
- The wait grows from one stage to two, so the full timeline of an accepted order is 120 to 240 seconds in the demo, which a test that walks the flow end to end must budget for.

**Neutral**:

- `handedOverAt` and `receiptDate` keep their names while their meaning narrows to «issued» and «arrived». Renaming them would touch four reads and the seller's own panel for no behaviour change, so the spec keeps the names and states the meaning here.
- The four `review-check-*` lines that stay `DELIVERED` no longer offer a review, which is a fixture consequence of the migration rather than a defect.
- `deliveryDate` stays required at checkout and becomes a promise the buyer reads only before arrival.

## Migration plan

**Strategy**: one migration, run with the gateway stopped, and deployed in the same commit as the code, because a value that only this build writes must never meet the build that does not know it.

**Phases**:
1. The migration adds `ISSUED` to both enums, adds `Order.shippedAt` as nullable, sets `shippedAt = updatedAt` for every order that reads `SHIPPED`, and moves the `DELIVERED` lines of every order with a non null `handedOverAt` to `ISSUED`. Postgres accepts a new enum value without a rewrite of the table, so nothing is locked for long.
2. `pnpm db:generate` and the gateway deploy together: the new code reads `ISSUED`, which the schema now has.
3. The first tick of the shipping pass runs the second stage against the 2 orders that were already shipped, which is also the proof that the stage is wired: each of them becomes `DELIVERED` within 60 to 120 seconds of the deploy.

**Rollback**: the code reverts with one commit. The data does not: a revert leaves rows reading `ISSUED` that the old code cannot name, so the rollback statement is the mirrored `UPDATE "OrderItem" SET status='DELIVERED' WHERE status='ISSUED'` plus `ALTER TABLE "Order" DROP COLUMN "shippedAt"`, run in the same transaction as the revert. Postgres cannot remove a value from an enum, so the two values stay in the type and harm nothing while unused.

**Risks**: the dangerous order is old code after the data move, not a concurrent press. `recomputeOrderStatus` in the running gateway filters the line statuses it knows, so a replica that meets a line reading `ISSUED` drops it as inactive and recomputes its order to `CANCELED`, which cancels a parcel the buyer already holds. So the dev stack stops the api before `pnpm prisma:migrate:dev` and restarts it after, while `pnpm docker:prod:*` already runs the one shot `migrate` service before any gateway starts. In the other direction a handover landing during the migration rewrites one line at most, and the `handedOverAt: null` guard keeps the stamp single. The `shippedAt` backfill copies the last write rather than the shipping moment, which Follow-up names.

## Follow-up

- [ ] Nothing watches a parcel that arrived and was never issued: it earns the seller nothing and stays unreviewable until a worker presses. Today 3 orders and 10 lines sit in exactly that state. One signal would close the blind spot (a count in the point queue header, or an `order.unissued_overdue` line from the second stage); this spec deliberately ships without it and says so here.
- [ ] The point handover records no money: a cash parcel issued at the counter keeps `paymentStatus = PENDING` while the courier path marks it `PAID` through `collectsAtTheDoor`. The spent tile covers it through the `ISSUED` clause, but the asymmetry belongs in a money spec.
- [ ] `packages/Astrum-db/AGENTS.md` still says `apps/api-astrum`, `apps/auth-astrum` and `apps/worker` each carry a `prisma/schema.prisma` that must stay byte identical, and spec 0030 deleted all three. Correct it in `/sync`.
- [ ] The `shippedAt` backfill for today's 2 `SHIPPED` orders copies `updatedAt`, which is the last write rather than the shipping moment. Acceptable for demo rows; a production migration would need an explicit mapping.
- [ ] When the review screen is demonstrated again, move the three `review-check-order-1` lines and the fourth line on `cmw25deon00003wvdd87kni5m` to `ISSUED`, otherwise the product screen offers no review on a database that looks full.
- [x] The `astrum-monorepo` skill's `references/verifying-the-live-api.md` states two preconditions this spec changes: a review needs a `DELIVERED` line, and a counter cancel answers `ORDER_NOT_SHIPPED`. Both become `ISSUED` and `ORDER_NOT_DELIVERED` respectively, so that table needs an edit once this build lands. — done: both rows of the precondition table rewritten, the review fixture now seeds an `ISSUED` line and the cancel fixture a `DELIVERED` order with `receiptDate`

## Rationale

Reasoning, the rejected options and the measured evidence: see [rationale.md](rationale.md).

