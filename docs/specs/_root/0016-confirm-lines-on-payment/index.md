# 0016. Confirm order lines when the order is paid

**Date**: 2026-11-14
**Status**: In Progress

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

Today every order line waits for the seller to press Confirm, so a paid order sits in `PENDING` and the buyer reads no confirmation even after the money left. This decision moves that step to the server, the way a marketplace works: a prepaid order confirms its lines the moment the payment lands, a cash order confirms them when it is placed, and the seller only hands the parcel over or reports that the item is gone. The buyer then reads `CONFIRMED` right after paying, and the platform marks the order sent a minute later, and the platform, not a shop assistant, accepts the order.

## Amendments

**2026-11-14, decided by the owner after the first walk on the running stack.** Two things changed in this decision, both because the project runs no real delivery and has no shop assistant to move a parcel.

1. The paid apply confirms and never ships: a paid prepaid order reads `CONFIRMED` at once, exactly as AC-2 says.
2. A shipping pass in the gateway marks an accepted order sent by itself, one minute after the shop accepted it, so `SHIPPED` stops being a status no route could reach. It is `apps/api-astrum/src/modules/order/order-shipping.ts`, on its own timer started from `server.ts`, and the wait is the single constant `ORDER_SHIPPING_DELAY_MS` (60 000 ms) in `order.constants.ts` beside `ORDER_SHIPPING_INTERVAL_MS` and `ORDER_SHIPPING_BATCH`. Change that number to change the wait everywhere.
3. A shipped line still offers `Нет в наличии`, because that is where the money comes back, so `ALLOWED_LINE_TRANSITIONS.SHIPPED` keeps `CANCELLED` beside the legacy `DELIVERED`.

The wait is a full minute because the pass looks every minute: an accepted order becomes sent between 60 and 120 seconds after acceptance, never later than that.

## Requirements

**User stories**:

- As a buyer, I want my paid order to read confirmed without waiting for a seller, so that I know the shop accepted it.
- As a seller, I want the platform to accept orders for me, so that my only decisions are hand this over, or the item is gone.
- As the shop, I want an unpaid prepaid order never to look accepted, so that an abandoned checkout still closes and gives the stock back.

**Acceptance criteria** (the contract):

