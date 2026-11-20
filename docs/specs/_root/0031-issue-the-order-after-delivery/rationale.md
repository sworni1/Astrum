# 0031. Issue the order after delivery — rationale

The decision record for [index.md](index.md). The build spec is there; this file holds the context, the options that were weighed and the evidence the numbers rest on.

## Context

The order machine ends at `DELIVERED`, and that status is written by a human: the point worker's press and the courier's press both move the shipped lines to `DELIVERED` and stamp the order, so a parcel reads finished the moment it crosses the counter. The review gate then treats that press as the buyer's own purchase, the seller's revenue counts the same lines, and the buyer's own screen shows the fourth and last step at the moment the parcel is still in the worker's hands.

The project has no real logistics. The shipping pass already invents the first half of the trip: an order the shop accepted becomes sent by itself after one minute, because `ORDER_SHIPPING_DELAY_MS` is the only clock this demo owns. That leaves the second half missing, which is why the arrival has to be pressed by a person and why the machine has nowhere to go afterwards.

The consequence of not deciding is measured, not hypothetical: 21 orders in the dev database read `DELIVERED`, and 18 of them carry the stamp the counter wrote, so 27 lines already claim a purchase the buyer could review while the parcel is still on the shelf. Adding the missing state afterwards means rewriting every rule that reads `DELIVERED`, which is the work this spec does once.

## Options considered

### Decision A: where the flow ends

**Option 1: an automatic `DELIVERED` and a human `ISSUED` (chosen)**

The pass writes `DELIVERED` one wait after the parcel shipped, and the counter writes `ISSUED`, which becomes the only terminal state of a parcel.

**Pros**: the two moments a real shop has (arrived, handed over) each get a status; no human invents the arrival; every «this parcel is mine» rule has one state to read.

**Cons**: a fifth step in the rail and a fifth member in two enums, which every label table has to answer; two statuses now read as good news to a buyer.

**Option 2: keep four states and let staff write `DELIVERED`**

Leave the machine as it is, move only the review gate and the copy.

**Pros**: the smallest diff; no migration of existing rows; no new step in the rail.

**Cons**: the arrival stays a press, so the buyer reads «доставлен» at the counter and the demo keeps a timeline a real shop cannot have; nothing in the machine separates «waiting for me» from «in my hands», so a later rule that needs the difference (a storage fee, a return window) has to add the state anyway.

**Option 3: the buyer confirms receipt**

The parcel reads `DELIVERED` by the pass, and the buyer's own press writes `ISSUED`.

**Pros**: the terminal state is the one event that is really the buyer's.

**Cons**: the scope puts the press at the counter, and a buyer who never presses leaves a parcel that never ends; it also needs a new write on the customer surface plus its refusal rules, which is a larger feature than this slice.

**Option 4: no new status, `handedOverAt` as the flag**

The pass writes `DELIVERED`, and every rule that needs a handover reads `handedOverAt !== null` instead of a status.

**Pros**: two enum members, the migration, the fifth rail step, five label tables and the whole of AC-7, AC-10 and AC-12 disappear, because `handedOverAt` already carries exactly that fact.

**Cons**: the buyer cannot see «выдано» anywhere, since the rail has no state for it and the line row prints one date; the handover rule becomes a nullable timestamp comparison repeated in the review gate, the seller's revenue and the cancel guard; and the accepted scope row for this feature names `ISSUED`, five rail steps and the label in both catalogues, so this option contradicts the feature's own contract instead of bettering it.

### Decision B: the clock that makes `DELIVERED`

**Option 1: a new `shippedAt` column (chosen)**

The pass stamps `Order.shippedAt` when it writes the shipping status, and the second stage waits one delay from it.

**Pros**: the wait means what it says (one delay after shipping), independent of how late a tick ran or how often the pass was skipped; the column is also the honest answer to «when did this leave», which the seller screen may want later.

**Cons**: one nullable column and a backfill for the 2 orders that are already shipped.

**Option 2: measure from acceptance, twice the delay**

No column: the second stage takes orders whose acceptance (the paid attempt or `createdAt`, the rule stage one already applies) is at least two delays old.

**Pros**: no schema change at all.

