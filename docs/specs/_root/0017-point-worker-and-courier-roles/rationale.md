## Context

A parcel has exactly one hand in the product today, and that hand belongs to the shop: `PATCH /api/seller/orders/:orderId/handover` closes every line of an order that is `CONFIRMED` or `SHIPPED`, and the gateway proves the caller owns the `Business` that the order's lines belong to. The scope plan splits that one action into two jobs, staff of a collection point and courier, because a parcel reaches a real counter or a real door and neither of those places belongs to the seller. Both jobs need an account that holds them, and `User` carries no role field at all: it has `status`, `business` and nothing else. Until an account can hold one of these jobs, the two handover features have no caller to authorise, and the seller keeps a move the plan wants to remove from them.

Three forces shape the decision. The first is that the grant must be self service. The scope row says a confirmed, signed in person takes the job from the profile in one deliberate action, the way spec 0008 let a person open a shop, so the feature ships a door and not an operator checklist. The second is that a point is already a real row: `PickupPoint` has `name`, `address` and `isActive`, the checkout already lists the active ones, and the handover of spec 0013 already stamps one onto an order as a snapshot. A worker therefore has to name one of those rows, and the row has to exist. The third is that a person may legitimately hold both jobs at once, because the plan's own sentence says both roles show on the profile and in the navigation at once, and a small shop's assistant can also drive.

What is not decided anywhere yet is who may grant either role. There is no invitation, no manager per point and no operator screen. This spec takes the self service reading the scope row gives and records the exposure that comes with it, because feature 19 will hand real parcels over on the strength of these rows.

## Options considered

### Option 1: One `role` column on `User`

A single enum field on the account, `BUYER`, `POINT_WORKER` or `COURIER`, written once by the grant call.

**Pros**:
- Smallest possible change: one column, one migration, one field on the profile read.
- The navigation reads the same field it already reads for `isSeller`, so no new query shape.

**Cons**:
- Holds one role and no point, so the point still needs a second column (`pickupPointId` on `User`), which makes the account row carry a foreign key that belongs to a job.
- Cannot express both jobs at once without turning the column into an array, which the database cannot constrain and the guards cannot index.
- Every later role (support, picker, warehouse) widens one enum on the shared identity table that four services read.

### Option 2: Two role tables, granted from a page in the storefront

`PointWorker` with a required `pickupPointId`, and `Courier` with no point at all, each with a unique `userId`, granted through two gateway endpoints and one page.

**Pros**:
- The rule "a point worker names a point, a courier names none" is held by the structure: a required column here, an absent column there, no check constraint and no service rule to forget.
- Both jobs coexist for one account without an array or a second unique rule.
- Each guard reads exactly one table by a unique index, so a role check is one indexed read and the row it finds is the row the handler uses.
- A later job (picker, warehouse) is a new table and a new guard, with no change to an existing one.

**Cons**:
- Two tables with almost the same shape, and no single row answers "what does this account do".
- The profile read has to reach both relations, and the response field is a computed list rather than a stored value.
- Two grants, two guards and two reads to write and to test for what is one product question.

### Option 3: One membership table with a role kind

`StaffMembership` with `userId`, `kind` and a nullable `pickupPointId`, unique on the pair of account and kind.

**Pros**:
- One table and one code path, so a third job is a new enum value and no migration of shape.
- The profile read reaches one relation and builds the list from it.

**Cons**:
- The rule "a point is required for the point role and forbidden for the courier" is not expressible in the Prisma schema, so it lives in a raw SQL check in the migration or only in the service, and a hand written row can break it.
- Every guard has to filter by kind, and a row with the wrong nullable combination is a state the code must reject rather than a state the database refuses.

### Option 4: An operator script, no self service

Keep the grant in a script, the way shops were assigned before spec 0008.

**Pros**:
- No new public surface and no self granted access: somebody decides who works where.
- Nothing to review on the storefront, so the feature is a script and two reads.

**Cons**:
- Contradicts the scope row, which asks for the action from the profile.
- Reproduces exactly the bottleneck spec 0008 removed for shops, and the demo path would need a database console to show a handover.
- Gives no screen where a person can see the job they were given.

## Rationale

Option 2 wins on the force that decides the shape: the point. A worker is not a worker in general, they work at one point, and the pair (person, point) is the thing feature 19 authorises a handover against. Two tables put that pair in the table that owns it, and they make the prohibitions structural: the courier table cannot carry a point because there is no column to carry it, and the point table cannot be nameless because the column is required. Option 3 reaches the same behaviour, and I recommended it during the design conversation, but it moves the same two rules into a check constraint written by hand in a migration or into a service method that a later writer can skip, and this repository already leans on the database for its invariants (the unique index on `Business.ownerUserId` is the single source of one shop per account, spec 0008). The owner chose two tables, and the cost is honest and small: a duplicated shape, and a profile read that reaches two relations in one query.

Option 1 loses on the second job and on the point. A role column cannot hold both jobs, and the point it would also need on `User` turns the shared identity row into a job record that four services compile against. Option 4 loses on the scope row and on the precedent of spec 0008: a person who cannot take a job without an engineer is the exact bottleneck that spec removed, and features 19 and 20 would then be demonstrable only from a database console.

The grant stays idempotent for the reason spec 0008 made its onboarding idempotent: a double click, a retried request and two open tabs are ordinary, and a second row must not be one of their outcomes. The unique index on `userId` is the decider, the insert is a single statement so a lost race leaves the connection usable, and the loser answers from a fresh read instead of surfacing a database error. The repeat never moves the point, because a request that says "become a worker" must not silently relocate somebody who already is one; moving is its own action with its own endpoint and its own screen control.

Switching a point off deliberately leaves the role alone. `isActive` answers "may a buyer choose this point today", not "does this person still work here", and revoking a job as a side effect of an operator switch would be a silent change to somebody's account. The screen says the point is switched off, and feature 19 refuses the handover there; the person can move to another point from the profile without asking anybody.

The exposure is recorded rather than hidden. Self service means any confirmed account can attach itself to any active point, and once feature 19 ships that account can hand that point's parcels over. The role carries no money and no personal data, and every call needs a live session, so the blast radius is a wrong handover rather than a breach. The right fix is a rule for who may grant, which needs a decision this spec does not take: a Follow-up item names it, and the Consequences section says plainly that the project accepts the risk until then.

References: none. The stack is settled, the sources that shaped the decision are the existing specs and the code they describe (0008 for the onboarding shape, the idempotent repeat and the unique index as the single source of one row per account, 0013 for the point row and its snapshot onto an order, 0006 for the English default catalog, 0007 and 0016 for the panel and guard patterns the handover features will reuse), and the reasoning stays here rather than in a citation list.