- **AC-1**: `POST /api/orders` writes the line status per payment method inside the create transaction, from one exported `LINE_STATUS_BY_PAYMENT_METHOD: Record<PaymentMethod, OrderItemStatus>` in `order.constants.ts`: `CASH` and `CARD_ON_DELIVERY` map to `CONFIRMED`, `ONLINE_CARD` maps to `PENDING`, and `PAYPAL` and `STRIPE` map to `PENDING` even though the create path refuses them (spec 0015, AC-3), so the `Record` forces a decision for every member added later. The lines carry that status in the nested `OrderItem.create`, the `order.create` sets no `status` and the row keeps its `PENDING` default, and the create transaction then calls `recomputeOrderStatus(tx, orderId)` once, so a cash order reads `CONFIRMED` and an online card order reads `PENDING`. No other column changes: the stock decrement, the cart clearing, the shipping snapshot, the grand total and the idempotency fingerprint keep their rules (specs 0001, 0003, 0009, 0015).
- **AC-2**: A paid event, whether it arrives through the webhook, the sync route or the reconciliation sweep, changes payment and lines in one transaction. The order's `paymentStatus` becomes `PAID` under the existing rule, every line of that order whose status is `PENDING` becomes `CONFIRMED`, `recomputeOrderStatus` runs in the same transaction so the order reads what its lines say, and one structured log line `payment.lines_confirmed` carries `orderId`, `paymentId` and `lineCount`. The attempt row, the event row and their guards keep the rules of spec 0015.
- **AC-3**: The paid apply confirms `PENDING` lines only, so a line in `CANCELLED`, `OUT_OF_STOCK`, `DELIVERED`, `RETURNED`, `BACKORDERED` or `REPLACED` keeps its status. When no active line remains after the apply, so that `recomputeOrderStatus` answers `CANCELED`, the order keeps `paymentStatus = PAID`, stays `CANCELED`, and one `payment.refund_owed` warning is written with `reason: "late_payment"` beside the fields of spec 0015. Only two paths reach that state, because a seller cannot cancel a `PENDING` line: a paid event landing after the attempt was `CANCELLED` or `EXPIRED` and the close already cancelled the lines, and a customer cancel of an order whose money had arrived. The customer cancel path in `OrderService.cancelOrder` therefore writes the same warning with `reason: "customer_cancel"` whenever `paymentStatus` is `PAID`, so money never leaves the record without a log line naming it.
- **AC-4**: A second delivery of the same paid event, and a sync on an already paid order, write nothing. `applyPaidEvent` answers `ignored` when the attempt is already `PAID`, and, after `loadLockedOrder`, also when the order's `paymentStatus` is already `PAID`. That second guard closes the sync that finds an older `FAILED` attempt on an order another attempt already paid, because `newestOpenAttempt` reads `PENDING` and `FAILED` only. No second `payment.lines_confirmed` line is logged and no line is touched.
- **AC-5**: The seller writes are split between the two routes it owns. `ALLOWED_LINE_TRANSITIONS`, the table the patch route reads, becomes `CONFIRMED` to `CANCELLED`, `SHIPPED` to `CANCELLED` (the seller still reports a paid line gone, because that is where the money comes back) plus `SHIPPED` to `DELIVERED` (kept for legacy lines by spec 0013, AC-12), and nothing from `PENDING`, `DELIVERED`, `CANCELLED`, `OUT_OF_STOCK`, `RETURNED`, `BACKORDERED` or `REPLACED`. `HANDOVER_READY_STATUSES`, the list the handover route reads, keeps `CONFIRMED` and `SHIPPED` and stays the only writer of `DELIVERED`, so a per line delivery over the patch route stays refused exactly as spec 0013, AC-12 requires. `PENDING` to `CONFIRMED`, `CONFIRMED` to `SHIPPED` and `PENDING` to `OUT_OF_STOCK` are refused with `409 INVALID_STATUS_TRANSITION` from every seller route. `OUT_OF_STOCK` and `SHIPPED` stay in the enum and keep their labels in both catalogs, because existing rows carry them.
- **AC-6**: `PATCH /api/order-items/:orderItemId/status` with `CANCELLED` is the only per line seller action, and it means the item is gone. The status write, the stock return through `returnOrderStock` and the `recomputeOrderStatus` call already exist in `applyOrderItemStatus` and keep their behaviour; what this decision adds is the money signal. The same transaction reads the order row under the lock it already holds and, when that order's `paymentStatus` is `PAID`, writes one `payment.refund_owed` warning with `orderId`, `orderItemId`, the line amount (`price * quantity`) and `currency`. A status the table of AC-5 does not allow answers `409 INVALID_STATUS_TRANSITION` and writes nothing, and a repeat of `CANCELLED` on an already cancelled line answers the current line with no write.
- **AC-7**: `PATCH /api/seller/orders/:orderId/handover` stops requiring a pickup point, so a courier order is handed over by the same route: the `pickupPointId === null` branch, `ORDER_ERROR_CODES.handoverRequiresPickup`, its `409` answer, the storefront refusal entry and the `seller.handoverRequiresPickup` catalog key in both languages are deleted. `409 NOTHING_TO_HAND_OVER` stays for an order whose owned lines are all `PENDING`. The rest of the route keeps spec 0013, AC-11: the ownership `404`, one transaction under `lockOrder`, every owned `CONFIRMED` or `SHIPPED` line to `DELIVERED` with one `receiptDate`, `handedOverAt` written once when the order closes as `DELIVERED`, and the idempotent `200` repeat.
- **AC-8**: The seller panel offers exactly two moves. Per line, `Нет в наличии` (the `CANCELLED` request of AC-6) behind a confirmation dialog that names the product, the stock return and, for a paid order, the money the buyer gets back; the line component receives a `paid` flag from its group, because `LineActions` reads only the line today. Per group, `Выдать` (the handover route of AC-7), rendered for every group that holds a `CONFIRMED` or `SHIPPED` line, pickup or courier, and moved out of the pickup block, which keeps printing the point name, the address and the handover date; its dialog copy has one string per kind, because the current `seller.handoverText` interpolates the point name and a courier group has none. `Confirm`, `Ship`, `Deliver` and `Cancel` disappear from the panel, from `SellerAction`, `SELLER_ACTION_TARGET` and `SELLER_LINE_ACTIONS`, and `sellerLineActions` loses its `isPickup` parameter with the case it served. Both tables are transcriptions of this spec, one per package, and each parity test proves its own table still matches the AC-5 rules; neither imports the other. A group whose order is `ONLINE_CARD` and not `PAID` renders its lines with the payment badge it prints today (spec 0015, AC-16) and offers no action at all.
- **AC-9**: The buyer order screen tells the truth after payment. The status pill reads `orders.status.confirmed` as soon as the order status is `CONFIRMED` and each line chip reads `orders.itemStatus.confirmed`, then both read `shipped` once the shipping pass has run (AC-17), with no new component. A paid order holding a `CANCELLED` line prints a refund note beside the payment row through a new predicate (paid and at least one cancelled line) beside the one that prints it today for a `CANCELED` order, and the `orders.payment.refundOwed` string is reworded, because it says the order was cancelled, which is false when one line was. No surface prints `OUT_OF_STOCK` for a line created after this change, and `SHIPPED` prints from the moment the shipping pass runs.
- **AC-10**: The two catalogs (`apps/customer/messages/en.json`, `apps/customer/messages/ru.json`) stay in parity, which `src/i18n/messages.test.ts` checks. The `seller` namespace gains `actions.gone` and a second handover dialog string for a courier group, its `dialog.cancelTitle` and `dialog.cancelText` are rewritten to name the stock return and the buyer's money, and these keys are deleted: `actions.confirm`, `actions.ship`, `actions.deliver`, `actions.cancel`, `dialog.outOfStockTitle`, `dialog.outOfStockText` and `handoverRequiresPickup`. `orders.payment.refundOwed` is reworded in both languages.
- **AC-11**: Gateway jest and storefront vitest lock the behaviour, each scenario failing without its change: a cash order creates `CONFIRMED` lines and a `CONFIRMED` order; an online card order creates `PENDING` ones; a paid event confirms every `PENDING` line and the order follows; a paid event leaves a `CANCELLED` line alone and logs `refund_owed` when nothing active remains; a sync against an older `FAILED` attempt of a paid order writes nothing and logs no second `lines_confirmed`; a repeated paid event writes no second line log; the narrowed table refuses `PENDING` to `CONFIRMED`, `CONFIRMED` to `SHIPPED` and `PENDING` to `OUT_OF_STOCK`, and still refuses `CONFIRMED` to `DELIVERED` over the patch route; `CANCELLED` on a paid line returns the stock and logs `refund_owed`; a customer cancel of a paid order logs `refund_owed`; a courier order hands over through the route with no pickup point. The suites that assert the old rules are rewritten in the same change: `seller-order.transitions.spec.ts`, `SellerOrders/lib/actionMap.test.ts` (with the removed `isPickup` case), `Orders/OrderPage/lib/payment.test.ts` and `PaymentActions/index.test.tsx`. `pnpm check-types` and `pnpm quality-gate` pass.
- **AC-12**: The path is walked on the running stack, with the steps and their output recorded in [verify.md](verify.md): a cash order reads `CONFIRMED` in the seller panel and on the buyer screen; an online card order stays unaccepted and payable until the test card is paid; after payment the buyer screen reads `CONFIRMED` and the seller panel offers `Выдать`, and a minute later both the pill and the chips read `Отправлен`; `Нет в наличии` on a paid line cancels it, returns the stock and writes the refund log; a courier order hands over with no pickup point.

