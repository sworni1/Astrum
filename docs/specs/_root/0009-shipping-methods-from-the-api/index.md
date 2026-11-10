# 0009. Shipping methods from the API

**Date**: 2026-11-10
**Status**: Accepted

## Summary

The checkout form lists two delivery methods with ids typed by hand into the storefront, and the delivery price never reaches the money the server stores: the order total is the sum of its lines only. This decision makes the gateway serve the delivery methods from the database and make the order carry the delivery price it was placed with, so the sum a customer sees is the sum the shop recorded. The methods gain a currency and an on and off switch, the seeded shop starts with two real methods, and the two storefront screens that print money stop printing dollars over ruble data.

## Requirements

**User stories**:

- As a signed in customer, I want the checkout to list the delivery methods the shop actually offers, with their prices, so that I pick from what exists instead of from an id typed into the code.
- As a customer, I want the order total to include the delivery price I chose, so that what I am shown and what is stored agree.
- As the shop operator, I want to stop offering a method without deleting it, so that old orders keep their delivery line.
- As a developer, I want a fresh database to have the two standard methods, so that checkout works after a clone without a manual insert.

**Acceptance criteria** (the contract):

- **AC-1**: `ShippingMethod.price` becomes `Decimal @db.Decimal(10, 2)`; `ShippingMethod.currency` is a `Currency` column with default `RUB`; `ShippingMethod.isActive` is a `Boolean` column with default `true`. The change lands in `packages/Astrum-db/prisma/schema.prisma`, in `apps/api-astrum/prisma/schema.prisma` (byte identical to it), and in the trimmed copies of `apps/auth-astrum` and `apps/worker`, which do carry the `Order` and `ShippingMethod` models; only those two model blocks change in the trimmed copies, the rest of each copy stays as it is. `pnpm prisma:generate` rebuilds all four clients.
- **AC-2**: `Order` gains `shippingMethodName String`, `deliveryPrice Decimal @db.Decimal(10, 2)` and `grandTotal Decimal @db.Decimal(10, 2)`, all required. The migration fills all three for every existing order from the delivery method as it stood before the requote step, then sets them required, so no row is left with a null and no historical order is re priced. `Order.totalPrice` keeps its current meaning, the sum of the order lines.
- **AC-3**: The migration leaves every environment with a Standard Delivery row at 299.00 RUB and an Express Delivery row at 799.00 RUB, both active, and switches off the row named `Verify delivery`. Identity is the unique `name`: a row that already carries one of the two names is re priced and set active instead of duplicated, through `INSERT ... ON CONFLICT (name) DO UPDATE SET price = EXCLUDED.price, currency = EXCLUDED.currency, "isActive" = true`. The insert supplies `id` itself, because the table has no database default and the Prisma `cuid()` default lives in the client: `'sm_' || replace(gen_random_uuid()::text, '-', '')`, which this stack's Postgres 16 supports. Nothing asserts a particular id value, so an environment keeps whatever ids its rows already carry. A row with any other name keeps its own price, currency and switch untouched. Every existing order keeps the delivery amount it was placed with, because the snapshot backfill runs before the requote (AC-2).
- **AC-4**: `GET /api/shipping-methods` answers `200` with `{ methods: [...] }`, holding only rows whose `isActive` is `true`, ordered by `name` ascending, each item exactly `{ id, name, price, currency }` where `price` is a JSON number with at most two decimals. The router is joined into the existing `app.use("/api", authenticateToken, ...)` chain at `apps/api-astrum/src/app.ts:75`, so the session middleware runs once per request and not twice; it is not added as a second `/api/...` mount, which is what `/api/reviews` on the next line already does. `price` is mapped by the shared `toMoney` helper named in AC-7, not by a second copy. A request without a valid session answers `401` in the existing error shape.
- **AC-5**: `POST /api/orders` reads the chosen method inside the order transaction and refuses in one fixed order of precedence, after the checks that already exist (visibility and stock, then cart, then mixed currency): an id that matches no row answers `409 UNKNOWN_SHIPPING_METHOD`, an existing row with `isActive` false answers `409 SHIPPING_METHOD_INACTIVE`, and a row whose `currency` differs from the order currency answers `409 SHIPPING_CURRENCY_MISMATCH`. Each refusal answers the existing body shape with its own `code` and writes no order, takes no stock and clears no cart line. The method row is read inside the transaction without a row lock. The price the read returns is the price the row carries at that moment, so a switch off or a re price that lands after the read does not reach this order, and one that lands before it is what the order records. Nothing compares that price with the one the storefront displayed (AC-6).
- **AC-6**: On a successful order the row stores `shippingMethodName` from the method name, `deliveryPrice` from its price as a `Prisma.Decimal`, and `grandTotal` as `totalPrice` plus `deliveryPrice`, added in `Prisma.Decimal` and stored, and equal to `totalPrice + deliveryPrice` for every order the feature creates. No client value decides any of the three: `validateDto` calls `plainToInstance(dtoClass, req.body, { excludeExtraneousValues: true })`, so a body carrying `shippingMethodName`, `deliveryPrice` or `grandTotal` reaches the service without them. The amount stored is the one the read inside the transaction returns (AC-5): nothing is compared with the price the storefront displayed, so a change that lands before the read is what the order records and the order screen then shows that amount. These three columns are written by creation only, and no update path in this feature touches them.
- **AC-7**: Every handler that returns an order, the create and the detail reads and the list read alike, maps `totalPrice`, `deliveryPrice` and `grandTotal` through one shared helper, `toMoney`, which moves to `apps/api-astrum/src/common/helpers/money.ts` with the input type `Prisma.Decimal | number`, and both the order mapper and the shipping mapper use it. `toOrderListJson` maps the same three amounts, because it currently spreads the row and a `Decimal` serialises to a JSON string, which would break the card's `.toFixed(2)`. Money reaches JSON as a number with at most two decimals. The detail answer carries `shippingMethodId`, `shippingMethodName`, `deliveryPrice`, `grandTotal`, `totalPrice` and `currency`, and no nested `shippingMethod` object. An idempotent replay answers the stored snapshot with `200` and `Idempotent-Replay: true`, including after the method price changed, so the replay equals the first answer.
- **AC-8**: The storefront reads the methods through one hook, `useShippingMethods` under `apps/customer/src/hooks/shipping/`, exported through the hooks barrel at `apps/customer/src/hooks/index.ts`, fetching `/shipping-methods` through the existing fetcher with SWR and exposing `methods`, `isLoading`, `error` and `mutate`. The hardcoded array in `apps/customer/src/features/pages/Cart/components/CheckoutForm/index.tsx` is deleted, and no source file carries a shipping method id any more.
- **AC-9**: The checkout takes every amount and every currency from a named helper and prints no currency literal. `apps/customer/src/common/helpers/money.ts` exports `formatMoney(amount: number, currency: Currency)` (the existing emoji sign plus the amount through `toFixed(2)`) and `toCurrency(value: string): Currency`, which maps the `currency` string the API returns onto the `Currency` enum and falls back to `RUB` for an unknown value. `formatMoney` runs its argument through `toCurrency` before it asks for the sign, because `getCurrencyEmoji` falls back to a dollar sign for a value it does not recognise. It replaces the dollar literal in the selected item rows, in each method option (which prints its own method's currency) and in the subtotal, delivery and total lines, and all of them print one currency: the selected method's, or the first listed method's while nothing is chosen, because no cart read carries a currency. The catalog string `cart.placeOrder` loses its `${price}` placeholder, so the button reads a plain label. The select lists the methods the hook returns, each option showing its name and its price. While the request is in flight the trigger itself shows the busy label and the select is disabled, because a status item placed inside `SelectContent` never renders while the popover is closed. The money block shows a Subtotal line from the selected cart lines, a Delivery line from the selected method and a Total line as their sum, each through `formatMoney`; its currency is the selected method's currency, or the first listed method's while nothing is chosen, and the block is not rendered at all when the list is empty, because AC-10 blocks the form. Before a method is chosen the Delivery line reads 0.00 and the Total equals the Subtotal.
- **AC-10**: When the methods request fails or the list comes back empty, the select is disabled, the submit button is disabled, and the form shows a delivery unavailable message with a retry button that revalidates the hook. The submit button is also disabled while `shippingMethodId` is the empty string, which is its initial value and the value a refusal resets it to, so no order leaves the page without a chosen method. The client does not filter methods by the cart currency, because no cart read carries a currency in this feature; a currency mismatch is answered by the server under AC-5 and surfaced under AC-11.
- **AC-11**: The checkout branches on the response `code`, never on the server `message`. The code to catalog key map lives beside the hook, in `apps/customer/src/hooks/order/checkoutErrors.ts`. `useCheckout` stops reading `error.response.data.message`, does not raise its generic `orderFailed` toast for the three method codes, and rethrows an error carrying the `code`; `CheckoutForm` owns the catch, so the rethrown error never becomes an unhandled rejection and the customer never sees two toasts. On `409 SHIPPING_METHOD_INACTIVE` or `409 UNKNOWN_SHIPPING_METHOD` the form shows that code's text, revalidates the methods through the hook, resets `shippingMethodId` to the empty string, and keeps the address, delivery date and payment fields exactly as typed. On `409 SHIPPING_CURRENCY_MISMATCH` it shows that code's text and changes no field. Every other failure keeps the current generic message and its existing handling.
- **AC-12**: Both order surfaces take their money and their delivery name from the order row, and both stop printing a dollar sign. The order screen shows Subtotal from `totalPrice`, Delivery from `deliveryPrice` next to `shippingMethodName`, and Total from `grandTotal`, and its `getCurrencyEmoji(Currency.USD)` call sites, five in `OrderPage/index.tsx` (the method price line, the summary subtotal line, the summary delivery line, the summary total line and the item table) and one in `OrderCard/index.tsx`, read the order's own `currency` instead. The order card shows `grandTotal` in its total paid block and takes its method name line from `shippingMethodName`. The client `Order` type drops the optional nested `shippingMethod` object, carries `shippingMethodName`, `deliveryPrice` and `grandTotal`, and types `currency` as `Currency`; the `orders.shippingMethodFallback` key is removed because the stored name is required.
- **AC-13**: Every new string lives in both `apps/customer/messages/en.json` and `apps/customer/messages/ru.json`, and the two catalogs stay in parity. The `cart` namespace gains `shippingUnavailable`, `shippingRetry`, `shippingLoading`, `shippingInactive`, `shippingUnknown` and `shippingCurrencyMismatch`, and keeps its existing `subtotal`, `shipping` and `total` keys as the money block labels. The `orders` namespace gains `subtotal` for the line that now reads as the goods total, removes `totalPrice` and `shippingMethodFallback`, and keeps `shipping` and `total`. `shippingStandard`, `shippingExpress` and `shippingMethodFallback` are removed from both catalogs, and `placeOrder` reads `Place order` in English and `Оформить заказ` in Russian, with no price placeholder. Method names are English data and are not translated in this feature. The existing `apps/customer/src/features/pages/SellerOrders/messages.test.ts` compares only the `seller` namespace, so parity is proven by extending it to `cart` and `orders` and moving it to `apps/customer/src/i18n/messages.test.ts`, where every namespace of both catalogs is compared.
- **AC-14**: The behaviour is covered by tests: a gateway service spec for the read (only active rows, name order, money mapped through the shared helper); a route spec that mounts the shipping router in a bare Express app with a counting stub in place of the session middleware, because `app.ts` cannot be imported without `AUTH_SERVICE_URL` and a Redis store and this package carries no `supertest`, proving `401` without a session and exactly one call per request, plus a check that the router name appears in exactly one `app.use` line of `app.ts`; order service specs for the three refusals and their precedence; order integration specs on a real database for the stored snapshot, the stored `grandTotal` and a replay that answers the same snapshot after the method was re priced; a mapper spec for the list read proving `deliveryPrice` and `grandTotal` reach JSON as numbers; a spec proving a body carrying `grandTotal`, `deliveryPrice` or `shippingMethodName` is accepted with those fields ignored and not rejected; a vitest suite for `useShippingMethods` (success, failure, empty); a table test for `formatMoney` and `toCurrency` including an unknown currency falling back to `RUB` and never to a dollar sign; a checkout form states test (busy on the trigger, empty list, selectable, a coded `409` resets the method and keeps the other fields, the disabled submit, one toast per refusal); and the extended catalog parity test. The three order suites that assert a nested `shippingMethod` object (`order.controller.spec.ts`, `order.mapper.spec.ts`, `order.service.spec.ts`) are updated to the snapshot fields and keep covering the same behaviour, which is a changed assertion and not a weakened one. `pnpm quality-gate` is green.
- **AC-15**: The path is walked on the running stack: the checkout lists Standard Delivery at 299.00 and Express Delivery at 799.00 as rubles, read from the API, and no shipping method id exists in any source file; an order placed there stores `grandTotal` equal to lines plus delivery and the order screen shows the three lines with the ruble sign; a create call with an invented method id answers `409 UNKNOWN_SHIPPING_METHOD`; after setting a method to `isActive = false` in the database, a create call with that id answers `409 SHIPPING_METHOD_INACTIVE` and the open form refetches the list and clears the choice. The steps and their output live in `verify.md`.

## Decision

**Chosen option**: Option 2: serve the methods from the database and store the delivery price as an order snapshot.

The gateway gains a small `shipping` module that serves the active methods, the order transaction stores the method name, its price and the summed `grandTotal` on the order row, and the storefront drops its hardcoded ids for one hook. `ShippingMethod` gains a currency and an on and off switch, `price` becomes a decimal, and a migration leaves every environment with two real methods while it backfills history from the old prices.

**Implementation skills**: none installed that shape this decision; the repository conventions in `AGENTS.md` (module per folder, `authenticateToken` on every mount, mapper strips internal columns) are the authority.

## Feature design

**Data model**:

| Entity | Field | Type | Change |
| --- | --- | --- | --- |
| `ShippingMethod` | `id` | `String @id @default(cuid())` | none |
| `ShippingMethod` | `name` | `String @unique` | none |
| `ShippingMethod` | `price` | `Decimal @db.Decimal(10, 2)` | was `Float` |
| `ShippingMethod` | `currency` | `Currency @default(RUB)` | new |
| `ShippingMethod` | `isActive` | `Boolean @default(true)` | new |
| `Order` | `shippingMethodName` | `String` | new, snapshot |
| `Order` | `deliveryPrice` | `Decimal @db.Decimal(10, 2)` | new, snapshot |
| `Order` | `grandTotal` | `Decimal @db.Decimal(10, 2)` | new, stored |
| `Order` | `shippingMethodId` | `String` | none, foreign key stays for traceability |

Cardinality: `ShippingMethod 1:N Order`, `ON DELETE RESTRICT` unchanged, so a method that any order names cannot be deleted. The read path uses the snapshot columns, the relation stays for traceability and for the seller area.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
| --- | --- | --- | --- | --- | --- |
| `/api/shipping-methods` | GET | none | `{ methods: [{ id, name, price, currency }] }`, active only, by name | session cookie | `401` without a session |
| `/api/orders` | POST | `shippingMethodId` plus the existing body | order with `shippingMethodName`, `deliveryPrice`, `grandTotal` | session cookie, active account | `409 UNKNOWN_SHIPPING_METHOD`, `409 SHIPPING_METHOD_INACTIVE`, `409 SHIPPING_CURRENCY_MISMATCH`, plus the existing `409` and `422` codes |
| `/api/orders` | GET | none | orders carrying `shippingMethodName`, `deliveryPrice`, `grandTotal`, all three as JSON numbers | session cookie | `401` |

**Value sourcing**:

| Action | Value produced or displayed | Source |
| --- | --- | --- |
| method list | `id`, `name` | `ShippingMethod` columns, active rows only |
| method list | `price`, `currency` | `ShippingMethod.price`, `ShippingMethod.currency` |
| method list | row order | `name` ascending, chosen in this spec |
| order create | `shippingMethodName` | `ShippingMethod.name` read inside the transaction |
| order create | `deliveryPrice` | `ShippingMethod.price` read inside the transaction, as `Prisma.Decimal` |
| order create | `grandTotal` | `Order.totalPrice` plus `deliveryPrice`, added in `Prisma.Decimal`, stored |
| order create | currency used by the mismatch check | `resolveCurrency` over the priced lines, already in the service |
| checkout | subtotal | selected cart lines on the client, `price * quantityInCart`, formatted to two decimals at display, display only |
| checkout | delivery price and its currency | the selected method from the hook |
| checkout | total | subtotal plus delivery, formatted to two decimals at display, display only |
| order screen and card | subtotal, delivery, total, currency | `totalPrice`, `deliveryPrice`, `grandTotal`, `currency` on the order row |
| method list | `price` in JSON | shared `toMoney` in `apps/api-astrum/src/common/helpers/money.ts` |
| checkout | formatted amount and its sign | `formatMoney` in `apps/customer/src/common/helpers/money.ts` |
| checkout money block | the currency it prints | `toCurrency` over the selected method's `currency`, else the first listed method; no block while the list is empty |
| checkout refusal | the text shown | `apps/customer/src/hooks/order/checkoutErrors.ts`, each `code` to a `cart` catalog key |
| order card | the delivery name line | `Order.shippingMethodName` |

**Key invariants**:

- `grandTotal = totalPrice + deliveryPrice` for every order this feature creates, added in decimal arithmetic, never in the runtime's float.
- `totalPrice` stays the sum of the lines, so the seller area and every existing consumer keeps its meaning.
- A method that an order names is never deleted, only switched off.
- `shippingMethodName` and `deliveryPrice` never change after creation, so a later price change never rewrites an order.
- An order that stores `grandTotal` for a currency the lines do not use cannot exist, because a mismatch is refused.
- No order response carries a client supplied amount: `validateDto` strips extra fields through `excludeExtraneousValues` and the mapper reads the row.
- `deliveryPrice`, `shippingMethodName` and `grandTotal` are written by creation only. No database constraint ties the sum to its inputs, which was declined on purpose, so any future writer of a placed order must update `grandTotal` in the same transaction; the Follow-up records that rule.

**Security model**:

- Reading methods requires a session, like every other gateway router. There is no public endpoint, which is the existing choice for this gateway.
- Creating an order keeps `authenticateToken` and `requireActiveAccount`.
- No new personal data is stored. The delivery address and date rules stay as they are.

**Configuration required**: none. No new environment variable, no new service, no feature flag; the feature is additive and both methods exist in every environment after the migration.

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: the checkout lists two ruble methods from the API, an order is created with `deliveryPrice` 299.00 and `grandTotal` equal to lines plus delivery, and the order screen shows the three lines, verifies **AC-4**, **AC-6**, **AC-9**, **AC-12**, **AC-15**.
- Failure case: a method switched off between load and submit answers `409 SHIPPING_METHOD_INACTIVE`, the form refetches, clears the choice and keeps the typed fields, verifies **AC-5**, **AC-11**.
- Failure case: the methods request fails or returns nothing, the select and the submit are disabled, verifies **AC-10**.
- Permission case: the read route without a session answers `401` and runs the session middleware once per request, verifies **AC-4**.
- Regression case: an order replayed under its idempotency key after the method was re priced answers the snapshot stored at creation, verifies **AC-7**.

## Build plan

Tracer Bullet: one thin thread first (schema, seeded rows, read route), then the write path, then the storefront, so the thread reaches the browser before the polish.

1. Schema and migration: `ShippingMethod` decimal, currency and switch; `Order` snapshot columns and `grandTotal`; the four schema copies; the migration in the order of `## Migration plan`, including the backfill before the requote, the two standard rows matched by name, and `Verify delivery` switched off; regenerate every client, satisfies **AC-1**, **AC-2**, **AC-3**. — done 2026-11-10: migration applied to the dev database, 53 orders backfilled, zero rows with a mismatched grandTotal.
2. Gateway read: `apps/api-astrum/src/modules/shipping/` with controller, service and router, the router joined to the existing `/api` mount chain in `app.ts`, the active only filter, the name order, the mapper and the shared `common/helpers/money.ts` it maps through, satisfies **AC-4**. — done 2026-11-10: the live read answered Express 799.00 and Standard 299.00 in RUB.
3. Gateway write: the method read inside the transaction, the three refusals in the stated precedence, the new error codes in `order.constants.ts`, the snapshot and the stored `grandTotal` at creation, the mapper dropping the nested relation and mapping both new amounts, satisfies **AC-5**, **AC-6**, **AC-7**. — done 2026-11-10: the refusal, snapshot and replay specs are green.
4. Storefront read: `apps/customer/src/hooks/shipping/useShippingMethods.ts` plus the index export, the types, the two client money helpers in `apps/customer/src/common/helpers/money.ts`, and the `CheckoutForm` wiring that deletes the hardcoded array, lists the methods, formats every amount through the helpers, puts the busy state on the trigger and the empty state on the form, and renders the three money lines, satisfies **AC-8**, **AC-9**, **AC-10**. — done 2026-11-10: the checkout state spec is green and no source file carries a method id.
5. Storefront refusals and copy: the code to key map in `hooks/order/checkoutErrors.ts`, the typed error the hook rethrows, the refetch and the reset on an inactive or unknown method, the named keys in both locales, the removal of the three obsolete keys, and the parity test moved to `src/i18n/` and extended to `cart` and `orders`, satisfies **AC-11**, **AC-13**. — done 2026-11-10: the refusal map spec is green and both catalogs carry the same 17 namespaces.
6. Order surfaces: the client `Order` type and the order screen and card money block reading the snapshot and the order currency, satisfies **AC-12**. — done 2026-11-10: both screens read the snapshot and the customer build is green.
7. Tests and the gate: the specs named in **AC-14**, the walk in `verify.md`, `pnpm quality-gate`, satisfies **AC-14**, **AC-15**.

## Migration plan

**Strategy**: big bang, ordered inside one migration file, safe to deploy in one step because the deployable stack runs the `migrate` one shot before any service boots.

**Phases** (the file is created from the repo root with `pnpm prisma:migrate:dev` and lands in `packages/Astrum-db/prisma/migrations/`; `apps/api-astrum/prisma` holds a schema copy only and no migrations):

1. `ALTER TABLE "ShippingMethod" ALTER COLUMN "price" TYPE numeric(10,2) USING round(price::numeric, 2)`, then add `currency` with default `RUB` and `isActive` with default `true`. No recreate of the table, no loss, the three existing rows keep their ids.
2. Add `shippingMethodName`, `deliveryPrice` and `grandTotal` to `Order` as nullable.
3. Backfill all three from a join on the current `ShippingMethod` row, so 53 existing orders take the prices that were in force when they were placed, 5.99 and 12.99 for the standard rows and 5.99 for `Verify delivery`.
4. Set the three columns required.
5. `INSERT ... ON CONFLICT (name) DO UPDATE SET price = EXCLUDED.price, currency = EXCLUDED.currency, "isActive" = true`, with the `id` expression from AC-3. This one statement covers both shapes of database: where the names already exist those rows are re priced to 299.00 and 799.00 in `RUB` and keep their ids, and a fresh database gets the two rows. Step 5 must never run before step 3, and a row with any other name is left exactly as it is.
6. Switch off the row named `Verify delivery`. A database that holds no such row is untouched by the statement, and on the development database its 8 orders keep their snapshots.
7. Regenerate all four clients and rebuild every app before the services boot.

**Rollback**: on a database that existed before this migration the two demo rows survive with their original ids, so an old storefront bundle that still holds those two literals keeps working; on a database created after it those rows carry generated ids, so the literals match nothing and every order is refused. Code and schema therefore deploy together, which this stack does because `migrate` runs before any service boots. Rolling the storefront back on its own is only safe on a pre existing database. The schema rolls back with a hand written down migration: drop the three `Order` columns and the two `ShippingMethod` columns, and cast `price` back to `double precision`. Dropping the snapshot columns loses every recorded delivery amount, including the values backfilled for the existing orders, and after the requote those older prices exist nowhere else to recompute them from. That is why the down migration is a last resort and not a routine path.

**Risks**:

- A backfill that runs after the requote would rewrite the delivery price of 53 historical orders. The statement order in the file is the guard, and AC-2 is the check.
- `ALTER TABLE` on `Order` and `ShippingMethod` takes an exclusive lock. Both tables are small here (53 orders, 3 methods), so the lock is momentary; a shop at scale would need the nullable, backfill, required sequence split across two deploys, which is what this migration already does inside one transaction.
- The three `Order` columns become required inside the migration, so a gateway instance still accepting creates while it runs would fail with a server fault. The deployable stack runs `migrate` as a one shot before any service boots, so no instance writes during that window; a rolling deploy of the gateway alone would need the add nullable, deploy, backfill, set required sequence split across two releases.
- An environment may end up with more than the two standard methods, because a row with a different name is left active at its own price. The seeded pair is what every environment is guaranteed to have, not the only rows that can be active.

## Consequences

**Positive**:

- The money a customer sees equals the money stored, and the order screen stops displaying a total that excludes delivery.
- A fresh clone, a CI database and a production deploy all start with two working methods, so the checkout works without a manual insert.
- A method can be retired without deleting history, because orders name it by snapshot.
- Method names and prices become data, so a price change needs no deploy.
- The ruble data stops being printed as dollars on the two screens that matter for money.

**Negative and tradeoffs**:

- `grandTotal` is stored, so two columns of one row must stay consistent, and the `CHECK` constraint that would enforce the sum was declined. Only creation writes both, and nothing updates `totalPrice` after creation, so no code path can make them disagree today; a future feature that changes a line price on a placed order must update `grandTotal` in the same transaction, and that is written down in Follow-up.
- A re price that lands between the page load and the submit is stored without telling the customer. The order screen then shows the amount actually recorded, and a compare and set flow is recorded in Follow-up instead of built here.
- Three new error codes and three storefront states add surface for a checkout that already has many.
- The storefront cannot filter methods by the cart currency, because the cart read carries none. Until it does, a method in another currency is offered and refused at submit.
- Method names are stored in English and are not translated, so the Russian interface shows English delivery names.

**Neutral**:

- Four schema copies and four generated clients move together, which is the repository's existing cost.
- `Verify delivery` becomes inactive, so it disappears from the checkout while its 8 orders keep their lines.
- The seller area is untouched: a seller still sees line amounts only, and delivery stays an order level value. That is a product decision of this spec, not an oversight.

## Follow-up

- [ ] Any future feature that changes a line price or the delivery price of a placed order must update `grandTotal` in the same transaction; add that rule to the `AGENTS.md` order section of `apps/api-astrum`.
- [ ] The create call stores the price its transaction read and never compares it with the price the customer saw. When a change must be confirmed before charging, add a `409 SHIPPING_PRICE_CHANGED` that carries the new price; that needs the request to name the price it displayed, which this spec refuses on purpose.
- [ ] Add `currency` to the cart read so the checkout can offer only methods that match the cart, and drop the mismatch trail from the happy path.
- [ ] Product pages, the cart and the wishlist still print a dollar sign over ruble amounts; this spec fixes only the checkout and the order surfaces. One follow-up change should sweep the rest.
- [ ] Delivery method names are English data shown in a Russian interface. Localizing them needs either a name per locale on the method row or a translation key, and that is its own decision.
- [ ] A seller facing screen for delivery methods (create, price change, switch off) does not exist; an operator still edits rows by hand. Design it when the shop needs to change its own delivery prices.
- [ ] The free delivery line in the catalog copy (`Free shipping on orders over $100`) has no rule behind it; either implement a threshold or remove the claim.

## Rationale

Reasoning, the options weighed and the forces behind them: see [rationale.md](rationale.md).
