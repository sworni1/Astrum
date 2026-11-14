# 0018. Handover at the pickup point · decision record

## Context

One action closes a parcel in this project today, and it belongs to a shop owner. `PATCH /api/seller/orders/:orderId/handover` reads the caller's business through `Business.ownerUserId`, delivers only the lines whose `businessId` is that business, and answers `404` to every other order. The person standing at the collection point the buyer chose has no way into that rule, because a point worker owns no business, and the parcel the worker is holding belongs to somebody else's shop.

An accepted order reaches the point by itself. The shipping pass in `order-shipping.ts` moves every `CONFIRMED` line to `SHIPPED` one minute after the shop accepts the order, so a parcel waits at the point in a state whose only closing writer is a seller who will never touch it. That is the gap this decision fills.

The obvious reuse is unavailable on both sides. The customer cancel refuses any order holding a `SHIPPED` line, because `CUSTOMER_CANCELLATION_BLOCKERS` in `order.service.ts:64` lists `SHIPPED`, `DELIVERED`, `RETURNED`, `BACKORDERED` and `REPLACED`, and the shared `closeOrder` helper cancels only `PENDING` and `CONFIRMED` lines and returns stock only for those (`order-status.helpers.ts:97`). So a cancel at the counter cannot be the customer cancel with a different caller: the lines it must cancel are exactly the lines the customer path blocks.

The roles arrived with spec 0017: `PointWorker` carries a required `pickupPointId`, `Courier` carries none, and `requirePointWorker` reads the caller's row on every request and puts the point on the request. The queue, therefore, needs no new authorisation idea, only a route that uses the point the guard already resolved.

If this is not decided, scope rows 20 and 21 cannot start, and the slice's promise ("gives the parcel two real hands") stays a page with a placeholder line. The seller remains the only closer of a parcel the seller has already let go of.

## Measured state before the decision

Facts read from the tree and the schema on 2026-11-14, each one load bearing for an option below:

- `apps/api-astrum/src/modules/order/order.service.ts:64` holds `CUSTOMER_CANCELLATION_BLOCKERS`, which includes `SHIPPED`, so the customer cancel cannot serve the counter.
- `apps/api-astrum/src/modules/order/order-status.helpers.ts:97` holds `STOCK_RETURN_STATUSES` as `PENDING` and `CONFIRMED` only, and `closeOrder` updates only those two statuses.
- `apps/api-astrum/src/modules/order/seller-order.service.ts` proves ownership through `Business.ownerUserId` on every request and delivers `HANDOVER_READY_STATUSES` (`CONFIRMED`, `SHIPPED`) of that business only.
- `apps/api-astrum/src/middlewares/staffRole.ts:94` puts `{ role, pickupPointId }` on the request, so the point is resolved once per call and never comes from the request body.
- `apps/api-astrum/src/app.ts:92` already mounts `staffRoutes` inside the single `app.use("/api", authenticateToken, ...)` chain, so the three new routes need no new mount.
- `apps/customer/src/features/pages/PointWorkspace/index.tsx` renders `PointCard`, which prints `staff.point.queueLine` as a placeholder and no control.
- Spec 0016, Follow-up records that 16 of the 31 demo businesses carry `ownerUserId = NULL`, so their parcels have no seller to act for them.

## Options considered

### Option 1: Widen the seller handover, branch on the role inside the handler

Keep one route pair (`PATCH /api/seller/orders/:orderId/handover`, plus a new cancel route) and decide inside the handler whether the caller is a shop owner or a point worker, with the scoping rule following the role.

**Pros**:
- One route pair and one screen contract, so a later reader finds the closing rule in one file.
- No new module and no new answer shape.

**Cons**:
- Two ownership rules in one handler: `Business.ownerUserId` for a seller and `Order.pickupPointId` for a worker, which is the kind of branch that gets one arm wrong.
- Scope row 21 removes the seller arm, so the branch exists to be deleted one feature later.
- The route name lies about the actor, and its `404` message ("not found for this seller") would be read by a worker.

### Option 2: A point order module with its own route pair (chosen)

Three routes on the existing staff router, a service under `modules/staff/` that scopes by `Order.pickupPointId`, its own read shape with no buyer identity, and reuse of `lockOrder`, `recomputeOrderStatus` and `returnOrderStock`.

**Pros**:
- One file states the point's rule, and the seller rule stays untouched until row 21 deletes it, so nothing regresses in between.
- The mount chain does not change: the staff router is already in the `/api` chain, so `authenticateToken` still runs once per request.
- The answer shape is written for the counter, which is why it can carry no buyer identity without arguing about the seller panel.