- **AC-17**: An accepted order is marked sent by the platform, not by a person. `runOrderShipping` in `order-shipping.ts` looks every `ORDER_SHIPPING_INTERVAL_MS` for orders that read `CONFIRMED`, hold at least one `CONFIRMED` line, and whose acceptance is at least `ORDER_SHIPPING_DELAY_MS` old. Acceptance is the moment the money arrived for a prepaid order (`Payment.paidAt`) and the order's own `createdAt` for a cash one, because the create path confirms it at once. Each such order runs one transaction that moves its `CONFIRMED` lines to `SHIPPED`, calls `recomputeOrderStatus` so the order follows them, and writes one structured log line `order.lines_shipped` with `orderId` and `lineCount`. The move names only `CONFIRMED` lines, and a pass that finds none writes nothing and logs nothing, so two replicas running the pass together stay harmless and a handover that landed first is never undone. `PAYMENT_SWEEP_LOCK_KEY` is not used here: the update is idempotent through its own where clause.

## Decision

**Chosen option**: Option 2 (the server confirms, the seller fulfils).

The create path stamps `OrderItem.status` per payment method, the paid apply of the payment module confirms the pending lines in its own transaction, the seller keeps two writes (`CANCELLED` over the patch route, `DELIVERED` over the handover route only), and the handover route loses its pickup precondition. No schema change and no backfill.

**Implementation skills**: none installed that shape this decision. `apps/customer/AGENTS.md` (`## Coding standard`, S1 to S5) governs the storefront part and is followed.

## Feature design

**Data model sketch**:

