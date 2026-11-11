# Rationale: pickup handover · spec 0013

## Context

> ⚠️ Premise note: the shop owns the pickup point, but no operator role exists, so the closest actor to the counter is the seller. Marking a handover at a place the seller does not staff is a real compromise, and it is the one that keeps this slice inside the surfaces the shop already has. The honest end state is an operator account with a collection screen keyed by order id, and the Follow-up records it. The second premise worth naming: a cart may hold goods from several sellers, so a collection can be split in time, and an order level handover date exists only after the last line moves.

The shop hands every order over at a pickup point. Nothing in the code knows this. `Order` carries a free text `deliveryAddress` typed by the customer, the delivery methods are courier rows priced 299.00 and 799.00, and an order can be shipped but never collected: the only path to `DELIVERED` is the seller line route, moved from `SHIPPED`, and it writes no date anywhere. `OrderItem.receiptDate` has been in the schema since the first order migration and has no writer, which spec 0002 recorded as a debt when it wrote the pickup feature's name into its follow-up list.

The consequence of not deciding is an order that never closes. A customer reads a status that cannot reach `DELIVERED` without a seller marking a courier step that never happened, the shop has no record of when goods changed hands, and the scope slice that names pickup as the way this shop hands goods over stays planned.

The forces: the point belongs to the platform, not to a seller, so a seller must not own its rows. There is no operator role, no operator screen and no staff account. The seller panel is the only fulfilment surface, it already reads the seller's own lines and already refuses a foreign one, and the order status rule of spec 0002 already closes an order when every active line is delivered. The delivery methods already travel from the database to the checkout with a price and a currency, so a pickup method costs one row. The customer reads one order screen and one order card, both built on the order row.

## Measured state before the decision

Read from the repository on 2026-11-12, not remembered:

- `Order.deliveryAddress` is `String` and required in `packages/Astrum-db/prisma/schema.prisma`; `CreateOrderDto.deliveryAddress` carries `@IsNotEmpty()` and `@IsString()`; the storefront schema enforces a 10 character minimum.
- `OrderItem.receiptDate DateTime?` exists and no source file writes or reads it beyond the client type declaration and one test fixture.
- No source file in `apps` or `packages` contains the word pickup before this decision.
- `ShippingMethod` carries `name`, `price`, `currency` and `isActive`; spec 0009 seeds `Standard Delivery` at 299.00 RUB and `Express Delivery` at 799.00 RUB and switches `Verify delivery` off.
- `seller-order.service.ts` holds two tables: `CONFIRMED` moves to `SHIPPED` or `CANCELLED`, and `SHIPPED` moves to `DELIVERED`. `recomputeOrderStatus` and `lockOrder` live in `order-status.helpers.ts` and already run inside one transaction with a parent order row lock.
- The seller list reads through an explicit select of `id`, `createdAt` and the owned lines, so no delivery field reaches a seller today, which is the deliberate rule of spec 0002, AC-5.
- The customer detail and list reads build on `include` and spread the row through the mapper, so a new `Order` column reaches the storefront without a mapper change.
- `canonicalOrderBody` fingerprints `deliveryAddress`, `deliveryDate`, the sorted items, `paymentMethod`, `paymentDetails` and `shippingMethodId`.
- `GET /api/shipping-methods` answers exactly four fields per method, through `SHIPPING_METHOD_SELECT` and `toShippingMethodJson`, so the pickup flag needs a change to the read as well as to the table.
- `recomputeOrderStatus` writes the order status and returns nothing, and both callers ignore what it returns.

## Options considered

### Option 1: The pickup point belongs to a seller, managed from the seller panel

A `PickupPoint` row carries a `businessId`, and the seller area gains a page that creates, edits and switches the shop's points. A customer collects at the shop that sold the goods.

**Pros**:
- The actor who owns the goods owns the place where they are collected, so no role is invented.
- A seller opens a point without an operator in the loop.

**Cons**:
- The shop does not work this way: the point belongs to Astrum, so this models a different business.
- A cart with goods from two sellers would need two collection points in one order, or a refused cart, and the whole order flow is single address today.
- One more screen, one more seller API module, and an address per seller to keep current.

### Option 2: The pickup point belongs to the platform, an operator role marks collection

Points are platform rows, and a new account flag marks pickup point staff, who get a collection screen keyed by order id. The seller only ships.

**Pros**:
- The closest match to how a real collection point works, with one actor at the counter and one screen.
- The seller stops carrying a job that is not theirs.

**Cons**:
- A new role, a new screen, a new gate and a new access question (which accounts are staff, who assigns them), which is several times the size of this slice.
- The shop has no staff accounts, so the feature ships dark until someone creates one.
- Two features in one spec: point collection and an operator identity.

### Option 3: Platform owned points, an operator script, the seller marks the handover