**Cons**: the arrival is tied to the order's birth rather than its shipping, so a pass that runs late ships and delivers in two consecutive ticks and the two waits stop being observable; the rule also duplicates stage one's acceptance logic in a second place.

**Option 3: `updatedAt` as the shipping marker**

**Pros**: nothing is added.

**Cons**: any later write on the order (a payment status, an address fix) moves the clock backwards, so the arrival can be postponed by an unrelated action. A timer that reads a column with three other writers is not a timer.

### Decision C: what the counters show

**Option 1: arrived parcels only (chosen)**

Both the point queue and the courier pool read `DELIVERED`.

**Pros**: the one press on a card always succeeds; the screen has no disabled control that needs a tooltip to explain itself.

**Cons**: between `SHIPPED` and `DELIVERED` (60 to 120 seconds here) the parcel is invisible to staff, so a worker cannot see that something is on its way.

**Option 2: both statuses, with the press disabled until arrival**

**Pros**: the worker sees the whole day.

**Cons**: a card whose only purpose is to hold a control nobody may press, plus a second copy string for «ещё в пути»; and a queue that mostly shows parcels a worker cannot act on invites the wrong press and the 409 that follows.

**Option 3: keep `SHIPPED` and let the press answer 409**

**Pros**: no read changes.

**Cons**: the queue is a list of refusals by construction, which is exactly the failure this slice exists to remove.

### Decision D: the counter's cancel

**Option 1: a `DELIVERED` parcel is cancellable (chosen)**

`CANCELLABLE_STATUSES` gains `DELIVERED`, and `ISSUED` becomes the only blocker.

**Pros**: keeps the scenario the counter exists for (the buyer changes their mind next to the parcel); the stock returns once and the payment resolves through the code that already runs; the rule reads «a handed over parcel cannot be cancelled», which is what the old clause meant when `DELIVERED` still meant handed over.

**Cons**: widens the cancel window from the shipping moment to the issue moment; the customer's own screen still refuses a cancel on a delivered parcel, so the counter can do something the buyer cannot.

**Option 2: retire the counter's cancel**

**Pros**: one action at the counter, one rule, no stock arithmetic on a delivered parcel.

**Cons**: deletes a working feature the scope did not ask to delete, and leaves a point worker watching a parcel the buyer refuses at the door with no way to close it.

**Option 3: cancel only inside the shipping window**

**Pros**: no rule moves.

**Cons**: the queue would have to list `SHIPPED` again, which Decision C rejected; the cancel would be reachable for at most one tick and then never.

### Decision E: which status carries money and the review

**Option 1: `ISSUED` carries both, the buyer's buckets fold both (chosen)**

The review gate, the seller's revenue and the counters move to `ISSUED`; the delivered tab, its count, the spent tile and the seller's filter fold `DELIVERED` and `ISSUED`.

**Pros**: one rule per question (who earned it, who may review it), and the buyer still reads one bucket called «доставлено»; measured today, the seller's revenue would otherwise fall to zero for every parcel handed over.

**Cons**: two statuses appear in every bucket rule, so a later state has to touch those folds again.

**Option 2: revenue stays on `DELIVERED`, the review gate moves**

**Pros**: the seller's numbers keep counting what the shop sent.

**Cons**: the numbers stop meaning what they say: after this change `DELIVERED` means «arrived», so revenue would count parcels still at the counter and would not change when one is issued.

**Option 3: a separate issued bucket and tab**

**Pros**: the buyer can filter for exactly the parcels they hold.

**Cons**: a fourth tab on a screen the scope fixed at three, plus two counts that mostly agree.

### Decision F: today's history

**Option 1: move the stamped orders only (chosen)**

The 27 lines of the 18 orders that carry `handedOverAt` become `ISSUED`; the 10 lines of the 3 unstamped orders stay `DELIVERED`.

**Pros**: the stamp the counter wrote is exactly the evidence of a handover, so the migration reads the same fact the new code will write; the unstamped rows stay honest as parcels that arrived and were never collected.

**Cons**: 4 fixture lines (`review-check-*` and one more) lose their review eligibility, so the demo database no longer offers a review on the product screen without a fresh order.

**Option 2: move nothing**

**Pros**: no data change, no risk.

**Cons**: every historical handover reads as an uncollected parcel, so the seller's revenue drops to zero for the whole history until new parcels are issued, and the demo shows nothing in «выдано».

