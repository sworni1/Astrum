# Rationale: 0011. Customer cancel on the order screen

## Context

The order screen has carried a cancel button since the page was split into named components. It calls `PATCH /api/orders/:orderId/status` through `useUpdateOrderStatus`, and `useCancelOrder` turns a refusal into one of two toasts: the one that names a blocking line status and a generic failure. The gateway side was designed and verified separately (spec 0002, AC-10), which is why the scope of the order flow records the screen path as never walked end to end and the ladder as having no verify step.

Four gaps sit between the two halves.

The button is offered at `OrderStatus.PENDING` only, so a `CONFIRMED` order cannot be cancelled from the screen even though `cancelOrder` accepts it: the blocking line statuses are `SHIPPED`, `DELIVERED`, `RETURNED`, `BACKORDERED` and `REPLACED`, and a confirmed line is cancelled with its stock returned.

A press sends the request immediately. Cancellation returns every cancelled line to stock, rewrites the lines and can cancel a pending payment, and nothing on the screen can undo it.

A refusal raises a toast and stops there. The order in the cache keeps whatever it held, so the screen goes on offering an action the gateway has already refused, and the customer sees no reason beyond one line of toast text.

The payment line reads `paymentStatus === PAID ? Paid : Payment Pending`. Cancelling an order whose payment is pending writes `CANCELLED` to that column (spec 0002, AC-12), so the screen prints "Payment Pending" on an order it has just cancelled.

The stack is settled: Next.js 16 App Router storefront, SWR for data, Radix primitives behind shadcn components, next-intl for copy, vitest for tests. The gateway and the database are not touched by this decision.

## Options considered

### Option 1: Finish the existing screen path in place

Keep the endpoint, the transaction and the screen, and complete the storefront around them: a confirmation dialog, the two eligible statuses, the gateway answer written into the cache, a re read after every refusal, and a payment label table.

**Pros**:

- One place owns cancellation end to end (spec 0002) and one screen path reaches it.
- The responses, the refusal codes and the copy helpers already exist, so the change stays inside the order feature.
- Every gap is closed by code the repository already patterns after elsewhere, including a confirmation dialog on the seller panel.

**Cons**:

- The action stays offered after a refusal while the order still reads `PENDING`, so a second press repeats the refusal.
- The order feature gains a dialog component and a payment table.

### Option 2: Keep the one click cancel

Leave the button as it is and rely on the server being idempotent and on the list screen to show the truth afterwards.

**Pros**:

- No new component and no new copy.
- Fewest clicks for a customer who means to cancel.

**Cons**:

- A mistaken press closes an order, returns stock and cancels a pending payment with no way back from this screen.
- The other three gaps (the confirmed order, the stale cache, the payment line) stay open.

### Option 3: Pre gate the action on a client copy of the blocking list

Hide or disable the action when any line reads `SHIPPED`, `DELIVERED`, `RETURNED`, `BACKORDERED` or `REPLACED`, mirroring `CUSTOMER_CANCELLATION_BLOCKERS` in the storefront.

**Pros**:

- A customer never presses an action that cannot succeed.
- The screen reads as decided rather than as hopeful.

**Cons**:

- A client copy of a server rule drifts silently: when a status joins the server list, the action simply stops appearing and nothing fails.
- A confirmed order whose line ships between the read and the press still holds a stale copy, so the mirror buys one round trip and not certainty.

### Option 4: Add a dedicated eligibility or preview endpoint

Ask the gateway whether this order may be cancelled, then decide in the client, or add a second cancel route shaped for the screen.

**Pros**:

- One source of truth for eligibility, read on demand.
- A preview could also report what the stock return would do.

**Cons**:

- The gateway already answers the question by refusing, with `from` naming the blocking line status, and it owns the transaction.
- A second route or a preview read puts a second owner on the same rows.

## Rationale

The gateway was designed first and it is the authority: it locks the order row, checks ownership, checks the line statuses, rewrites the lines, returns stock and recomputes the order status in one transaction (spec 0002, AC-8 to AC-11). Any rebuild of that rule in the browser becomes a second opinion that can disagree, and the reference the project follows for screens over an existing API is explicit that actions are a hint and never a permission. Option 3 and Option 4 both buy a shorter dead end at the price of a second owner for the rule; Option 2 leaves three of the four gaps open. Option 1 keeps the one owner and closes the gaps the customer can feel.

The confirmation is not decoration. The action returns stock and can cancel a payment, and nothing in this project can undo it: the seller panel already guards its two destructive moves with a dialog, so the customer side matches the convention the repository wrote down. The cost is one click, and it is the reason a misclick no longer closes an order.

Writing the `PATCH` response into the cache first is what makes the scope's promise ("the screen shows the new status without a reload") true without a second round trip, and revalidating afterwards keeps the screen honest about a line that a seller changes a second later. The refusal branch re reads for a different reason: a `409` is proof that the cached order is older than the gateway, so trusting the cache after it would be trusting data already known to be wrong.

The payment label table replaces a boolean test with a table because the enum has five values and the boolean collapses four of them into one wrong sentence. A cancelled order printing "Payment Pending" is the kind of untruth that survives review on a screen nobody opens after cancelling.

The dialog deliberately says nothing about money beyond a pending payment being cancelled. Refunds do not exist in this project (spec 0002, AC-12, and the deferred row in the order flow scope), so any promise would be a false one, and the payment line is where the customer reads what actually happened.

References: none. The stack is settled, the sources that shaped the decision are the two project specs and the code they describe, and the reasoning stays here rather than in a citation list.