`PickupPoint` is a platform table with no owner. A script adds and switches rows. The delivery method gains `isPickup` and one seeded row at 0.00. The checkout lists the active points and requires one for a pickup method. The seller panel gains one `Hand over` control per pickup group, backed by one route that delivers every ready line of that seller in one transaction.

**Pros**:
- Keeps the owner's model: the point belongs to Astrum, and no seller identifies it.
- Uses the surfaces that exist: the methods read, the order transaction, the seller panel, the order status rule.
- One button for the real moment, and the order closes by the rule spec 0002 already has.
- A multi business order still fits, because the point is not tied to a business.

**Cons**:
- The seller marks a handover at a place the seller does not staff, which is a compromise until an operator exists.
- Points are created by an operator with database access, not from a screen.
- A split collection leaves the order without a handover date until the last line moves.

### Option 4: Platform owned points, the customer confirms the collection

The order screen gains a control the customer presses on collection, and no seller acts.

**Pros**:
- The only path that needs no new role and no seller action.
- The customer is the person who knows the parcel was collected.

**Cons**:
- A customer can confirm without the goods, and the shop has no counter check, so `DELIVERED` becomes a claim nobody verifies.
- A cooldown, a code or a staff confirmation would be needed to make it honest, which grows into Option 2.

## Sub decisions

Each of these was mine to call once the design conversation settled the shape. Pick first, the runner up second.

| Decision | Pick | Why | Runner up |
| --- | --- | --- | --- |
| Confirmation before a handover | A dialog naming the point and the count of lines | The move covers several lines, cannot be undone from the screen, and spec 0007 already asks for the same on `Deliver` | Act at once, like `Deliver` today |
| Repeat answer | `200` only when every owned line is already `DELIVERED`; otherwise `409 NOTHING_TO_HAND_OVER` | A repeat of a finished action is a no op, but an order whose lines are still `PENDING` is not a repeat, and answering `200` would hide a screen bug | Always answer `200` |
| Handover on a courier order | `409 HANDOVER_REQUIRES_PICKUP` | A courier order's delivery is proved per line, and one group control would duplicate that path | Offer one button for any order |
| `Deliver` on a pickup line row | Hidden, the group owns the move | Two controls for one move invite a half delivered group and a confusing date | Keep both |
| Dates on the line route | `receiptDate` on every delivered line, `handedOverAt` on the first reach of `DELIVERED`, any order | One meaning for one column, and the courier path gets the same record | Pickup only |
| Address on a pickup order | Ignored and stored null, while a point on a courier method is refused | The form swaps fields, so a stale address is normal; a point on a courier method changes where the goods go | Refuse both |
| Handover logging | One structured line with actor, order, business, count and code | The only audit record this feature adds, and it costs one call | None |
| Method naming | English data, `Pickup at the shop` | Follows the rule of spec 0009, AC-13, rather than inventing a translation layer for one row | A translation key for method names |
| Point identity | `name` unique | The operator script addresses a row by name, and a duplicate name has no meaning | Unique `(name, address)` |
| Method read shape | `isPickup` joins the existing methods answer, amending spec 0009, AC-4 | The checkout already reads that one endpoint, and a second endpoint for a boolean doubles the loading states | A separate flag endpoint |
| Seed scope | The method row is seeded, the points are not | A method is structure every environment needs; a point is a real address, and a fake one sends customers nowhere | Seed one demo point |

## Rationale

Option 3 wins on the forces that actually bind here. The point is platform data, so Option 1 models a different business and breaks the multi seller cart. There is no operator account, so Option 2 ships a role and a screen nobody can use yet, and it would double the spec. Option 4 hands the shop's only proof of delivery to the party with a reason to lie about it.

What makes Option 3 cheap is that every mechanism already exists. The delivery method already travels from the database to the checkout with a price and a currency, so pickup is one row and one boolean. The order transaction already reads the method inside itself, so reading the point there costs one more query and gives the snapshot the rule spec 0009 set. The seller panel already scopes every read and every write to the caller's business and already locks the parent order row, so the handover route is one transaction over code that ships. The order status rule already closes an order when every active line is delivered, so `Order.status` needs no new branch.

The compromise is named rather than hidden: a seller marks a handover at a place the seller does not staff. It is defensible because the seller is the actor who knows the parcel left their hands, and the alternative is a role the shop cannot staff today. The rationale records it, the Consequences repeat it, and the Follow-up names the operator surface that replaces it.

The cost is spread across four surfaces: a schema change in four copies, one gateway module, one checkout block and one seller control. The nullable address is the only change that can surprise a later reader, which is why it is an invariant here and a follow-up note at the same time.

References: none. The stack is settled, the sources that shaped the decision are the existing specs and the code they describe (0002 for the line table, the order status rule and the `receiptDate` debt, 0007 for the seller panel and its confirmation pattern, 0009 for the method row and the snapshot rule, 0003 for the idempotency fingerprint), and the reasoning stays here rather than in a citation list.