| Entity | Field | Use in this decision |
|---|---|---|
| `OrderItem` (unchanged) | `status OrderItemStatus @default(PENDING)` | The default stays. The create path writes `CONFIRMED` for the cash methods (AC-1), the paid apply writes `CONFIRMED` for the rest (AC-2), the seller writes `CANCELLED` (AC-6) and the handover writes `DELIVERED` (AC-7). No new column, no migration. |
| `OrderItem` (unchanged) | `receiptDate DateTime?` | Written by the handover, as today. |
| `Order` (unchanged) | `status OrderStatus @default(PENDING)`, `paymentStatus PaymentStatus @default(PENDING)`, `handedOverAt DateTime?` | The order status becomes a pure mirror of its lines through `recomputeOrderStatus`, which the create path and the paid apply now also call. |

**State transitions**:

Line `status`, with the writer that owns each move:

| From | To | Trigger | Writer |
|---|---|---|---|
| (new) | `PENDING` | order creation with `ONLINE_CARD` | order create |
| (new) | `CONFIRMED` | order creation with `CASH` or `CARD_ON_DELIVERY` | order create |
| `PENDING` | `CONFIRMED` | paid apply (webhook, sync, sweep) | payment |
| `CONFIRMED` | `SHIPPED` | the shipping pass, one minute after the shop accepts the order (AC-17) | order |
| `PENDING` | `CANCELLED` | customer cancel, expiry close, sweep close (unchanged) | order |
| `CONFIRMED` | `CANCELLED` | seller `Нет в наличии`, customer cancel (unchanged path) | order |
| `CONFIRMED`, `SHIPPED` | `DELIVERED` | seller handover, pickup or courier | handover only |
| `SHIPPED` | `DELIVERED` | a line created before this change, closed over the patch route | `PATCH order-items` |

The patch route writes `CANCELLED` and, for a legacy `SHIPPED` line, `DELIVERED`. The handover route is the only writer of `DELIVERED` for a `CONFIRMED` line, which keeps spec 0013, AC-12. `CONFIRMED` to `SHIPPED`, `PENDING` to `CONFIRMED` and `PENDING` to `OUT_OF_STOCK` are gone from every seller route.

