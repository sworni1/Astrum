# 0020. Read only seller panel: decision record

_Reasoning for [index.md](index.md). `/develop` does not read this file._

## Context

The seller panel at `/seller/orders` shipped with spec 0007 as a place to work: a seller confirmed, shipped, delivered and cancelled lines from it. Two later specs took that work away one arm at a time. Spec 0016 moved confirmation and shipping to the payment and left the seller a single per line move (report the item gone) plus one handover for a whole parcel. Specs 0018 and 0019 then gave the handover two real hands, a point worker and a courier, and the shipping pass of spec 0016 moves an accepted order to `SHIPPED` by itself.

What is left is a panel that offers two controls nobody should use. `PATCH /api/seller/orders/:orderId/handover` still closes every `CONFIRMED` or `SHIPPED` line of an order for the shop owner, which now duplicates a staff route with weaker rules: no point, no claim, no queue, no precondition. `PATCH /api/order-items/:orderItemId/status` still lets a shop owner cancel a line, write a refund warning and return stock, and its transition table has already been narrowed twice by spec 0016. Both routes sit behind `authenticateToken` and `requireActiveAccount` alone, and the second one is the only seller write a `PAID` order still accepts.

The cost of not deciding is a second, quieter handover path on a surface that was designed before any role existed. A parcel closed from the seller panel skips the queue the point worker reads, records no `pointId`, and writes `handedOverAt` with no record of who closed it. The scope row asks for the last arm to go, and it asks for proof that the gateway refuses it, because hiding a button is not a rule.

## Options considered

### Option 1: Delete the write surface, keep one read table

The panel becomes a single table over the answer the read already returns. The two write routes keep their paths and answer a fixed `404` with a code, from one handler that logs the attempt and calls no service. The service write methods, the transition table, the DTO, the two client hooks, the dialog, the action column and the catalog keys that fed them are deleted.

**Pros**:
- The rule lives in one place and cannot be reached by any client, current or stale.
- About 300 lines of gateway code and five client modules leave the tree, so there is nothing left to re expose by accident.
- A tab holding an older bundle still gets a named code instead of a silent failure, and the attempt lands in the log.

**Cons**:
- The seller loses the only way to report an item gone, a move spec 0016 added on purpose.
- The two refusal paths are dead code by design and need their own removal later.
- Two other integration suites used the seller write service as setup and have to write their fixtures directly.

### Option 2: Keep the routes and refuse in front of the live service

The panel becomes read only, and each write route keeps `requireActiveAccount` plus a refusal at the top of its handler, with the service, the transition table, the DTO and their suites untouched behind it.

**Pros**:
- The smallest gateway diff: one early `throw` per handler, no suite deleted.
- A reversible door if the seller ever needs a move back.

**Cons**:
- The write code stays alive with tests that keep asserting rules nobody can reach, and the next reader cannot tell intentional dead code from a bug.
- The transition table already carries two amendments from spec 0016; a third reader would have to reconstruct which arms survive.
- Reversing this decision later would mean rebuilding what this option left behind anyway.

### Option 3: Hide the controls and leave the gateway alone

Delete the handover button and the line action from the panel, keep both routes exactly as they are.

**Pros**:
- The smallest change of all, one component file and its tests.
- No suite touched, no service edited.

**Cons**:
- The scope asks the gateway to refuse a shop owner, and this leaves the weaker handover path open to any direct call.
- A stale bundle keeps both buttons and both of them still work, which is the case that actually happens after a deploy.

### Option 4: Keep the grouped sections and drop the action column

Keep one section per order as it is today, remove the action column and the handover control, and let the panel stay a card per order.

**Pros**:
- The smallest visual change: the header, the point line and the grid all stay.
- No rework of the column labels and no new table markup.

**Cons**:
- The scope asks for a table whose first column is the order number, and a card per order has no such column.
- A reader scanning for one line has to open cards instead of reading a page of rows.

## Rationale

Option 1 wins because the decision is about authority, not about a button. Once the point worker and the courier own the handover, a second writer with weaker rules is a defect waiting for a caller, and the panel is not the place to keep one. Hiding it (Option 3) leaves exactly that caller reachable, and the case that matters is not a user of the new bundle but a tab opened before the deploy, which keeps working until it is closed. Option 2 removes the button but keeps the code that makes the decision, so a later reader sees a live transition table with live tests and no way to tell that nothing can call it; this repository has already paid that cost once, when the `SELLER_ORDER_WORKFLOW_ENABLED` flag was removed on the owner's call rather than left switched off.

Option 4 loses on the shape the scope asks for. A table with an order number column and a status column is what a seller scans when a buyer asks about a parcel, and a card per order forces one card open per question. The table also gives the status column a meaning the cards did not: one line, one status, one row.

