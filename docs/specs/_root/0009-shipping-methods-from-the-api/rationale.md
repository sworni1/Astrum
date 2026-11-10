# 0009 · Shipping methods from the API · decision record

The build spec lives in [index.md](index.md). This file keeps the reasoning: the context, the options weighed, the evidence the decision rests on and what each option costs.

## Context

> ⚠️ Premise note: this feature ships the read side of delivery methods, not their management. After it lands, an operator still changes a price or switches a method off with SQL, because no seller or admin screen writes `ShippingMethod`. That is acceptable here (the shop changes delivery prices rarely and the operator has database access today), but it means the feature closes the customer facing half of a two sided gap. The management screen is recorded in Follow-up, not designed here.

The checkout form carries two delivery methods as literal objects: ids `cmf3vpjoi0000vdqkkwrasuzx` and `cmf3vq53t0001vdqk50gx74qz`, English names taken from the message catalog, and prices 5.99 and 12.99 typed into the component. Those ids exist because a demo database happened to hold rows with them; no seed, no migration and no script creates a delivery method, so a fresh database, a CI database or a new environment has none. The form would then send an id that matches no row and every order would be refused.

The gateway already refuses an unknown method id: spec 0001 added `tx.shippingMethod.findUnique` inside the order transaction and raises `409 UNKNOWN_SHIPPING_METHOD` when it finds nothing. So the third clause of the scope row is half true today. What is missing is the read, a way to retire a method, and the money.

The money is the real gap. `Order.totalPrice` is computed from the priced order lines and nothing else, while the storefront displays the delivery price as its own line and prints `totalPrice` under the label Total. A customer paying 299 for goods and 299 for delivery is shown a total of 299. Nothing on the server ever learns the delivery price at all: the order stores a foreign key to the method and reads the price through the relation whenever it is displayed, so a later price change silently rewrites what every past order says it cost.

The currency is a second problem the feature cannot avoid. `ShippingMethod.price` is a `Float` with no currency, while `Order` and `OrderItem` hold `Decimal(10,2)` and a `Currency`. Every row in the development database is `RUB`: 4748 products, 53 orders. The storefront prints `$` from a hardcoded `Currency.USD`, so the displayed currency is already wrong before this feature starts.

The shop's build approach is Tracer Bullet, and the depth is Beta, which means this spec is followed by `/check verify` and `/test` but not by an independent review.

## Options considered

### Option 1: Keep the delivery price out of the stored money, only serve the list

The gateway serves the methods, the storefront lists them, and the delivery price stays a display value read through the relation.

**Pros**:

- Smallest change: one route, one hook, no schema work beyond a switch.
- No new columns on `Order`, so no backfill and no migration risk.

**Cons**:

- The displayed total stays wrong, which is the one clause of the scope row a customer feels.
- The delivery price of a past order keeps following the method row, so history is not history.
- `Float` money and a missing currency stay in place.

### Option 2: Serve the methods, snapshot the delivery price, store the summed total (chosen)

The gateway serves the active methods with their price and currency; the order transaction reads the chosen method, refuses a missing, switched off or wrongly denominated one, and stores the method name, the price and the summed `grandTotal` on the order.

**Pros**:

- The total a customer sees is the total stored, computed once on the server in decimal arithmetic.
- A past order keeps its delivery line forever, which is the same snapshot rule spec 0002 applied to the order lines.
- A method can be retired with a switch instead of a delete, so history survives.
- Money becomes decimal and gains a currency, which removes the float and the silent dollar sign on the two surfaces that matter.

**Cons**:

- Three new required columns on `Order` and one migration that transforms live data, which is irreversible in practice for the orders placed between deploy and rollback.
- `grandTotal` is stored next to `totalPrice`, so the two must be written together by every future writer of a placed order.
- More surface: three refusal codes and their storefront states.

### Option 3: Fold the delivery price into `totalPrice`

The order total becomes lines plus delivery, and the delivery price is a separate column for display only.

**Pros**:

- One number answers "what did this order cost", with no second total for a reader to reconcile.
- The existing screens that print `totalPrice` need no change.

**Cons**:

- It changes the meaning of a field decided in spec 0001 and read by the seller area and the cancel path, so every consumer must be re read and re reasoned about.
- Distinguishing goods from delivery later becomes a subtraction with no record of the input.
- A reprice of a placed order would have to adjust the one number that also feeds seller and cancellation logic.

