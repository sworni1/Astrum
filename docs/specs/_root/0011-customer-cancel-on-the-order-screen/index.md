# 0011. Customer cancel on the order screen

**Date**: 2026-11-11
**Status**: Accepted

## Summary

The gateway already cancels an order and the order screen already has a cancel button (spec 0002). The path between them is unfinished. One click cancels, an order that reads `CONFIRMED` cannot be cancelled from the screen although the gateway accepts it, a refusal leaves stale data on the screen, and a cancelled order prints "Payment Pending" because the payment it cancelled now reads `CANCELLED`. This decision finishes that path: a confirmation before the request, the action offered at the two statuses the gateway accepts, the gateway answer written into the cache so the screen changes without a reload, a re read after every refusal, and a label of its own for a cancelled payment.

## Requirements

**User stories**:

- As a customer, I want to cancel my order from its screen after one confirmation, so that a misclick does not close an order and return its stock.
- As a customer, I want the screen to show the cancelled order immediately, so that I do not have to reload to learn whether it worked.
- As a customer whose order can no longer be cancelled because one item already shipped, I want the refusal to name that item status, so that I know why and what to do next.
- As a customer with a pending payment, I want the dialog to say what happens to that payment, so that I am not surprised by the payment line afterwards.

**Acceptance criteria** (the contract):

- **AC-1**: The order screen offers the cancel action only while the order reads `PENDING` or `CONFIRMED`. At `SHIPPED`, `DELIVERED` or `CANCELED` it renders no cancel action. The orders list and its cards carry no cancel action at all, so the order screen stays the only place an order is cancelled.
- **AC-2**: Pressing the cancel action opens a confirmation dialog and sends nothing. The dialog carries a title naming the order number in the same eight character form the header uses, the sentence that every line which is not cancelled yet returns to stock and that this screen cannot undo the cancellation, a keep control and a sending control. Escape, the overlay and the keep control each close it without a request. Only the sending control sends.
- **AC-3**: The dialog names the payment only when the order's `paymentStatus` is `PENDING`, and then it says that the pending payment is cancelled with the order. When the payment reads `PAID` the dialog says nothing about money. No string in this feature promises a refund, a refund amount or a refund date, because the project has no refund path (spec 0002, AC-12).
- **AC-4**: Confirming closes the dialog and sends exactly one `PATCH /api/orders/:orderId/status` with `{ "status": "CANCELED" }`. While the request is in flight the header cancel control keeps focus, carries `aria-disabled="true"` and `aria-busy="true"`, shows the spinner in place of its icon and label, and its handler returns before sending, so a repeated press sends no second request. It is not a `disabled` button, because the dialog hands focus back to it while the request is still running.
- **AC-5**: On a successful answer the screen shows the cancelled order without a page reload: the returned order body is written into the `/orders/:orderId` cache first, then `/orders/:orderId` and `/orders` are revalidated in the background. The status badge reads Cancelled, the delivery progress block disappears, every `CANCELLED` line reads Cancelled, the cancel action is gone, and a success toast appears. The `/orders` list agrees with the detail screen once the customer returns to it, without a full reload of the page.
- **AC-6**: Every request outcome surfaces and re reads the order. A `409` carrying `INVALID_STATUS_TRANSITION` with a `from` that names a known line status raises the toast that names that status (the existing `orders.cancelBlockedByLine` copy). A `404` carrying `ORDER_NOT_FOUND` and any other answer that carries a body raise the generic failure toast. A failure with no answer at all (a timeout or a dropped connection) raises its own toast, `orders.cancelUnconfirmed`, because the gateway may have committed the cancellation before the answer was lost and calling that a failure would be a lie. In every one of those branches `/orders/:orderId` and `/orders` are revalidated through `Promise.allSettled` before the hook returns, so a failed re read never rejects out of the handler. The action stays offered when the re read still answers `PENDING`, and that case only exists while another line is active: an order whose only line shipped reads `SHIPPED` and offers no action at all.
- **AC-7**: The payment line on the order screen reads its label from one table keyed by `paymentStatus`, in sentence case: `PAID` reads Paid, `PENDING` reads Payment pending, `CANCELLED` reads Payment cancelled, `FAILED` reads Payment failed, `REFUNDED` reads Refunded. The table is typed like the existing `ITEM_STATUS_KEYS` table, as `Record<string, PaymentStatusKey>` read through `paymentStatusKey(status: string)`, so a value outside the enum prints the raw value instead of a blank or a wrong label. A cancelled order whose payment was already taken prints Cancelled beside Paid, which is the truth: the money was taken and this project has no refund path.
- **AC-8**: The cancel action carries the `XCircle` icon from `lucide-react` instead of the current `Edit` pencil, and its label stays `orders.cancel`.
- **AC-9**: Every new string exists in `apps/customer/messages/en.json` and `apps/customer/messages/ru.json` under `orders`, with the same keys and the same meaning in both. The keys are `orders.cancelDialog.text`, `orders.cancelDialog.paymentPending`, `orders.cancelDialog.keep`, `orders.cancelDialog.confirm`, `orders.cancelUnconfirmed`, and `orders.paymentStatus.{paid,pending,cancelled,failed,refunded}`. The dialog title adds no key: it renders the existing `orders.number` message with the same eight character order number the header prints. The two keys the payment table replaces, `orders.paid` and `orders.paymentPending`, are deleted from both catalogs once nothing reads them, so no dead copy stays behind.
- **AC-10**: The confirmation uses `AlertDialog` from `@/components/ui/alert-dialog`, the primitive this project already gives its irreversible confirms (removing a cart line, signing out, deleting an account), so it carries `role="alertdialog"`, announces a title and a description, and puts the initial focus on its keep control rather than its sending one, whatever the primitive would focus by default, because the action is irreversible. Escape and the keep control close it without a request, and closing returns focus to the cancel control in the header, which stays focusable while the request runs (AC-4).
- **AC-11**: The behaviour is locked by tests that fail without it: the dialog sends nothing until its sending control is pressed; a success writes the response into the cache before revalidating both keys; a `409` naming `SHIPPED` raises the named toast and revalidates; a failure with no answer raises the unconfirmed toast and still revalidates; the payment table covers the five values and falls back to the raw value; the header offers the action at `PENDING` and `CONFIRMED` and not at `SHIPPED`, `DELIVERED` or `CANCELED`. The two suites that stub `useUpdateOrderStatus` today, `OrderPage/hooks/useCancelOrder.test.tsx` and `OrderPage/index.test.tsx`, gain the new function in their mock. `pnpm --filter @astrum/customer test` passes.