The refusal answers `404` with a code rather than `403` because the move no longer exists for anybody, and a `403` would say the caller lacks a permission that nobody holds. The body stays in the project shape (`code` and `message` through `AppError` and `handleErrors`), so a script, a future client and an operator with curl read the same answer. The code is not for the tab that sent the request: the storefront's refusal map goes with the actions, so an old bundle shows its generic failure toast whichever body it receives, and the value of the code is in the log and in a hand written call. The handler takes nothing from the request, which is why it mounts no `requireActiveAccount` and no `validateDto`: there is no body to validate and no account state to check for a call that writes nothing. A 404 handler at the end of `app.ts` would answer every unknown path in one place and let both paths be deleted, but it changes the 404 body of every unknown route in the API, which is a decision of its own; it sits in Follow-up instead of this feature. It logs, because a call to a path that cannot succeed is either a stale tab or a script, and both are worth one line in the log. The log carries the session id (not the body, not the cookie, not the token) so the line names a caller without carrying a credential.

The placed date moved out of the band and into the column, on the owner's call, so that the five columns are complete and the date is printed once. The quantity rides inside the product cell as a suffix (`Widget × 3`) rather than as a sixth column, because the price column is a line sum and a sum without its quantity cannot be checked. The delivery date was offered as its own option and declined: `GET /api/seller/orders` does not select `Order.deliveryDate`, so that option would have widened the read for a value the owner did not want enough to change the payload.

The pending notice goes with the actions. Spec 0007, AC-11 gave it a job: tell an unconfirmed seller that the queue is readable while statuses are locked. With no status to lock, the same sentence promises a change that will never come, and the confirm banner at the top of the page already says the account is unconfirmed.

The deletions are part of the decision, not cleanup after it. A catalog key that no component reads, a hook that no page imports and a service method that no route calls are three ways for a later change to look live when it is not; the scope's own `Deferred` list already carries one dead catalog key from an earlier feature, and this spec should not add nineteen.

## Evidence measured before writing

The state of the code at `HEAD`, read while designing:

- `seller-order.routes.ts` mounts three routes: `GET /seller/orders`, `PATCH /seller/orders/:orderId/handover` (behind `requireActiveAccount`) and `PATCH /order-items/:orderItemId/status` (behind `requireActiveAccount` and `validateDto(UpdateOrderItemStatusDto)`).
- `app.ts` has no global 404 handler, so a deleted route answers the Express default HTML page, not the project JSON body. That is why the refusal is a mounted handler rather than a removed route.
- `ALLOWED_LINE_TRANSITIONS` reads `CONFIRMED: ["CANCELLED"]`, `SHIPPED: ["CANCELLED", "DELIVERED"]`, and an empty list for the other seven statuses.
- `SELLER_ORDER_GROUP_SELECT` reads `id`, `createdAt`, `paymentStatus`, `paymentMethod`, `pickupPointId`, `pickupPointName`, `pickupPointAddress`, `handedOverAt` and `shippingMethod.isPickup`; the line select reads `id`, `productId`, `name`, `previewImage`, `quantity`, `price`, `currency`, `status`. No `userId` on either.
- `Order` holds no buyer name, email or phone column: the buyer appears only as `userId`, and `OrderItem` carries its own `userId`, neither of them selected.
- The panel's write surface is `useSellerHandover` and `useSellerOrderItemStatus` plus `SellerOrderGroup` and `LineActions`; the supporting modules are `lib/actionMap.ts`, `lib/handover.ts`, `lib/pageData.ts` and `lib/refusals.ts`, each with a suite.
- The seller write service appears six times in `pickup-handover.integration.spec.ts` and thirteen times in `seller-order.integration.spec.ts`. In the first suite two of the six are the subject of a race test rather than setup, so deleting the service takes that test with it, and the same guarantee is proved by `apps/api-astrum/src/modules/staff/__tests__/point-handover.integration.spec.ts:179`.
- The `seller` catalog namespace carries 23 top level keys in each language, seven of them handover labels, one action label, four dialog labels and ten toast labels.
- `apps/customer/src/i18n/__tests__/messages.test.ts` proves key parity between the two catalogs and that no string is empty; it does not prove that a key has a reader, which is why the verify steps grep for the removed keys instead.
- The storefront grouping today is a `section` per order with a grid row per line, a handover button in the pickup block, and a `Dialog` for the handover and for the line action. The panel folder holds 46 test cases across eight files, 23 of them in the three component files and 23 in the five lib files; only `lib/__tests__/format.test.ts` (four cases) survives untouched, and two hook suites cover the mutations.

References: none. The stack is settled, and the sources that shaped this decision are the existing specs and the code they describe: 0007 for the panel, its states, its pagination and its density rules; 0011 for the refusal vocabulary and the irreversible confirm primitive the dialogs used; 0013 for the point, the one timestamp and the seller handover this spec deletes; 0015 and 0016 for the payment badge, the refund warning and the transition table as it stands; 0017, 0018 and 0019 for the roles and the two staff surfaces that now own the handover. The reasoning stays here rather than in a citation list, following the shape specs 0017, 0018 and 0019 already use for the same call.
