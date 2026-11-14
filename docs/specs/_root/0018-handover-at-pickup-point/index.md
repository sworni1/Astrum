# 0018. Handover at the pickup point

**Date**: 2026-11-14
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The parcel reaches the point the buyer chose, and until now the person standing there could do nothing with it: only a seller could close an order, and a seller is not at the counter. This decision gives a point worker a queue of their own point's parcels that are on their way, one control that hands the whole order over at one moment, and one control that cancels the whole order when the buyer asks for it at the counter. A cancelled order gives the stock back once, and an order paid online leaves a log line saying money is owed back. No new table and no migration: the feature is built from columns that already exist.

## Requirements

**User stories**:

- As a point worker, I want to see the parcels waiting at my point so that I can find one when a buyer arrives.
- As a point worker, I want one press to hand a whole order over so that a collection takes a moment, not a form.
- As a point worker, I want to cancel a whole order when the buyer refuses the parcel so that the goods go back to stock the same day.
- As the shop, I want both moves refused for an order that is not mine to touch, so that a wrong point never closes another point's parcel.

**Acceptance criteria** (the contract):

- **AC-1**: `GET /api/staff/point/orders` mounts `requirePointWorker` and answers `200 { orders, page, limit, total, totalPages }`, where `orders` holds only rows whose `pickupPointId` equals the point stored on the caller's `PointWorker` row and whose `status` is `SHIPPED`, ordered by `createdAt` ascending with `id` ascending as the tiebreak. An empty answer is `{ orders: [], page, limit, total: 0, totalPages: 0 }`. The route carries no `requireActiveAccount`, because a read stays open to a `PENDING` account, as spec 0017, AC-9 set for the other staff reads. The three routes are added to the existing `staffRoutes` router in `apps/api-astrum/src/modules/staff/staff.routes.ts`, which is already mounted once inside the `app.use("/api", authenticateToken, ...)` chain of `src/app.ts`, so no second mount and no second `authenticateToken` run is introduced.
- **AC-2**: Each order row of the queue answer is exactly `{ id, createdAt, status, paymentStatus, paymentMethod, handedOverAt, grandTotal, currency, orderItems: [{ id, name, previewImage, quantity, price, currency, status }] }`. `grandTotal` and each `price` reach the browser through `toMoney` from `apps/api-astrum/src/common/helpers/money.ts`, the helper every amount answer in this gateway already uses (spec 0009), so they are numbers with two decimals and never decimal strings, and `createdAt` and `handedOverAt` reach JSON as ISO strings or `null`. The row carries no `userId`, no buyer name, no email, no phone, no address, no `pickupPointId` and no business id or name. The same shape answers the two writes of AC-4 and AC-6.
- **AC-3**: `page` defaults to 1 and `limit` to 20, `limit` is clamped to 50 exactly as the seller read does today, and a value that is not a positive integer or a product that is not a safe integer answers `422 VALIDATION`. The parsing lives in one function: `parsePagination` and its value parser move out of `seller-order.service.ts` into `apps/api-astrum/src/common/helpers/pagination.ts`, and both the seller read and the queue read import it. The shared helper raises nothing of its own: it takes the caller's `invalid()` factory, which the seller read fills with its existing `invalidPagination` and the queue read with its own, so the shared module never imports `ORDER_ERROR_CODES` from a module folder and every seller answer stays byte for byte what it is today.
- **AC-4**: `PATCH /api/staff/point/orders/:orderId/handover` mounts `requireActiveAccount`, then `requirePointWorker`, then the controller, in that order. It works in one transaction with `ORDER_TRANSACTION_OPTIONS` and `lockOrder`, and it runs one fixed chain of checks, where every refusal writes nothing: an order that does not exist and an order whose `pickupPointId` differs from the caller's point both answer `404 ORDER_NOT_FOUND`, so ownership is never revealed; an order at a point whose `isActive` is false answers `409 PICKUP_POINT_INACTIVE`; an order whose `handedOverAt` is not null answers `409 ALREADY_HANDED_OVER`; an order whose `status` is not `SHIPPED` answers `409 ORDER_NOT_SHIPPED`. An order already closed therefore never reads as "not shipped", and an order of a switched off point never reads as closed.
- **AC-5**: A successful handover moves every line of that order whose status is `SHIPPED` to `DELIVERED` with `receiptDate` set to one server timestamp taken inside the transaction, leaves every other line untouched, calls `recomputeOrderStatus`, and writes `handedOverAt` with that same timestamp when the returned status is `DELIVERED` and the column is null. It answers `200 { order }` in the shape of AC-2 and writes one structured log line `staff.point.handed_over` carrying `userId`, `pointId`, `orderId`, `deliveredLineCount` and `resultCode: "OK"`. A refusal writes `staff.point.handover_refused` with the same ids and the refusal code, and no `deliveredLineCount`. The order lock makes two workers pressing at once safe: the first commits, the second reads `handedOverAt` and answers `409 ALREADY_HANDED_OVER`.
- **AC-6**: `PATCH /api/staff/point/orders/:orderId/cancel` mounts the same chain and uses the same transaction and lock, and it carries the same `SHIPPED` precondition as the handover, so the counter's power is the queue's contents and nothing more. Its chain is `404 ORDER_NOT_FOUND` for a missing or foreign order, then `409 PICKUP_POINT_INACTIVE` for a switched off point, then the cancellable check of AC-7, then `409 ORDER_NOT_SHIPPED`. A call that passes cancels every line whose status is `PENDING`, `CONFIRMED` or `SHIPPED`, reading that set from the rows inside the lock and updating only those ids, returns the stock of exactly those lines through the existing `returnOrderStock`, leaves every line in `DELIVERED`, `CANCELLED`, `OUT_OF_STOCK`, `RETURNED`, `BACKORDERED` or `REPLACED` alone, calls `recomputeOrderStatus`, and answers `200 { order }`. `PENDING` and `CONFIRMED` stay in that set defensively: a `SHIPPED` order cannot carry them today, and the set is written for the rule, not for the accident. A line that is already `DELIVERED` stays delivered, so an order with one delivered line and one shipped line ends with the shipped line cancelled and the order reading `DELIVERED`, because the order status is the mirror `recomputeOrderStatus` computes.
- **AC-7**: A cancel that finds nothing to cancel answers `409 NOTHING_TO_CANCEL` and writes nothing, which covers the second press on the same order and an order whose every line is already delivered. That check runs before the `409 ORDER_NOT_SHIPPED` of AC-6, so a fully delivered order answers `NOTHING_TO_CANCEL` rather than a claim about shipping. The stock therefore comes back once, because the cancelled set is computed from the statuses read under the lock, never from the request.
- **AC-8**: A cancel resolves the payment the way the customer cancel does. Before the transaction opens, the route calls the existing `expireSessionForCancel` from `modules/payment/payment.cancel.ts`, because the provider call must never run while the order row is locked and a checkout left open at the provider must not stay payable after the counter closed the order; a failure there is logged and does not block the cancel, exactly as the customer path does. Inside the transaction the order's attempts in `PENDING` or `FAILED` become `CANCELLED`, and the order's `paymentStatus` becomes `CANCELLED` when it read `PENDING` or `FAILED`. When it read `PAID`, it stays `PAID` and one `payment.refund_owed` warning is written with `reason: "point_cancel"`, `orderId`, `buyerUserId` read from `Order.userId`, `actorUserId` (the worker), `pointId`, `amount`, `currency` and `cancelledLineCount`, where `amount` is the sum of `price * quantity` over the lines this call cancelled, printed with two decimals, and `currency` comes from the order. Naming the buyer and the actor apart keeps the line useful to whoever moves the money back: the buyer is who is owed, the worker is who did it. The delivery price is not part of `amount`. When nothing was cancelled, no warning is written. On a `SHIPPED` order the provider call is usually a no op, because such an order was paid before it was sent and a cash order carries no attempt row.
- **AC-9**: Both writes refuse an order whose point is switched off with `409 PICKUP_POINT_INACTIVE` and write nothing, reading the `PickupPoint` row by the caller's `pickupPointId` inside the transaction, after the `404` check and before the closed and status checks of AC-4 and AC-6, so one order reaches one answer on both routes. The queue read still answers for a switched off point, so the screen can show the banner and the parcels. This criterion carries the refusal spec 0017 left to this feature in its Follow-up.
- **AC-10**: `/point` keeps the point card (name, address, and the switched off banner it renders today) and renders the queue where the placeholder line stands. The page shows the queue heading with a refresh control that revalidates the read, and one card per order carrying the order number through the existing `orders.number` template with `order.id.slice(-8)`, which is the string the buyer's header prints, the placed date through `useFormatter` with `dateStyle: "medium"`, `timeStyle: "short"` and `timeZone: browserTimeZone()` from `features/pages/SellerOrders/lib/format.ts` (the request config pins the formatter to UTC, so a date passed without the zone prints UTC at a counter), the total through `formatMoney`, one line per item with its name, quantity, unit price and status label through the existing `itemStatusKey`, and the two controls of AC-11. It shows the existing `PageSkeleton` while the first page loads, the existing `FailureScreen` with its Retry when the read fails, an empty state naming that no parcel waits at this point with the refresh control, and a `Show more` control that reads the next page and appends it, hidden while `page >= totalPages`. A point whose `isActive` is false keeps the banner and renders both controls disabled. The page prints no invented count and no buyer identity, and `staff.point.queueLine` is deleted from both catalogs because nothing reads it.
- **AC-11**: Both controls open an `AlertDialog` from `@/components/ui/alert-dialog`, the primitive spec 0011 chose for an irreversible action, and send nothing until its confirm control is pressed. The handover dialog names the order number and says that every line still in the parcel is closed, the handover moment is stamped and the move cannot be undone. The cancel dialog names the order number, says that every line still in the parcel returns to stock, and, when the order's `paymentStatus` is `PAID`, says that the money is owed back and this screen cannot refund it. Escape, the overlay and the keep control close either dialog with no request, and only the confirm control sends one. While a request runs the control shows a busy label and its handler returns before a second send. On success the list drops every accumulated page and re-reads page 1 through the hook's `mutate`, so the closed row is gone and a `Show more` control can never resume from an offset that shifted by one; the page returns to its first screen, a success toast appears, and focus moves to the queue heading, which sits inside a `role="status"` region.
- **AC-12**: Every refusal a screen shows comes from the response `code`, read through `refusalCode` from `@/common/helpers/apiRefusal`, never from the server `message`. Each code raises its own toast: `ORDER_NOT_FOUND`, `ORDER_NOT_SHIPPED`, `ALREADY_HANDED_OVER`, `NOTHING_TO_CANCEL`, `PICKUP_POINT_INACTIVE`, `NOT_POINT_WORKER`, `STAFF_ROLE_UNAVAILABLE`, `ACCOUNT_STATUS_UNAVAILABLE` (retryable, as the seller panel treats it) and `VALIDATION`. `EMAIL_NOT_CONFIRMED` is not one of them: the shared axios interceptor in `hooks/useFetcher.ts` already raises its toast with a resend action once per session, so a second copy here would fire twice. A `500` and a request with no answer show the generic failure text with Retry. Every branch awaits the queue revalidation before it returns, so the screen never keeps an order the gateway has already closed.
- **AC-13**: Every new string lives in the `staff.point.queue` namespace of both `apps/customer/messages/en.json` and `apps/customer/messages/ru.json` with the same keys, and `apps/customer/src/i18n/messages.test.ts` keeps the parity: the heading, the refresh, `Show more`, the empty, loading and failure copy, the retry, the two control labels, the two dialog titles, texts, keep and confirm labels, the two busy labels, the two success toasts, the generic failure text and the nine refusal texts of AC-12. The order number reuses `orders.number`, so no twin template is added. No component carries hardcoded English or Cyrillic text, dates print through `useFormatter` with the zone of AC-10, and amounts print through `formatMoney`.
- **AC-14**: Every control is reachable by keyboard and carries the project `focus-visible` ring, the dialog controls are at least 32 px high, the queue keeps the storefront content container and stacks without horizontal scrolling at 360 px, one polite live region carries the busy label and the success text, because `aria-busy` on a button is not reliably announced, and both dialogs put initial focus on their keep control, as spec 0011 requires of an irreversible confirm.
- **AC-15**: The behaviour is covered by tests. Gateway jest: the queue read (only the caller's point, only `SHIPPED`, the row order, the pagination defaults and the `422`, the empty answer, the absence of every buyer field in the body, `403 NOT_POINT_WORKER`, `503 STAFF_ROLE_UNAVAILABLE` on a failed role read, and one answer for a `PENDING` account); the handover (the delivered lines with one `receiptDate`, `handedOverAt` written once, a foreign point `404`, an order not yet shipped `409 ORDER_NOT_SHIPPED`, an order already handed over `409 ALREADY_HANDED_OVER`, a switched off point `409 PICKUP_POINT_INACTIVE`, and two workers racing on the real database with `ORDER_DB_TESTS=1`); the cancel (all three statuses cancelled, the stock of each returned once, a `DELIVERED` line untouched with the order recomputed to `DELIVERED`, the repeat `409 NOTHING_TO_CANCEL`, a paid order writing one refund warning with the summed amount and `reason: "point_cancel"`, a `PAID` order keeping its status, a foreign point `404`, a switched off point `409`); the extracted pagination helper, with the seller read suites unchanged and green. Storefront vitest: the queue hook on success, refusal and network failure, the page states, both dialogs sending nothing until confirmed, the refusal map of AC-12, both controls disabled on a switched off point, the `Show more` append rule and the catalog parity run. The `PointWorkspace` suite is rewritten in the same change, because `PointWorkspace/__tests__/PointWorkspace.test.tsx:108` asserts the `staff.point.queueLine` copy this feature deletes. `pnpm quality-gate` is green.
- **AC-16**: The path is walked on the running stack, with the steps and their output recorded in [verify.md](verify.md): a cash order placed at the point reaches `SHIPPED` through the shipping pass and appears in the worker's queue; the handover closes it and the buyer's screen prints the handover date; a second order is cancelled at the counter, its stock comes back and a paid one writes its refund line; another point's order answers `404`; a switched off point refuses both moves.

## Decision

**Chosen option**: Option 2: the point owns the counter, with its own route pair inside the staff module.

A point worker gets three routes on the existing staff router (`GET /api/staff/point/orders`, `PATCH /api/staff/point/orders/:orderId/handover`, `PATCH /api/staff/point/orders/:orderId/cancel`), a service under `apps/api-astrum/src/modules/staff/` that reuses `lockOrder`, `recomputeOrderStatus` and `returnOrderStock`, a read shape with no buyer identity, one server timestamp per handover, and a cancel that reads its own cancellable set under the lock. The seller handover stays untouched until scope row 21 removes it.

**Implementation skills**: none installed that shape this decision. The repository conventions in `AGENTS.md` (module per folder, `authenticateToken` at the mount, the error body shape, the order transaction rules) and the storefront coding standard in `apps/customer/AGENTS.md` (`S1` to `S5`) govern the build and are followed through those files rather than as a separate skill.

## Feature design

**Data model sketch**:

No new table, no new column, no migration, no schema copy edit and no client regeneration. The feature reads and writes columns that already exist:

| Entity | Field | Use here |
| --- | --- | --- |
| `PointWorker` | `pickupPointId` | the point the queue is scoped to, carried on the request by `requirePointWorker` |
| `Order` | `pickupPointId` | the point an order was collected at, the ownership proof of both writes |
| `Order` | `status` | the queue filter (`SHIPPED`) and the handover precondition |
| `Order` | `handedOverAt` | written once, by the first transaction that leaves the order `DELIVERED` |
| `Order` | `paymentStatus` | decides whether a cancel leaves money owed |
| `Order` | `grandTotal`, `currency` | the amount on the card and the currency of the refund warning |
| `OrderItem` | `status` | the cancelled set, the delivered set, and the per line label |
| `OrderItem` | `receiptDate` | stamped with the same timestamp as `handedOverAt` |
| `PickupPoint` | `isActive` | read inside both writes; a switched off point refuses them |

**State transitions**:

The line table of spec 0016 keeps its shape and gains two writers, both staff only:

| From | To | Trigger | Writer |
| --- | --- | --- | --- |
| `SHIPPED` | `DELIVERED` | a worker hands the order over at its point | point handover (this spec) |
| `PENDING`, `CONFIRMED`, `SHIPPED` | `CANCELLED` | a worker cancels the order at the buyer's request | point cancel (this spec) |
| `DELIVERED` | none | a delivered line is never cancelled | none |

The order status stays a pure mirror of its lines through `recomputeOrderStatus`, so a handover closes the order as `DELIVERED` and a cancel closes it as `CANCELED` when nothing active remains, or leaves it `DELIVERED` when a delivered line stays. No route writes `Order.status` by hand.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
| --- | --- | --- | --- | --- | --- |
| `/api/staff/point/orders` | GET | `page`, `limit` (query) | `{ orders, page, limit, total, totalPages }` in the shape of AC-2 | session cookie, `POINT_WORKER` | `403 NOT_POINT_WORKER`, `503 STAFF_ROLE_UNAVAILABLE`, `422 VALIDATION`, `500` |
| `/api/staff/point/orders/:orderId/handover` | PATCH | `orderId` (path) | `{ order }` | session cookie, `ACTIVE` account, `POINT_WORKER` | `404 ORDER_NOT_FOUND`, `409 PICKUP_POINT_INACTIVE`, `409 ALREADY_HANDED_OVER`, `409 ORDER_NOT_SHIPPED`, `403 NOT_POINT_WORKER`, `403 EMAIL_NOT_CONFIRMED`, `503 ACCOUNT_STATUS_UNAVAILABLE`, `503 STAFF_ROLE_UNAVAILABLE`, `500` |
| `/api/staff/point/orders/:orderId/cancel` | PATCH | `orderId` (path) | `{ order }` | session cookie, `ACTIVE` account, `POINT_WORKER` | `404 ORDER_NOT_FOUND`, `409 PICKUP_POINT_INACTIVE`, `409 NOTHING_TO_CANCEL`, `409 ORDER_NOT_SHIPPED`, `403 NOT_POINT_WORKER`, `403 EMAIL_NOT_CONFIRMED`, `503 ACCOUNT_STATUS_UNAVAILABLE`, `503 STAFF_ROLE_UNAVAILABLE`, `500` |

All three join the existing `staffRoutes` router, so the mount chain in `src/app.ts` does not change. Inside the router the order is `requireActiveAccount` where the route writes, then `requirePointWorker`, then the controller. Neither write takes a body, so neither mounts `validateDto`; a request carrying one is ignored, because no field is read. The three new codes live in `apps/api-astrum/src/modules/staff/constants/staff.constants.ts` beside the ones spec 0017 added, and `ORDER_NOT_FOUND` is the existing `ORDER_ERROR_CODES.notFound` imported from the order module rather than a second string.

**Value sourcing**:

| Action | Value produced or displayed | Source |
| --- | --- | --- |
| Queue read | which point | `req.staff.pickupPointId`, read from the caller's own `PointWorker` row by `requirePointWorker` on every call |
| Queue read | which orders | `Order.pickupPointId` equal to that point and `Order.status = SHIPPED` |
| Queue read | page, limit, total, totalPages | the query parameters through `parsePagination`, and one `count` over the same filter |
| Queue read, the card | order number | `Order.id`, printed through the `orders.number` template with `slice(-8)`, the form `OrderPageHeader/index.tsx:38` prints |
| Queue read, the card | placed date | `Order.createdAt` through `useFormatter` with `browserTimeZone()` from the seller format helper |
| Queue read, the card | total and the per item price | `Order.grandTotal` and `OrderItem.price` through `toMoney` (AC-2), printed through `formatMoney` with `Order.currency` |
| Queue read, the card | the per item status label | `OrderItem.status` through `itemStatusKey` |
| Handover | which lines move | the order's own rows whose status is `SHIPPED`, read under the order lock |
| Handover | `receiptDate`, `handedOverAt` | one server timestamp taken inside the transaction |
| Handover | the order status after the move | the `OrderStatus` that `recomputeOrderStatus` returns |
| Handover | `deliveredLineCount` | the count returned by the line update |
| Cancel | which lines are cancelled | the order's own rows whose status is `PENDING`, `CONFIRMED` or `SHIPPED`, read under the order lock |
| Cancel | the stock that comes back | `OrderItem.quantity` of exactly those lines, through `returnOrderStock` |
| Cancel | whether money is owed | the order's `paymentStatus`, read before any write in the transaction |
| Cancel | `amount` of the refund warning | the sum of `price * quantity` over the lines this call cancelled, at two decimals; the delivery price is excluded |
| Cancel | `cancelledLineCount` | the count of that same set |
| Cancel | `buyerUserId` on the refund warning | `Order.userId` of the cancelled order, read under the lock |
| Cancel | `actorUserId` on the refund warning | the authenticated id the session carries, the same one the log lines use |
| Both writes | `pointId` in the log line | `req.staff.pickupPointId` |
| Both writes | the refusal code | the `AppError` code each branch raises |
| Screen | every refusal text | the response `code` through `refusalCode`, into the `staff` catalog |
| Screen | whether the two controls are enabled | `point.isActive` from the existing `GET /api/staff/point` answer |

**Key invariants**:

- The queue lists orders of the worker's current point only, and only while they read `SHIPPED`. A worker who moves to another point sees the new point's parcels on the next request, because the guard re-reads the role row every time.
- `Order.pickupPointId` is the only ownership proof. A point parameter and an account id from the request are never accepted.
- A delivered line is never cancelled and never returns stock.
- The cancellable set is computed from line statuses read under the order lock, never from the request, so the stock comes back once even after a double press or a lost answer.
- `receiptDate` and `handedOverAt` come from the server clock inside the transaction, and `handedOverAt` is written once, by the first transaction that leaves the order `DELIVERED`.
- A paid order that loses a line to a cancel keeps `paymentStatus = PAID` and leaves one `payment.refund_owed` warning naming the amount. No route refunds anything.
- A handover writes no stock, no money and no total, which keeps the rules of specs 0002, 0013 and 0016.
- No buyer identity reaches the queue answer, the screen or an error message. The one place an order's buyer is named is the server side refund warning of AC-8, which carries no copy to a screen.
- Both writes act only on an order reading `SHIPPED`, so the counter can neither deliver nor cancel a parcel the shipping pass has not marked sent.
- The feature adds no column, so no schema copy and no generated client changes.

**Security model**:

Every route sits behind the `__auth` session cookie. `requirePointWorker` reads the caller's own `PointWorker` row by `userId` on every request and puts the point on the request, refusing an account without the role with `403 NOT_POINT_WORKER` and answering `503 STAFF_ROLE_UNAVAILABLE` when the read itself fails. Both writes carry `requireActiveAccount` first, so a `PENDING` account is refused `403 EMAIL_NOT_CONFIRMED` before its role is read. Ownership is `Order.pickupPointId = req.staff.pickupPointId`, and another point's order answers the same `404` as a missing one, so the response never says whether an order exists. The queue answer and the screen carry no buyer name, email, phone or address, which keeps the rule spec 0002 set for the seller panel; the order number and the items are what the worker needs to find the parcel.

This feature makes a risk spec 0017 recorded real. The grant is self service, so any confirmed account can attach itself to any active point and then hand that point's parcels over and cancel them. Spec 0017 called the blast radius a wrong handover rather than a breach; after this feature a wrong grant can also cancel an order and return its stock, and the refund is manual. The rule for who may grant a role stays owed, and this spec repeats it in Follow-up rather than inventing an approval step inside a handover feature. No payment, health or regulated personal data enters the feature, so no compliance scope applies, and no new rate limit is added: every call needs a live session and a role row, and a repeat writes nothing. The `SHIPPED` precondition bounds what either route can touch, and it is what keeps the counter from colliding with the shipping pass, which moves `CONFIRMED` lines only.

**Critical test scenarios**:

- Happy path: a cash order placed at the point reaches `SHIPPED`, appears in the worker's queue with its items and total, is handed over in one confirmed press, the lines read `DELIVERED` with one `receiptDate`, the order reads `DELIVERED` with `handedOverAt`, the row leaves the queue, and the buyer's screen prints the handover date, verifies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-11**, **AC-16**.
- Counter cancel: a shipped order is cancelled at the counter, every shipped line becomes `CANCELLED`, each line's stock comes back once, a paid order keeps `PAID` and writes one `payment.refund_owed` with the summed line amount and `reason: "point_cancel"`, and the order reads `CANCELED`, verifies **AC-6**, **AC-7**, **AC-8**.
- Partial order: an order with one `DELIVERED` line and one `SHIPPED` line appears in the queue, the handover closes the shipped line and the order, and a cancel on the same state cancels the shipped line, leaves the delivered one and recomputes the order to `DELIVERED`, verifies **AC-5**, **AC-6**.
- Concurrency: two workers of one point press the handover at the same moment on the real database with `ORDER_DB_TESTS=1`, the order lock serialises them, `handedOverAt` is written once, and the loser reads `409 ALREADY_HANDED_OVER`, verifies **AC-5**, **AC-15**.
- Permission: a worker of another point calls both writes and answers `404 ORDER_NOT_FOUND` on each; an account with no role answers `403 NOT_POINT_WORKER`; a `PENDING` account answers `403 EMAIL_NOT_CONFIRMED`; a switched off point answers `409 PICKUP_POINT_INACTIVE` on both writes while the queue still answers, verifies **AC-4**, **AC-9**, **AC-10**.
- State refusals: an order still `CONFIRMED` answers `409 ORDER_NOT_SHIPPED` on both routes, a delivered order answers `409 ALREADY_HANDED_OVER` on the handover and `409 NOTHING_TO_CANCEL` on the cancel, and no refusal writes anything, verifies **AC-4**, **AC-6**, **AC-7**.
- Copy and layout: both catalogs in parity, no literal copy in a component, the two dialogs sending nothing until confirmed, every control reachable by keyboard, and no horizontal scroll at 360 px, verifies **AC-13**, **AC-14**.

## Build plan

Tracer Bullet, from the scope header: the thin thread runs from the queue read to one card on `/point` and one confirmed handover that closes a real order, before the cancel and the remaining states thicken it. No slice is UI only.

1. Shared pagination: move `parsePagination` and `parsePaginationValue` out of `seller-order.service.ts` into `apps/api-astrum/src/common/helpers/pagination.ts`, with the refusal taken as a caller supplied `invalid()` factory, import it from the seller read, and keep every seller answer unchanged, satisfies **AC-3**. — done: `apps/api-astrum/src/common/helpers/pagination.ts` holds `parsePagination`/`parsePaginationValue` behind the caller's `invalid()` factory; `seller-order.service.ts` imports it and its `invalidPagination`; `pagination.spec.ts` (5 tests) and the unchanged seller suites (96 tests) are green.
2. Queue read: `apps/api-astrum/src/modules/staff/point-order.service.ts` (the filter, the order, the total, the view mapper with number prices and ISO dates), `point-order.controller.ts`, and the `GET /api/staff/point/orders` route added to `staff.routes.ts` with `requirePointWorker`, satisfies **AC-1**, **AC-2**, **AC-3**. — done: `point-order.service.ts` (`listPointOrders`, `toPointOrderJson` through `toMoney`), `point-order.controller.ts` and `GET /staff/point/orders` behind `requirePointWorker` only; covered by `point-order.service.spec.ts` (the filter, the order, the defaults, the clamp, the 422, the empty page, the nine field row with no buyer field).
3. Handover write: the transaction, the `404`, `409 PICKUP_POINT_INACTIVE`, `409 ALREADY_HANDED_OVER` and `409 ORDER_NOT_SHIPPED` chain, the single timestamp, `recomputeOrderStatus`, `handedOverAt`, the answer and the two log lines, satisfies **AC-4**, **AC-5**. — done: `handOver` with one transaction under `lockOrder`, the `404` → `PICKUP_POINT_INACTIVE` → `ALREADY_HANDED_OVER` → `ORDER_NOT_SHIPPED` chain, one server timestamp on every shipped line and on `handedOverAt`, `staff.point.handed_over` and `staff.point.handover_refused`; the two worker race is proved on Postgres in `point-handover.integration.spec.ts` (`ORDER_DB_TESTS=1`, one `200` and one `409 ALREADY_HANDED_OVER`).
4. Cancel write: the `SHIPPED` precondition and its place in the refusal chain, `expireSessionForCancel` before the transaction opens, the cancellable set read under the lock, the stock return of exactly those lines, the payment resolution, the refund warning with the summed amount and both user ids, and `409 NOTHING_TO_CANCEL`, satisfies **AC-6**, **AC-7**, **AC-8**. — done: `cancelOrder` with `assertOwnOrder` + `expireSessionForCancel` before the transaction, the cancellable set read under the lock, `returnOrderStock` for exactly those lines, the payment resolution, the `payment.refund_owed` warning with the summed line amount and both user ids, and `NOTHING_TO_CANCEL` before the shipping claim; the stock return is proved once on Postgres in the same integration suite.
5. Point gate: the `PickupPoint` read inside both writes and the `409 PICKUP_POINT_INACTIVE` branch, which carries the refusal spec 0017 left open, satisfies **AC-9**. — done: `requireActivePoint` runs inside both transactions after the `404` check and before the closed and status checks; a switched off point answers `409 PICKUP_POINT_INACTIVE` on both writes while the queue still answers.
6. Storefront data layer: `usePointOrders` over `getData` with `page` and `limit` appended, the mutations over `patchItem`, the point order types, and the `staff.point.queue` keys in both catalogs with `staff.point.queueLine` deleted, satisfies **AC-10**, **AC-13**. — done: `hooks/staff/pointOrder.types.ts`, `usePointOrders` (page appended, `mutate` drops every page), `usePointOrderAction`, and `staff.point.queue` in both catalogs with `staff.point.queueLine` deleted (`staff.courier.queueLine` kept); parity holds.
7. Storefront screen: the queue block inside `PointWorkspace` (`features/pages/PointWorkspace/`), one card component, the two `AlertDialog` components, the states of AC-10, the `Show more` append, the disabled controls on a switched off point, and the refusal map of AC-12, satisfies **AC-10**, **AC-11**, **AC-12**. — done: `PointWorkspace/components/PointQueue/` (`index.tsx`, `PointOrderCard.tsx`, `OrderActions.tsx`), `lib/refusals.ts` with the nine codes and a retry only where it is safe, and the queue rendered where the placeholder stood.
8. Layout and accessibility pass: the content container, the 360 px stack, the focus ring, the 32 px targets, the busy announcement and the focus move to the queue heading, satisfies **AC-14**. — done: the storefront content container, `flex-wrap` stacks at 360 px, the project `focus-visible` ring on the heading, `h-8` (32 px) dialog controls, one polite live region carrying the busy label and the success text, the initial focus on the keep control, and the focus move to the heading after a move.
9. Tests and the gate: the gateway suites of AC-15 (including the two worker race on the real database), the storefront suites with the rewritten `PointWorkspace` suite, the seller read suites after the extraction, then `pnpm quality-gate`, satisfies **AC-15**. — done: 45 gateway tests across `point-order.service.spec.ts`, `staff.routes.spec.ts` and `pagination.spec.ts`, 3 Postgres tests in `point-handover.integration.spec.ts` (`ORDER_DB_TESTS=1`), the rewritten `PointWorkspace` suite plus `pointOrders.test.tsx` and `refusals.test.ts` (368 customer tests in 69 files), `pnpm --filter @astrum/customer lint` 0 errors, and `pnpm quality-gate` 18 of 18 tasks successful.
10. Walk `verify.md` on the running stack, satisfies **AC-16**. — not done: no step of the walk has been run against this build yet; the walk needs the fixtures `verify.md` lists (two worker accounts, 21 shipped orders, a paid and a cash order, a delivered line) and `POST /api/auth/register` still answers `500` for a fresh address, so the two worker accounts are blocked as recorded in the Deferred list.

## Consequences

**Positive**:

- A parcel can finally be closed where it physically is, by the person holding it. Until now only a seller could close an order, and a seller is not at the counter.
- The cancel at the counter returns the stock the same day instead of waiting for the buyer to find the order screen, and a paid order leaves a line naming the money.
- No schema change: the whole feature is built from columns specs 0013 and 0016 already added, so there is no migration, no fourth schema copy edit and no client regeneration.
- The queue reuses the point the role guard already resolves, so a worker who moves to another point sees the new point on the next request with no new authorisation code.
- The order lock and the cancellable set read under it make the stock return once even after a double press or a lost answer.

**Negative / tradeoffs**:

- The seller handover still exists until scope row 21 removes it, so two routes write `DELIVERED` for a while, and a seller can still close a parcel the point has not received. The lock keeps the data correct, not the process.
- One press closes a multi business order: a worker delivers or cancels every seller's parcel of that order at once, which the scope row asked for and which a point cannot physically check.
- Nothing records which worker handed a parcel over beyond a log line, so a log rotation loses the trail. The audit table stays owed.
- A cancel of a paid order only logs `payment.refund_owed`; the money returns by hand, and the buyer reads a cancelled line on an order that may still read `DELIVERED` when it holds a delivered line.
- The counter cannot cancel an order the platform has not marked sent yet, because both writes carry the `SHIPPED` precondition. A buyer who changes their mind before the shipping pass runs is served by the order screen, not by the worker.
- `shipOrder` in `order-shipping.ts` takes no order lock today. Under this rule it cannot collide with the counter, because it moves `CONFIRMED` lines only and the counter touches `SHIPPED` ones. Any later feature that lets a worker cancel an order at another status needs both the lock and the provider session expiry, and would reopen the race this rule closes.
- The queue query filters `pickupPointId` and `status` with only the existing `pickupPointId` index, so the status is checked over that point's rows. It is right at this size and needs a composite index once a point holds thousands of orders.
- The read carries the whole order with its lines, so a card costs one row per order and the page is capped at 50 by the existing limit rule.
- A `Show more` list keeps its own accumulated pages, so a refresh starts from the first page again, and a successful action returns the worker to the first page on purpose, because resuming from a shifted offset would silently skip an order.

**Neutral**:

- The tag is GA, so `/check verify`, `/test` and a review on another model follow the build.
- Two earlier criteria are read through this spec where they differ, and neither is edited in place: spec 0013, AC-11 made the seller handover the only route that closes a parcel, and this spec adds a second writer for `SHIPPED` lines; spec 0016, AC-5 keeps the seller's table unchanged, and the staff routes are a separate table in a separate module.
- The `/point` placeholder line and its catalog key go away, which closes the last "this arrives later" copy on the staff pages.
- No new environment variable, secret or dependency is introduced.

## Follow-up

- [ ] The rule for who may grant a staff role, carried from spec 0017. After this feature a self granted role can also cancel an order and return its stock, so the risk spec 0017 accepted as "a wrong handover" now includes a wrong cancellation.
- [ ] A pickup code the buyer shows at the counter (spec 0013, Follow-up). Today whoever holds the order id collects the parcel, and a worker has no second proof.
- [ ] A durable record of who handed a parcel over: an audit table, or a column on an order, replacing the log line that a rotation loses.
- [ ] A refund route. A counter cancel of a paid order leaves `payment.refund_owed` and nothing else, exactly as specs 0015 and 0016 left it, and the delivery price is not part of the amount named today.
- [ ] A notification to the buyer when the parcel is handed over or cancelled at the counter, which needs the letters feature of scope row 16.
- [ ] A composite index on `Order(pickupPointId, status)` once a point holds enough orders for the filter to matter.
- [ ] Scope row 21 removes the seller handover. Until it lands, the two routes coexist, so its order matters: the seller must lose the action before the point becomes the only path in any documentation the buyer reads.
- [ ] `OrderPageHeader` prints the placed date with no `timeZone`, while the request config pins the formatter to UTC, so the buyer reads a UTC time where the seller panel passes `browserTimeZone()`. Found while measuring this feature; it is a one line fix in a screen this spec does not touch.
- [ ] The shipping pass takes no order lock, as noted in Consequences. Nothing reaches it today, and a future writer that closes a `CONFIRMED` order would need the lock taken inside its own transaction first.

## Rationale

Reasoning, the options weighed, and the measured state of the code before the decision: see [rationale.md](rationale.md).
