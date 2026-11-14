# 0019. Handover by the courier: decision record

## Context

Scope row 20 asks for the third hand a parcel can have. The counter won its queue in spec 0018 on the strength of the role rows spec 0017 added, and both of those features are keyed to a place: `requirePointWorker` resolves the caller's `pickupPointId`, and every write proves ownership by `Order.pickupPointId`. A courier names no point at all, because the `Courier` table has no such column by design, so nothing that reads a point can serve him.

The parcel he carries is already described by the order. The checkout of spec 0013 requires a delivery address for a method whose `isPickup` is false, blanks it for a pickup order, and stores it on `Order.deliveryAddress`; the delivery date is required at the same step. The measured state of the demo database at design time: four shipping methods, three of them courier methods, one of those switched off; seventy eight courier orders, of which four are `SHIPPED`, all four carrying an address and a delivery date and no point, and all four reading `paymentStatus = PENDING` with a method of `CASH` or `CARD_ON_DELIVERY`. The money on those four is therefore collected at the door, and the counter's handover of spec 0018 writes no payment at all, so the parcel would close while the order went on reading unpaid.

The other force is the grant. Spec 0017 made a staff role self service on purpose, and spec 0018 recorded what that means: any confirmed account can attach itself to a point and close that point's parcels. A courier list built the way the row describes, one shared list for everybody, would give every such account the delivery address of every parcel in flight, which is a map of where buyers live. The decision below is about that exposure as much as about the writes.

## Options considered

### Option 1: the shared pool the row describes

Every courier reads every courier parcel that is `SHIPPED` and not handed over, address included, and either write closes it; the order lock decides who wins.

**Pros**:
- No schema change at all: one read, two writes, one new service, no migration and no fourth schema copy edit.
- The smallest possible distance from the row as written, and the simplest screen: one list, one refresh.

**Cons**:
- Every self granted courier reads every pending delivery address, and keeps reading it as long as parcels sit there. Nothing bounds a fake role.
- Nothing records which courier closed a parcel, so a dispute over a missing parcel has only a log line, exactly as at the counter.
- Two couriers can chase one parcel and one of them learns from `409 ALREADY_HANDED_OVER` that he drove for nothing.

### Option 2: the claim (chosen)

One nullable column on the order holds the courier's account id. The pool lists `SHIPPED` courier parcels whose column is null and carries no address; a press takes one inside a locked transaction that writes one column; from then on the parcel carries its address and its three controls, and the column survives the handover as the record of who delivered it.

**Pros**:
- The address reaches only the courier who took the parcel, which is the difference between a bounded exposure and a registry of home addresses under a self granted role.
- All four writes share one shape: a transaction, the order lock and one `classifyCourierOrder`, so the claim, the release, the handover and the cancel read one ladder and the race has one answer.
- The order keeps the courier's id after the handover, so the delivered record name somebody, which no earlier feature could say for a courier.
- A release returns a parcel to the pool, so a courier who cannot deliver it does not strand it.

**Cons**:
- One migration, four byte identical schema copies and four regenerated clients, the first schema change since spec 0017.
- A claim has a second state to reason about: a parcel taken and never delivered stays out of the pool until its courier releases it, and there is no dispatcher or expiry to rescue it.
- Two lists on one screen, each with its own pages and its own refresh, and every action reads again both.

### Option 3: a courier assignment table

A separate `CourierAssignment` row per claim, with its own id, timestamps and release record, joined by the reads and the writes.

**Pros**:
- Keeps the history of who took and who gave back, which is what an audit trail of a delivery would want.
- A closed order keeps its assignment row even after the order changes status.

**Cons**:
- A second table and a second unique constraint, for a fact that is at most one value per order at any moment: the same column, spread over a join.
- The reads and both writes gain a relation to load and to filter, and the migration grows a table this feature never queries by anything but the order id.
- The history it buys is a feature the row did not ask for, and a log line already carries the release event.

## Rationale