**Option 3: move every `DELIVERED` line**

**Pros**: one rule, no exceptions.

**Cons**: invents a handover that never happened for 10 lines and hides the very gap this slice was written about.

## Rationale

The machine is the product here. The counter's press is the only human event a real shop charges for, and the arrival is logistics, which this project already fakes for the first half of the trip with one constant. Making the arrival automatic costs one column and one query, and it turns two vague statuses into two observable moments, which is what lets the review gate, the seller's revenue and the cancel rule each name exactly one state instead of guessing what `DELIVERED` means today.

The `shippedAt` column wins over the no column variants because a timer must read a fact, not a formula over a different fact: measuring from acceptance would deliver a parcel in the same tick it shipped whenever a pass ran late, and `updatedAt` has three other writers. One nullable column is the cheapest honest answer, and its backfill is honest about being approximate.

Moving the counters to `DELIVERED` and the cancel window with it keeps the one promise that matters at the counter, which is that the single press on a card always succeeds. The cancel cost is real and accepted: the window widens to the issue moment, and the buyer's own screen keeps its stricter rule, because the buyer can wait while a worker stands next to a refused parcel.

The revenue and review rules follow `ISSUED` because that is the only state in which the parcel is with the buyer, and the buyer's own buckets fold both statuses so the screen does not grow a fourth tab for a distinction they cannot act on. The history migration reads `handedOverAt`, the same stamp the new press writes, so the old rows land where the new code would put them. The one option that would skip the status entirely (Option 4 of Decision A) was weighed and dropped on the buyer's side: a flag nobody renders leaves «выдано» invisible, and the handover rule would become a nullable comparison in three places instead of one state, which is the thing this feature exists to remove.

## Evidence measured on 2026-11-20

- One schema: `find . -name '*.prisma' -not -path '*/node_modules/*' -not -path '*/generated/*'` prints `./packages/Astrum-db/prisma/schema.prisma`. The scope line «across every schema copy» predates spec 0030.
- `Order` columns today: `id, userId, totalPrice, currency, paymentMethod, paymentStatus, paymentDetails, paymentExpiresAt, status, createdAt, updatedAt, shippingMethod, deliveryAddress, deliveryDate, OrderItem, payments, shippingMethodId, shippingMethodName, deliveryPrice, grandTotal, idempotencyKey, idempotencyHash, pickupPointId, pickupPoint, pickupPointName, pickupPointAddress, handedOverAt, courierUserId`. There is no shipping timestamp.
- Database counts via `docker exec astrum-db psql -U greedyghoster -d astrum-db`: 21 orders `DELIVERED`, of which 18 carry `handedOverAt` (27 `DELIVERED` lines) and 3 do not (10 `DELIVERED` lines, one order named `review-check-order-1` with 4 lines); 2 orders `SHIPPED` with 5 lines; 6 reviews, 2 of them on stamped lines, 4 on unstamped ones.
- `ORDER_SHIPPING_DELAY_MS = 60_000`, `ORDER_SHIPPING_INTERVAL_MS = 60_000`, `ORDER_SHIPPING_BATCH = 20` in `apps/api-astrum/src/modules/order/constants/order.constants.ts:78`.
- `order-shipping.ts` reads no `deliveryDate`: the file mentions `createdAt` and the paid attempt's `paidAt` only.
- The payment sweep filters `status: { in: ["PENDING", "CONFIRMED"] }`, so an issued order with an uncollected cash payment is never closed by it.
- The point handover writes no payment status while the courier's marks `PAID` through `collectsAtTheDoor`, which is why the spent tile needs the `ISSUED` clause for a cash parcel issued at a counter.
- 41 suites across the two apps mention `DELIVERED`, `SHIPPED` or `delivered`; the twelve that assert the rules this spec moves are named in the build plan, and the rest read the status as a fixture value.
- `grep -rn DELIVERED apps/customer/src/features/pages/ProductOverview` prints nothing, so the review control already reads the server's state answer and no client branch moves.
- `staff.point.queue.refusals.notShipped` and `staff.courier.queue.refusals.notShipped` both read «Заказ ещё не отмечен как отправленный.» in `ru.json` and `This order is not marked as sent yet.` in `en.json`.

References: none