## Decision

**Chosen option**: Option 1: Finish the existing screen path in place.

Keep the one existing endpoint and the one existing service transaction, and complete the storefront path around them: a confirmation, the two eligible statuses, a cache write from the response, a re read after every refusal, and an honest payment label.

**Implementation skills**: none consulted.

## Feature design

**Data model sketch**:

No schema change and no migration. The screen reads the order body the gateway already returns: `Order.id` (displayed as its last eight characters), `Order.status`, `Order.paymentStatus`, `Order.currency`, and `Order.orderItems[].status` for the per line labels.

**State transitions** (what the customer sees, not a new server flow):

| Order reads | Action offered | After a successful cancel |
| --- | --- | --- |
| `PENDING` | yes | `CANCELED`, every `PENDING` and `CONFIRMED` line becomes `CANCELLED` |
| `CONFIRMED` | yes | same |
| `SHIPPED` | no | not reachable from this screen |
| `DELIVERED` | no | not reachable from this screen |
| `CANCELED` | no | the repeat answers the stored order and writes nothing |

The server side of this table is spec 0002, AC-8 and AC-10. This spec adds the two rows the screen was missing and the client behaviour around each.

**API surface** (one existing endpoint, unchanged):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
| --- | --- | --- | --- | --- | --- |
| `/api/orders/:orderId/status` | PATCH | `status: "CANCELED"` | the updated order body, same shape as the detail read | `__auth` session cookie, order owner | `404 ORDER_NOT_FOUND`, `409 INVALID_STATUS_TRANSITION` with `from` and `to`, `422 VALIDATION` |

**Value sourcing**:

| Action | Value produced or displayed | Source |
| --- | --- | --- |
| Offering the action | whether the order may be cancelled from here | `Order.status` from the order body (`PENDING`, `CONFIRMED`) |
| Dialog title | the order number | `Order.id`, last eight characters, the same form the header prints |
| Dialog stock sentence | the stock consequence | a catalog string under `orders`, no value computed |
| Dialog payment sentence | whether a payment is pending | `Order.paymentStatus` of the order being cancelled |
| Sending the request | the target status | the literal `"CANCELED"` in `useCancelOrder` |
| Busy state | request in flight | `isMutating` of the SWR mutation in `useUpdateOrderStatus` |
| New status on screen | the order after the cancel | the `PATCH` response written into the `/orders/:orderId` cache, then `GET /api/orders/:orderId` and `GET /api/orders` |
| Named refusal | the blocking line status | `from` of the `409` body, mapped through the existing `itemStatusKey` helper |
| Payment label | the payment text beside the status badge at the top of the overview card | `Order.paymentStatus` through `paymentStatusKey(status)` and the new `PAYMENT_STATUS_KEYS` table in `OrderPage/lib/payment.ts` |
| Toast copy | success and failure text | catalog keys under `orders`, no server `message` is ever displayed |