**Cons**:
- Two writers of `DELIVERED` while both features exist.
- The pagination parser and the price mapping need a small extraction, so a shared helper becomes a two consumer module.
- A second service in the staff module, next to the role service that has nothing to do with orders.

### Option 3: The worker acts through the seller service, per business of the order

Resolve every business that owns a line of the order and call the seller handover once per business, so the write path stays a single implementation.

**Pros**:
- The handover semantics stay exactly one implementation.
- No new write code and no new refusal vocabulary.

**Cons**:
- The worker holds no business, so the service must be entered with an actor it does not have, which puts a forgery inside the one place that proves ownership.
- A business with no owner account has nobody to act as, and 16 of 31 businesses are in that state today, so those parcels would still never close at the counter.
- One press becomes several transactions, so the "one server time" the scope row asks for would be false, and a failure halfway would leave an order half delivered with no way to say which half.

## Rationale

Option 2 wins on the force the scope row names: the parcel's physical holder. The queue and both moves are scoped by the point, and `Order.pickupPointId` is the one column that states which point holds a parcel. Keeping that rule in one file, next to the guards that resolve the point, means a later reader never has to reason about which of two ownership rules applies.

Option 3 is the cheapest option to write and the only one that is provably wrong. Its own measured fact kills it: a third of the businesses have no owner account, so the parcels of exactly those shops could never be closed at a counter, which is the case this feature exists to fix. Option 1 survives on paper but puts a branch in the handler whose seller arm scope row 21 deletes, and it forces the counter's answer shape to be the seller's answer shape, which carries a business id and a point snapshot the counter does not need.

Three smaller calls follow from the same logic.

The foreign order answers `404`, not a distinct code. The scope row asks one code per refusal, and it gets one for each state: `ALREADY_HANDED_OVER`, `ORDER_NOT_SHIPPED`, `NOTHING_TO_CANCEL`, `PICKUP_POINT_INACTIVE`. A separate code for "another point's order" would answer a question the caller has no right to ask, and spec 0013 already set the precedent for a foreign order on the seller side. The owner confirmed this reading against the row's wording.

The repeat press is refused, not answered quietly. Spec 0013 made the seller handover idempotent and answered `200` on a repeat, which reads well for a background retry and badly at a counter: a second press means somebody is unsure whether the first one worked, and the honest answer is that the parcel is already closed. A worker who presses twice gets `409 ALREADY_HANDED_OVER` and the queue behind the dialog has already lost the row.

The cancel is not `closeOrder`. Reusing the customer helper would have meant widening `STOCK_RETURN_STATUSES` and the update it drives, which changes what the customer cancel does on a shipped order, a rule spec 0002 and spec 0011 set and nothing in this feature is entitled to move. A separate cancellable set, read under the order lock, keeps the customer path byte for byte and gives the counter its own rule: `PENDING`, `CONFIRMED` and `SHIPPED` go, `DELIVERED` stays. When a delivered line stays, the order keeps reading `DELIVERED` because the status is the mirror `recomputeOrderStatus` computes, and the owner chose that over refusing the whole cancel.

The cancel also carries the handover's `SHIPPED` precondition, which the cross check prompted. It keeps the counter's power equal to the queue the worker sees, and it removes a collision that would otherwise need code outside this feature. The shipping pass in `order-shipping.ts:38` updates `CONFIRMED` lines and then recomputes the order without taking the order lock, so a counter cancel able to name an order in `CONFIRMED` would fight it over the same line rows and the same parent row: an honest deadlock at best, a status written from a stale snapshot at worst. Bounding both staff routes to `SHIPPED` makes the two writers disjoint by construction, which is cheaper and safer than teaching the pass a lock for a cancel the scope row never asked for.

The cancel names money by the lines it cancelled, not by the grand total, because the delivery price was not paid for goods that came back and the amount has to survive a later refund route without being explained. The reason string is `point_cancel`, so a reader of the log can tell a counter cancellation from `customer_cancel` and from `late_payment`.

Nothing records who handed a parcel over beyond a log line. The audit table is already owed (spec 0017, Follow-up), and adding a column here would edit four byte identical schema copies for a value nothing reads yet; the log line carries the account, the point, the order and the count, which is what an incident needs on the day it happens.

References: none. The stack is settled, and the sources that shaped this decision are the existing specs and the code they describe: 0002 for the line table, the stock rule and the ownership rule; 0011 for the irreversible confirm primitive and the refusal vocabulary; 0013 for the point, the one timestamp and the `404` precedent; 0015 and 0016 for the refund warning and the shipping pass; 0017 for the role rows, the guards and the point the queue is scoped to. The reasoning stays here rather than in a citation list, following the shape specs 0013 and 0017 already use for the same call.