Order `status` follows `recomputeOrderStatus` (the least advanced active line, `CANCELED` when none is active) and gains two callers: the create path for every order, and the paid apply.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/orders` | POST | unchanged body | unchanged body | session cookie, active account | unchanged; the written line status now depends on `paymentMethod` (AC-1) |
| `/api/orders/:orderId/payment/sync` | POST | order id | `{ paymentStatus, status, paymentExpiresAt }` | session cookie | unchanged; the answered `status` may now be `CONFIRMED` (AC-2) |
| `/api/payments/stripe/webhook` | POST | raw body, signature | `{ received: true }` | public, signature | unchanged |
| `/api/order-items/:orderItemId/status` | PATCH | `{ status }` | the line | session cookie, active account, business owner | `409 INVALID_STATUS_TRANSITION` for every move the table of AC-5 does not allow, `404 ORDER_ITEM_NOT_FOUND` |
| `/api/seller/orders/:orderId/handover` | PATCH | order id | `{ order }` | session cookie, active account, business owner | `404 ORDER_NOT_FOUND`, `409 NOTHING_TO_HAND_OVER`; `409 HANDOVER_REQUIRES_PICKUP` is removed (AC-7) |

**Value sourcing**:

| Action / screen | Value produced or displayed | Source |
|---|---|---|
| Order creation | line status | `LINE_STATUS_BY_PAYMENT_METHOD[dto.paymentMethod]` (AC-1) |
| Order creation | order status | `recomputeOrderStatus(tx, orderId)` once after the lines; `order.create` sets no `status` (AC-1) |
| Paid apply | which lines to confirm | the order's own `OrderItem` rows read inside the paid transaction, `status = PENDING` (AC-2) |
| Paid apply | skip signal | the order's `paymentStatus`, read through `loadLockedOrder` (AC-4) |
| Paid apply | order status | `recomputeOrderStatus(tx, orderId)` (AC-2, AC-3) |
| Paid apply log | `lineCount` | the size of the updated set returned by the `updateMany` (AC-2) |
| Seller `Нет в наличии` | stock return | the line's `quantity` through `returnOrderStock` (AC-6) |
| Seller `Нет в наличии` | refund gate | the order's `paymentStatus`, read under the same lock (AC-6) |
| Seller `Нет в наличии` | `amount`, `currency` | the line's `price * quantity` and `currency` (AC-6) |
| Customer cancel log | `amount`, `currency` | the order's `grandTotal` and `currency` (AC-3) |
| Seller panel | which moves a line offers | the line `status` plus the group's `paymentMethod` and `paymentStatus`, passed down as `paid` (AC-8) |
| Seller panel | which moves a group offers | `handoverableCount(order.orderItems)` over the `CONFIRMED` and `SHIPPED` lines of the group (AC-8) |
| Buyer order screen | status pill | `order.status` from the order read (AC-9) |
| Buyer order screen | refund note | `paymentStatus = PAID` and at least one `CANCELLED` line of the order read (AC-9) |

**Key invariants**:

1. A line is `PENDING` only while its order is an unpaid `ONLINE_CARD` order; every other order holds `CONFIRMED` or `SHIPPED` lines from the moment it is written or paid.
2. Two writers move a line forward: the create path confirms it for the cash methods, and the paid apply confirms it for the prepaid ones. No seller route does. The shipping pass is the only writer of `SHIPPED`, and it is a timer, not a person (AC-17).
3. A seller writes exactly two statuses: `CANCELLED` over the patch route, under the order lock and with `recomputeOrderStatus`, and `DELIVERED` over the handover route, which no other route may produce for a `CONFIRMED` line.
4. Money that leaves for a line or an order cancelled afterwards is never dropped: `paymentStatus` stays `PAID` and a `payment.refund_owed` warning names the line or the order, with its `reason`.
5. `Order.status` remains a pure mirror of `OrderItem.status`; no payment event writes it by hand.

**Security model**:

- No new route and no new permission. The seller routes keep their mount chain (`authenticateToken`, `requireActiveAccount`, controller) and their ownership check on `business.ownerUserId`, so a seller still reads and writes its own business's lines only, and a foreign order answers `404`.
- The paid apply stays reachable only from a signature verified event or a provider retrieve, and the amount and currency checks of spec 0015 stand before any line changes.
- Removing the pickup precondition widens what a seller may close, not who may close it: the same owner hands over a courier parcel it already owned.

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: a cash order is placed, the seller panel offers `Выдать`, the parcel is handed over, the order reads `DELIVERED`; an online card order is placed, paid on the hosted page, and reads `CONFIRMED` with a `CONFIRMED` line, then reads `SHIPPED` a minute later, verifies **AC-1**, **AC-2**, **AC-7**, **AC-8**, **AC-9**.
- Failure case: a paid event lands after the close already cancelled the lines, and the order reads `CANCELED` with `paymentStatus = PAID` and one `refund_owed` warning carrying `reason: "late_payment"`; a sync against an older failed attempt of a paid order writes nothing, verifies **AC-3**, **AC-4**.
- Auth/permission: a seller of another business answers `404` on the handover and on the line patch; `CONFIRMED` to `DELIVERED` over the patch route still answers `409 INVALID_STATUS_TRANSITION`, verifies **AC-5**, **AC-6**, **AC-7**.
- Screen: an unpaid online card order shows its lines with the payment badge and no action, and the buyer screen prints the refund note for a paid order holding a cancelled line, verifies **AC-8**, **AC-9**, **AC-10**.

## Build plan

Tracer Bullet: the money and stock truth lands in the gateway first (a paid order and a cash order each read correctly through the existing screens), then the seller rules narrow, then the storefront, then the walls.

1. **Confirm on write and on payment, gateway.** `LINE_STATUS_BY_PAYMENT_METHOD` and `buildOrder` write the line status and call `recomputeOrderStatus`; `applyPaidEvent` confirms the `PENDING` lines, gates on the order's `paymentStatus`, recomputes the order and logs `payment.lines_confirmed`; `cancelOrder` writes `refund_owed` with `reason: "customer_cancel"` for a paid order. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**. — done: `order.constants.ts` holds the table, `order.service.ts` writes the status and recomputes, `payment.apply.ts` confirms the pending lines behind the order guard and logs both events, `cancelOrder` logs `customer_cancel`; covered by `order.service.spec.ts` and `payment.apply.spec.ts`
2. **Narrow the seller rules, gateway.** `ALLOWED_LINE_TRANSITIONS` becomes the patch table of AC-5 while `HANDOVER_READY_STATUSES` stays the only writer of `DELIVERED` for a `CONFIRMED` line, `CANCELLED` on a paid order writes the refund warning with the order read under the lock, and the handover route loses its pickup precondition with the code, the storefront refusal entry and the catalog key deleted in the same pass. Satisfies **AC-5**, **AC-6**, **AC-7**. — done: table narrowed, `handoverRequiresPickup` gone from the service, the error codes, `refusals.ts` and both catalogs; `applyOrderItemStatus` reads `paymentStatus` under the lock and logs the line refund; covered by `seller-order.transitions.spec.ts`, `seller-order.service.spec.ts` and `seller-order-handover.spec.ts`
3. **Seller panel and buyer screen, storefront.** `SellerAction`, `SELLER_ACTION_TARGET`, `SELLER_LINE_ACTIONS` and `sellerLineActions` shrink to `Выдать` and `Нет в наличии`; `SellerOrderGroup` renders the handover outside the pickup block with a string per kind and passes `paid` down to the line; the line dialog copy names the stock and the money; the order screen prints the refund note through its new predicate; both catalogs gain, reword and delete the keys of AC-10. Satisfies **AC-8**, **AC-9**, **AC-10**. — done: the line action map holds the single `gone` move, the group renders `Выдать` for any ready group with `handoverText` and `handoverCourierText`, the line dialog interpolates the money under a paid group, `lineRefundOwed` drives the buyer note, both catalogs updated
4. **Walls: tests and the gate.** Gateway and storefront suites of AC-11, with the four suites that assert the old rules rewritten, then `pnpm check-types` and `pnpm quality-gate`. Satisfies **AC-11**. — done: the four suites rewritten, gateway 291 passed, storefront 292 passed, `pnpm quality-gate` 18 of 18 tasks green
5. **Verify on the running stack.** The walk of AC-12, recorded in `verify.md`. Satisfies **AC-12**.

## Consequences

**Positive**:

- A paid order reads `CONFIRMED` immediately, so the buyer no longer waits for a seller whose panel may never be opened, and the order whose shop has no owner account stops hanging in `PENDING` after payment.
- The seller panel loses three moves it never needed, which removes the class of mistakes where a seller ships an unpaid order or confirms it by reflex.
- No migration, no new column, no new route: the change is one writer on the create path, one in the paid apply and two narrower seller tables.

**Negative / tradeoffs**:

- A seller can no longer accept a line manually, so the platform owns the acceptance decision, and a shop that wants to inspect an order before accepting it has no way to refuse one line and keep another.
- `SHIPPED` and `OUT_OF_STOCK` become write dead ends: no seller route produces them, and their labels exist for rows created before this change. A later cleanup migration can drop them once no row carries them.
- A customer cancel of a paid order is now easier to reach, because every paid order is `CONFIRMED` and the cancel rule allows `CONFIRMED` lines; the money returns by hand, and the refund route is still owed.
- The handover route can no longer refuse a courier order, so the one place that guaranteed a parcel had a pickup point is gone; the pickup block stays on the group as information.

**Neutral**:

- Existing orders keep their statuses: a prepaid order awaiting payment stays `PENDING` and closes through the sweep, a delivered order stays delivered.
- Two sentences of earlier specs are amended here and read through this spec where they differ: spec 0015, AC-6 said the paid apply never touches `Order.status`, and spec 0013, AC-11 required a pickup point before a handover. Neither older criterion is edited in place; this spec carries the new rule and cites the old one.
- The buyer cancel path, the expiry close, the sweep and the stock return are untouched apart from the new refund warning of AC-3.

## Migration plan

**Strategy**: no migration needed. The change is application behaviour on columns that exist, with `PENDING` staying the database default. No order and no line is backfilled: rewriting an old line's status would invent a decision nobody made at the time.

**Rollback**: revert the deploy. Lines written as `CONFIRMED` by the new code stay confirmable through the old panel, because `CONFIRMED` was already a status the old table could act on.

**Risks**: a replay of an order created before the deploy answers its stored order and is not re-stamped; that is the intended read of the idempotency rule of spec 0003.

## Follow-up

- [ ] Refund route, so a cancelled paid line returns the money through the provider instead of a manual transfer. Today the `payment.refund_owed` log line is the only signal, exactly as spec 0015 left it.
- [ ] Drop `SHIPPED` and `OUT_OF_STOCK` from `OrderItemStatus` once no row carries them, with the catalogs and the client tables in the same change.
- [ ] Data task, separate from this spec: 16 of the 31 demo businesses have `ownerUserId = NULL`, so their lines cannot be handed over by anyone. This spec stops those orders hanging after payment, and it does not make those parcels deliverable.

## Rationale

Reasoning, options and the measured state before the decision: see [rationale.md](rationale.md).
