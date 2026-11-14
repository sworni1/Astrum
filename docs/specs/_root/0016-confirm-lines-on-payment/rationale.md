# 0016. Confirm order lines when the order is paid (decision record)

## Context

The seller panel of spec 0007 gave a seller four moves per line: confirm, ship, deliver and cancel. Confirm was the step that turned a placed order into an accepted one, and every screen downstream reads that status: the buyer's order pill, the seller group counts, the cancel rule, the expiry sweep.

Two things broke under that model.

First, a paid order kept reading `PENDING`. The payment module of spec 0015 never touches `Order.status` or `OrderItem.status`: money arrives, `paymentStatus` becomes `PAID`, and the lines wait for a human. So a buyer who paid reads "ожидает" until a seller opens a panel, and the seller's panel shows a paid order with the same `Confirm` button as an unpaid one.

Second, a line whose business has no owner account can never be confirmed by anyone. Measured on the running demo database on 2026-11-14: order `cmwfh8tth0007z4vdlp3kjdx7` holds two lines, the pen at 2 574.00 from `biz_excel_3` and the oven at 24 104.30 from `biz_excel_16`. The payment row is `PAID` for the whole 26 678.30 and the order reads `paymentStatus = PAID`, yet the seller panel of the account that owns `biz_excel_3` shows one line, the oven line stays `PENDING` forever, and the order therefore stays `PENDING`. 16 of the 31 businesses in that database carry `ownerUserId = NULL`.

The owner's rule, stated for this decision: the platform accepts orders, a marketplace accepts them for its sellers (Ozon and WB work this way), and a seller decides one thing, whether it can hand the item over. Under that rule a confirmation click is not a seller's job at all.

## Options considered

### Option 1: Keep the seller confirmation and add a paid label

Leave the transition table as it is and print `PAID` on the seller panel for a paid order.

**Pros**: no server change; the smallest diff.
**Cons**: the buyer still reads `PENDING` after paying; the line nobody owns still hangs; the seller still holds a decision the owner says belongs to the platform.

### Option 2: The server confirms, the seller fulfils

A prepaid order confirms its lines when the paid apply runs, a cash order confirms them when it is written, and the seller keeps two moves: hand over, or the item is gone.

**Pros**: the buyer reads `CONFIRMED` right after paying with no dependency on a seller; the unowned shop problem stops freezing a paid order; the seller surface shrinks to the two decisions the owner described; no schema change.
**Cons**: the acceptance decision leaves the shop; `SHIPPED` and `OUT_OF_STOCK` become write dead ends; a paid order is now a `CONFIRMED` order, which makes the existing customer cancel rule easier to reach.

### Option 3: Confirm on creation for every payment method

Confirm the lines when the order is written, whatever the method, exactly like a marketplace.

**Pros**: the simplest rule to read, one writer.
**Cons**: an abandoned `ONLINE_CARD` checkout would leave a `CONFIRMED` order, and spec 0015, AC-8 deliberately keeps a `CONFIRMED` order alive on expiry instead of closing it, so its stock would never come back.

## Rationale

Option 2 is the only one that satisfies both forces at once. The owner's marketplace rule needs the platform to accept an order, so the confirmation moves to the server. The stock hold of spec 0015 needs an unpaid prepaid order to stay closable, and AC-8 of that spec closes only a `PENDING` order, so a prepaid order must stay `PENDING` until the money lands; Option 3 would have left every abandoned checkout holding stock forever. Option 1 keeps the problem the owner reported.

The two writers also land where the lock already is: the create path writes the order and its lines in one transaction, and the paid apply already runs under `lockOrder`. No new transaction, no new table, and the confirmation inherits the idempotency guards of spec 0015, so a replayed webhook cannot confirm a cancelled line.

Removing the pickup precondition on handover follows from the same rule. Once a seller has no `Ship` and no `Deliver`, the group handover is the only move that closes a parcel, and a courier parcel must close through it too; the pickup point stays on the group header as information, not as a gate.

The money path stays honest. A paid line the seller cancels leaves `paymentStatus = PAID`, returns the stock and logs `payment.refund_owed`, the same warning spec 0015 writes for a paid event after a cancel: the record keeps the money, and the refund stays manual until a route exists. The same warning is written by a customer cancel of a paid order, because this decision makes every paid order cancellable, and money must never leave the record without a line naming it.

This decision amends two sentences of earlier specs and says so instead of editing them. Spec 0015, AC-6 states that the paid apply never touches `Order.status`; here it recomputes the order, because the lines it confirms decide the status. Spec 0013, AC-11 requires a pickup point before a handover; here the same route closes a courier parcel. Both older criteria keep their text and are read through this spec where they differ, so a reader who lands on 0015 or 0013 first still finds the earlier rule, and the later one wins by date.

## References

none