**Key invariants**:

- The screen never decides who may cancel. The offered action is a hint; the gateway re checks ownership and the line statuses on every request, and every refusal is surfaced.
- No request leaves without an explicit confirmation.
- One confirmation produces at most one request, and the busy control blocks a second.
- The client keeps no copy of the gateway's blocking line list (`SHIPPED`, `DELIVERED`, `RETURNED`, `BACKORDERED`, `REPLACED`). A client copy drifts silently and hides the action without a trace when a status is added.
- Refusal branches read the response `code` and `from`, never the English `message` the gateway sends.
- No string promises money back.
- The cache never keeps a state the gateway refused: every refusal branch re reads before returning.
- The order screen and the orders list share the same truth, so the list is revalidated in the same action.
- The detail is re read even though its body was just written into the cache: a seller line change can land between the commit and the render, and one read per cancel is cheaper than a screen that shows a status the gateway has already left.

**Security model**:

The route sits behind `app.use("/api/orders", authenticateToken, orderRoutes)` (`apps/api-astrum/src/app.ts`), so a request without a live session answers `401` before the controller. Ownership is enforced inside `cancelOrder` by `where: { id, userId }`, and a missing or foreign order answers `404 ORDER_NOT_FOUND` without revealing which case occurred (spec 0002, AC-10). The route carries no `requireActiveAccount` and this feature does not add one: an account whose status went back to `PENDING` after an email change can still cancel its own older order, which only reduces commitment and returns stock, while spec 0005 gates ordering, reviews and profile writes. No new regulated data enters the screen.

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: open a `PENDING` order, press the action, confirm, and watch the badge, the lines and the payment line change without a reload, verifies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-7**.
- Eligible status: open a `CONFIRMED` order and cancel it from the screen, verifies **AC-1**.
- Refusal by line: ship one line of a `PENDING` order as the seller, then cancel as the customer, and confirm the toast names Shipped and the order was re read, verifies **AC-6**.
- Transport failure: stop the gateway, press confirm, and watch the generic toast and the re read attempt, verifies **AC-6**.
- Silent send: open the dialog, close it with Escape, with the overlay and with the closing control, and confirm no request was sent, verifies **AC-2**, **AC-10**.
- Terminal status: open a `SHIPPED`, a `DELIVERED` and a `CANCELED` order and confirm no cancel action renders on any of them, verifies **AC-1**, **AC-8**.
- Copy: switch to Russian and confirm the dialog, both toasts and all five payment labels read Russian with no missing key, verifies **AC-3**, **AC-9**.
- Regression: `pnpm --filter @astrum/customer test` fails on a checkout that drops the cache write, on a missing confirmation, on a lost re read and on a missing catalog key, verifies **AC-11**.

## Build plan

Tracer Bullet: the thinnest complete thread first (press, confirm, request, new status on screen), then the refusal path and the payment line, then the copy, the accessibility pass and the tests.

