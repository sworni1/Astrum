# 0008 · Seller onboarding · decision record

The build spec lives in [index.md](index.md). This file keeps the decision history: the context, the options weighed and the rationale.

## Context

The seller order panel shipped in spec 0007, but ownership of a shop is still an administrative data change. The only path is `pnpm db:assign-business <email>`: it gives the account an unassigned `Business` row when one is free and creates a row otherwise. Nothing in the product offers this step, and scope row 13 asks for it.

A `Business` row carries an `id`, an optional `ownerUserId` with a unique index, and `createdAt`. The storefront learns that a user sells from `isSeller`, derived on every profile read from a `Business` row whose `ownerUserId` matches the account. The unique index is what enforces one shop per account. The seller order routes answer only for an owned business, and the account rule of spec 0005 refuses the writes it guards while the address is `PENDING`; this new write joins that set.

Without this decision a demo or a real user needs an engineer with database access, and the product cannot create its own seller. The seller area is reachable only by a hand written URL until the data changes.

> ⚠️ Premise note: this spec ships the door, not the stock. A new shop holds no products, so the seller panel stays empty until the seller facing product screen ships; the gateway route `POST /api/products` and its DTO already exist. If the goal is a seller who can complete a full cycle in one session, that screen must be the next spec, not a later step.

## Options considered

### Option 1: Give the user an unassigned shop, then create one

The endpoint reuses the rule of `db:assign-business`: it takes an unassigned `Business` that owns products, then any unassigned row, then creates a row when none is free.

**Pros**:

- The seller panel shows real orders and products in the same minute.
- One selection rule serves the script and the product.

**Cons**:

- A new account receives a seeded catalogue and order history that it did not create, which is not a shop of its own.
- A real product cannot hand out existing data rows on demand.
- The behavior hides the empty shop problem instead of solving it.

### Option 2: Create a new shop with a required name on a dedicated page

The user opens `/seller/onboarding`, gives the shop a name, and presses one button. The gateway always creates a fresh `Business` row owned by that account.

**Pros**:

- Ownership is unambiguous, and the unique index makes one shop per account a database fact.
- The shop has a real identity from the first minute.
- The action is idempotent and safe to retry.

**Cons**:

- The panel is empty until products exist, and the seller facing product screen is not part of this spec.
- One more page and one more endpoint for a small step.

### Option 3: An application with operator approval

The user asks to sell, and an operator approves the request before a `Business` row is created.

**Pros**:

- The shop controls who sells and under which name.
- The operator can refuse a bad name or a suspicious account.

**Cons**:

- It needs a request entity, a state machine, an operator screen and notifications.
- Scope row 13 asks for one self service action, and the repo has no operator surface to extend.

### Option 4: Create the shop and a minimal product form together

Onboarding creates the shop and a first product in the same flow.

**Pros**:

- The new seller has something to sell at the end of the flow.
- The panel is not empty after onboarding.

**Cons**:

- The gateway route `POST /api/products` and its DTO already exist, but the seller facing screen needs fields, image handling, category and visibility controls.
- It doubles the surface and hides onboarding behind a second domain.

## Rationale

The scope asks for one deliberate action that leaves the account owning exactly one shop of its own. Handing over an unassigned seeded row fails that last word: the products and the order history belong to the demo, not to the person who pressed the button. A fresh row with a name is the only version where ownership is both true and provable, and the unique index on `ownerUserId` turns "exactly one" into a database rule instead of a convention.

The page is separate from the profile because it has to explain what selling means and collect a name before the first write. A dialog on the profile would carry the same copy with less room and one more overlay. The profile section stays as the entry point, and the panel's not a seller screen links to the same page for a user who arrived by URL.

The name is required because a shop without one is a row with an id, and the shop profile screen will need it as soon as it exists. Requiring it now costs one column and one migration; adding it later would mean a second migration and a backfill of rows created without it. The response returns the stored, normalized name so the success card shows what the database holds, not what the browser sent.

Idempotency is deliberate: a double click, a retry after a timeout and an old tab all reach the same endpoint. A `409` would turn a success state into an error toast, while a `200` with the existing shop keeps the rule "the account owns exactly one shop" visible to the client.