### Option 4: Seed the methods with a script instead of the migration

The schema gains the columns, and a `pnpm db:seed:shipping` script creates the two standard methods.

**Pros**:

- Data seeding stays out of schema history, so a migration never writes business rows.
- The script can be re run whenever an environment needs resetting.

**Cons**:

- Nothing runs it automatically: a fresh clone, a CI database and a production deploy each need one manual step that someone will forget, and the failure mode is a checkout with no methods.
- The repository already carries a script of this kind (`db:assign-business`) and it is exactly the manual step spec 0008 was written to remove.

## Rationale

Option 2 is the only one that closes the clause the customer feels while keeping the existing meaning of `totalPrice`. The delivery price is a real cost of the order, so it must be stored and not re read from a mutable row; the sum is what a customer pays, so it must be computed once on the server. Storing `grandTotal` rather than deriving it keeps one number of truth for what was charged and survives any later change to the columns that feed it. Deriving it at read time was the runner up, and it loses only because a stored amount is what an invoice and a refund path can quote without recomputing.

The snapshot rule is borrowed from spec 0002, which already snapshots the business on each order line for the same reason: a row that a later feature can edit must not decide what a past order says.

The currency decision follows from the data rather than from taste: every product and every order is `RUB`, so the methods are `RUB` and a method in another currency is refused instead of converted. A conversion needs a rate, a rate needs a source and a moment to snapshot, and that is the multi currency decision already deferred in the scope. A hardcoded rate would put a made up number into history, which is worse than a clear refusal.

Seeding inside the migration, rather than a script, is the same reasoning spec 0008 used for the shop creation path: an environment that needs a human to run a command is an environment that is broken for the next person. The insert is keyed by the unique name and updates the row it finds, so a database that already holds those rows is corrected rather than duplicated, and no literal id has to be maintained anywhere.

`Decimal` over `Float` is not a preference: the other money columns in this schema are already `Decimal(10,2)` and a float column that reaches a total is a counted defect. The read endpoint returns a small envelope rather than a bare array, so the response has room for a shop level value (a currency, a free delivery threshold) without a breaking change; a bare array was the runner up, and it matches `GET /api/orders`, which returns a list.

## Evidence: the state this decision starts from

Measured on the development stack on 2026-11-10.

- `ShippingMethod` holds three rows and every one of them is referenced by orders: `Standard Delivery` 5.99 with 43 orders, `Verify delivery` 5.99 with 8 orders, `Express Delivery` 12.99 with 2 orders. None can be deleted under the current `ON DELETE RESTRICT` foreign key, and `Verify delivery` is an artifact of an earlier verification run that is visible in the checkout today.
- `Product.currency` is `RUB` for all 4748 rows; `Order.currency` is `RUB` for all 53 rows. `apps/customer` prints `getCurrencyEmoji(Currency.USD)` on the order screen, the order card and the checkout, so the sign and the data already disagree.
- `apps/api-astrum/src/modules/order/order.service.ts` computes `totalPrice` from the priced lines only; `toOrderDetail` reads `shippingMethod.name` and `shippingMethod.price` through the relation for every read.
- `apps/customer/src/features/pages/Cart/components/CheckoutForm/index.tsx` holds the two hardcoded ids and a `shippingMethodsLoading` constant pinned to `false`, so the loading branch of the select can never render.
- No module serves shipping methods: `apps/api-astrum/src/modules` holds cart, order, product, reviews, seller, user and wishlist. Every mount in `app.ts` sits behind `authenticateToken`, and `app.use("/api", authenticateToken, sellerOrderRoutes, sellerOnboardingRoutes)` already covers the `/api` prefix, so a second `/api/...` mount would run the session middleware twice for any request under it.
- `packages/Astrum-db/prisma/schema.prisma` and `apps/api-astrum/prisma/schema.prisma` are byte identical and both carry `Order`, `OrderItem` and `ShippingMethod`; `apps/auth-astrum` and `apps/worker` carry trimmed copies that include those three models as well, so a schema change touches four files and four generated clients.
- The cart read carries no currency at all, so the storefront cannot decide which methods match the cart without a new field.