Option 2 is chosen because the exposure, not the convenience, decides it. The grant is self service and the rule for who may grant it is still owed, so the one thing this feature must not do is hand every account that asks a list of home addresses. Option 1 does exactly that, and its savings are one nullable column and one index. Option 3 buys a history the row never asked for, and it buys it with a join on every read of both lists; the order already carries the final courier id, and the log lines carry the rest.

The claim also happens to fit the shape the counter already established. Ownership becomes a column on the order, which is what `pickupPointId` is for the point, and the writes reuse the blocks spec 0018 wrote: the order lock, `recomputeOrderStatus`, `returnOrderStock`, the cancellable set read under the lock, and the refund warning. One shape covers all four writes: a transaction, the order lock and one classification function, which pays a lock on a press that usually writes one column and removes any window where the answered row could disagree with the written one. The cheaper conditional update was weighed and dropped for that window.

Two smaller calls are made here rather than asked. The release answers `404` on a second press, because "already released" and "not yours" are the same state of the row and one answer per state is what keeps the contract checkable. The money at the door is written as `paymentStatus = PAID` without a `Payment` attempt row, because `PaymentProvider` holds `STRIPE` alone and a cash attempt would drag a new enum value and a migration into a handover feature; the attempt row is owed work in Follow-up, and the asymmetry with the counter is named in Consequences rather than left silent.

## Measured evidence

Read at design time, 2026-11-14, before the decision was written:

- The four schema files (`packages/Astrum-db/prisma/schema.prisma` and the copies under `apps/api-astrum`, `apps/auth-astrum`, `apps/worker`) are byte identical, 486 lines each, md5 `4aa7227026d6fd0418fa234965506b60`.
- `Order.userId` is a plain scalar with no relation to `User`; `Order` carries `@@index([userId])`. The new column follows that shape.
- `ShippingMethod`: `Express Delivery` and `Standard Delivery` are active courier methods, `Verify delivery` is a courier method with `isActive` false, `Pickup at the shop` is the only pickup method.
- `Order` rows joined to a courier method: 49 `PENDING`, 1 `CONFIRMED`, 4 `SHIPPED`, 5 `DELIVERED`, 19 `CANCELED`; all 78 carry a `deliveryAddress` and none carries a `pickupPointId`.
- The four `SHIPPED` ones read `paymentMethod` `CASH` (2) and `CARD_ON_DELIVERY` (2) with `paymentStatus` `PENDING` throughout; one of them uses the switched off `Verify delivery`.
- `PaymentProvider` holds `STRIPE` alone, and `Payment` requires `provider`, `amount`, `currency` and `expiresAt`, so a cash attempt is not a free write.
- `useCheckout` stores the delivery date as noon in the buyer's local zone on purpose, and the intl request config pins `timeZone: "UTC"`, so a date printed with no override keeps the calendar day the buyer picked.
- `refusalCode` in `@/common/helpers/apiRefusal` reads the code on any status, while the interceptor inside `hooks/useFetcher.ts` reads only `401` and `403`. The courier screen branches on statuses up to `409`, so it must call the shared helper.
- `useFetcher` exposes `getData`, `postItem`, `patchItem`, `deleteItem` and `putItem`, so a `DELETE` release needs no new request helper.
- One `Courier` row and two `PointWorker` rows exist, with three pickup points.
- The root `db:generate` script filters `@astrum/db`, so it refreshes only the shared client; the four clients come from `prisma:generate` through turbo, which is the command a schema change must run.
- `recomputeOrderStatus` takes an optional `paymentStatus` and writes it in the same update as the order status, so the money a courier collects needs no second statement.

References: none. The stack is settled, and the sources that shaped this decision are the existing specs and the code they describe: 0002 for the line table and the ownership rule, 0011 for the irreversible confirm primitive and the refusal vocabulary, 0013 for the address, the point and the one timestamp, 0015 and 0016 for the payment attempts, the refund warning and the shipping pass, 0017 for the role rows and both guards, and 0018 for the counter's queue, its refusal chain and the blocks this feature shares with it. The reasoning stays here rather than in a citation list, following the shape specs 0013, 0017 and 0018 already use for the same call.