1. Extend `useUpdateOrderStatus` so a successful mutation writes the returned order into the `/orders/:orderId` cache with no revalidation (`mutate(key, data, false)`) and then revalidates `/orders/:orderId` and `/orders`, and expose a `revalidateOrder` function that revalidates both keys through `Promise.allSettled` and never rejects, for the failure path, satisfies **AC-5**, **AC-6**. — done: `useUpdateOrderStatus` writes `mutate(orderKey, order, false)` then revalidates both keys through `revalidateOrder`, and `useUpdateOrderStatus.test.tsx` pins that call order.
2. Add `OrderPage/components/CancelOrderDialog/index.tsx` on `AlertDialog` (a title from `orders.number`, the stock sentence, the optional pending payment sentence, the keep control, the sending control) and `OrderPage/lib/cancelDialogCopy.ts` holding the payment conditional, satisfies **AC-2**, **AC-3**, **AC-10**. — done: both files exist; the dialog owns its own trigger and open state, and the initial focus is put on the keep control explicitly instead of trusting the primitive.
3. Wire the dialog into `OrderPage/components/OrderPageHeader/index.tsx`: local open state, the `XCircle` icon, the busy state from `isCancelling` rendered as `aria-busy` and `aria-disabled` with an early return in the handler instead of a `disabled` attribute, the eligible statuses changed to `PENDING` and `CONFIRMED`, satisfies **AC-1**, **AC-4**, **AC-8**. — done: the header renders the dialog behind `canCancel(order.status)` and the dialog carries `XCircle`, `aria-busy`, `aria-disabled` and the early return; `OrderPageHeader/index.test.tsx` covers the five statuses.
4. Rework the outcome path in `OrderPage/hooks/useCancelOrder.ts` so `cancelRefusal` runs first, the named status toast keeps its branch, an answer carrying an error keeps the generic toast, a failure with no answer raises `orders.cancelUnconfirmed`, and every branch awaits `revalidateOrder` before returning, satisfies **AC-6**. — done: `cancelRefusal` returns `cancelUnconfirmed` when the request got no answer (`refusalAnswered` in `apiRefusal.ts`), and every refusal branch awaits `revalidateOrder`; the four outcome branches are covered in `useCancelOrder.test.tsx`.
5. Add `PAYMENT_STATUS_KEYS` to `OrderPage/lib/payment.ts`, typed `Record<string, PaymentStatusKey>` and read through a `paymentStatusKey(status: string)` function that falls back to the raw value, and switch `OrderPage/components/OrderOverviewCard/index.tsx` to it, satisfies **AC-7**. — done: the table and the reader live in `lib/payment.ts`, the overview card prints the key or the raw value, and `payment.test.ts` pins all five values plus the fallback.
6. Add `orders.cancelDialog.{text,paymentPending,keep,confirm}`, `orders.cancelUnconfirmed` and `orders.paymentStatus.{paid,pending,cancelled,failed,refunded}` to `apps/customer/messages/en.json` and `apps/customer/messages/ru.json`, delete `orders.paid` and `orders.paymentPending`, satisfies **AC-3**, **AC-9**. — done: both catalogs carry the same keys, `orders.paid` and `orders.paymentPending` are gone, and no new string mentions money coming back.
7. Write the tests: the dialog sends nothing without a press, the success path writes the cache before revalidating, the `409` branch raises the named toast and revalidates, a failure with no answer raises the unconfirmed toast and still revalidates, the payment table covers five values and falls back, the header offers the action at two statuses and not at three. Extend the mock of `useUpdateOrderStatus` in `OrderPage/hooks/useCancelOrder.test.tsx` and `OrderPage/index.test.tsx` with the new function, satisfies **AC-11**. — done: `pnpm --filter @astrum/customer test` 174 tests in 40 files, `pnpm check-types` and `pnpm lint` clean.
8. Walk `verify.md` on the running stack, which is the verify step the scope ladder owes for this row, satisfies every criterion in it.

## Consequences

**Positive**:

- A mistaken click no longer closes an order and returns its stock.
- The screen offers the cancel action at both statuses the gateway accepts, so a confirmed order can still be cancelled from the page a customer is looking at.
- The status changes from the gateway answer instead of a second round trip, and the order list follows.
- A refused cancel re reads the order, so the screen stops presenting data the gateway has already rejected.
- A cancelled order stops claiming its payment is pending, which removes a wrong statement from a screen a customer checks after cancelling.

**Negative and tradeoffs**:

- One extra click stands between a customer who wants to cancel and the cancel.
- The action stays offered after a `409` when the order still reads `PENDING`, which happens while another line is active; the customer learns why from the toast and from the line statuses, and a second press repeats the same refusal. Hiding the action after the refusal would mean keeping a client copy of the blocking list, which drifts.
- A cancel whose answer is lost raises the unconfirmed toast even when the gateway committed it, so a customer may open an order that is already cancelled after being told the result is unknown. Being unsure is the only honest statement available on that branch, and the re read shows the truth.
- The payment table adds labels for `FAILED` and `REFUNDED`, which no flow writes today, so that copy may sit unrendered until payments land.
- The dialog and the payment table add catalog pairs to both locales, which a reviewer has to keep in parity.

**Neutral**:

- No gateway change, no schema change and no migration; the endpoint and its transaction stay as spec 0002 built them.
- Refunds, partial cancellation amounts and any copy about money back stay out of scope; they live in the deferred row of the order flow scope.
- The `print` button beside the cancel action still has no handler; that stays its own decision.

## Follow-up

- [ ] Refunds and partial cancellation amounts need a decision before any string may mention money coming back, and they also own the Cancelled beside Paid pairing an order shows after a paid order is cancelled; the deferred row `Returns and refunds` in `docs/scope/_root/scope.md` owns it.
- [ ] `PATCH /api/orders/:orderId/status` runs without `requireActiveAccount` on purpose (see Security model). If the account rule later refuses every write for a `PENDING` account, this route needs the gate and the `403 EMAIL_NOT_CONFIRMED` branch on the screen in the same change.
- [ ] `orders.cancelOrder` in both catalogs is unused copy for a cancel action on the list cards. It is dead today; delete it when the list screen is next touched, or reuse it if the list ever gains the action.
- [ ] The header `print` button renders with no handler. Give it a handler or remove it in a later screen pass.

## Rationale

Reasoning and the options weighed: see `rationale.md`.
