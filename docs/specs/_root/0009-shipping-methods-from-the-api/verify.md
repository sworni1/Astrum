# Verify: shipping methods from the API · spec 0009 · updated 2026-11-10

_Steps derived from spec 0009 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] Signed in with selected cart lines, open `/cart` → the delivery select lists Standard Delivery at 299.00 and Express Delivery at 799.00, both with the ruble sign, and no price comes from a literal in the code → AC-4, AC-8, AC-9
- [x] Choose Express Delivery → the money block shows the delivery price 799.00 and a total equal to the subtotal plus 799.00, all through `formatMoney` with the ruble sign, and the submit becomes enabled only at that point → AC-9, AC-10
- [x] Reload `/cart` on a throttled network → the select trigger itself shows the busy label while the request is in flight, no popover is needed to see it → AC-9
- [x] Submit the order → the order screen shows Subtotal, Delivery 799.00 next to Express Delivery, and Total equal to the sum, all with the ruble sign and no dollar sign anywhere on the screen → AC-6, AC-12
- [x] Open `/orders` → the card of that order shows the same total as the order screen → AC-12
- [x] Open an order placed before the migration → it still shows a delivery line, taken from the backfilled snapshot (5.99 or 12.99), not from the current price → AC-2
- [x] Set every method to `isActive = false` in the database, then reload `/cart` → the select and the submit are disabled, a delivery unavailable message shows, and its retry button refetches → AC-10
- [x] With a method chosen, set that method to `isActive = false`, then submit → a toast carries the coded text, the list refetches, the method clears, and the address, date and payment fields keep their values → AC-11
- [x] Switch the language to Russian → the new checkout and order strings read Russian and no key is missing → AC-13
- [x] At 360 px width the checkout money block and the select stack without horizontal scrolling → AC-9
- [x] `grep -rn "getCurrencyEmoji(Currency.USD)" apps/customer/src/features/pages/Cart apps/customer/src/features/pages/Orders apps/customer/src/features/pages/Orders/OrderCard` → no match, and `grep -n "toFixed(2)" apps/customer/src/features/pages/Cart/components/CheckoutForm/index.tsx apps/customer/src/features/pages/Orders/OrderPage/index.tsx apps/customer/src/features/pages/Orders/OrderCard/index.tsx` → no match, because every amount goes through `formatMoney` → AC-9, AC-12

## Commands

- [x] `docker exec astrum-db psql -U greedyghoster -d astrum-db -c "SELECT id, name, price, currency, \"isActive\" FROM \"ShippingMethod\" ORDER BY name;"` → exactly one Standard Delivery row at 299.00 RUB active and exactly one Express Delivery row at 799.00 RUB active, `Verify delivery` inactive, every price with two decimals → AC-1, AC-3
- [x] `curl -i http://localhost:3580/api/shipping-methods -H 'Cookie: __auth=<jwt>'` → `200 {"methods":[...]}` holding every active method, ordered by name, each item `{id,name,price,currency}` only → AC-4
- [x] The same call without the cookie → `401` in the existing error shape → AC-4
- [x] `curl -i -X POST http://localhost:3580/api/orders -H 'Content-Type: application/json' -H 'Cookie: __auth=<jwt>' -H 'Idempotency-Key: verify-ship-0001' -d '{"shippingMethodId":"no-such-method", ...}'` → `409 UNKNOWN_SHIPPING_METHOD`, no order row, stock unchanged → AC-5
- [x] The same call with the id of the inactive method → `409 SHIPPING_METHOD_INACTIVE` → AC-5
- [x] `UPDATE "ShippingMethod" SET currency = 'USD' WHERE name = 'Express Delivery';` then the same call with its id → `409 SHIPPING_CURRENCY_MISMATCH`; set the row back to `RUB` afterwards → AC-5
- [x] `docker exec astrum-db psql -U greedyghoster -d astrum-db -c "SELECT \"totalPrice\", \"deliveryPrice\", \"grandTotal\", \"shippingMethodName\" FROM \"Order\" ORDER BY \"createdAt\" DESC LIMIT 3;"` → `grandTotal` equals `totalPrice` plus `deliveryPrice` on every row and the name matches the chosen method → AC-6
- [x] Change the method price in the database, then repeat the create call with the same `Idempotency-Key` → `200`, `Idempotent-Replay: true`, and the answer carries the snapshot stored at creation, not the new price → AC-7
- [x] `diff packages/Astrum-db/prisma/schema.prisma apps/api-astrum/prisma/schema.prisma` → identical; `grep -c 'model ShippingMethod' apps/auth-astrum/prisma/schema.prisma apps/worker/prisma/schema.prisma` → `1` in both, each carrying `currency`, `isActive` and the decimal price → AC-1
- [x] `grep -rn "cmf3vpjoi\|cmf3vq53t\|ship_standard\|ship_express" apps packages --include='*.ts' --include='*.tsx'` → no match, so no source file carries a method id and the migration identifies rows by name → AC-8, AC-15
- [x] `pnpm db:generate` then `pnpm quality-gate` → green, with the three order suites updated to the snapshot fields → AC-14

## Acceptance-criteria coverage

- AC-1 → the psql method table step, the schema diff step and `pnpm db:generate`
- AC-2 → the pre migration order screen step
- AC-3 → the psql method table step (one row per standard name, both active, the artifact inactive)
- AC-4 → both `GET` steps and the checkout list step
- AC-5 → the three refusal calls and the unchanged stock and row count
- AC-6 → the psql order row step and the order screen step
- AC-7 → the replay after a price change step
- AC-8 → the checkout list step and the method id `grep` step
- AC-9 → the select, money block, two decimals and 360 px steps
- AC-10 → the all methods inactive step, the disabled submit before a choice, and the busy trigger step
- AC-11 → the switch off between load and submit step
- AC-12 → the order screen and order card steps and the two `grep` checks
- AC-13 → the Russian switch step and the moved parity test inside `pnpm quality-gate`
- AC-14 → `pnpm quality-gate`, which carries the updated order suites
- AC-15 → the whole walk above, including the method id `grep` step, run once end to end


## Run notes

### 2026-11-10, the API and the database only

This run was scoped to the criteria that live in the gateway and in Postgres, as requested. The steps that need the storefront (the checkout select, the money block, the Russian copy, the 360 px width, the order screen and the order card, the inactive method between load and submit) were not exercised and stay unticked.

Fixture: one throwaway account `verify-ship-user` (status ACTIVE) inserted directly with an argon2 hash, because `POST /api/auth/register` answers `500` when `dateOfBirth` is a bare date such as `2000-01-01` (it answers `200` with a full ISO datetime, which is what the storefront sends). The session was minted by `POST /api/auth/signin` on a second auth instance on port 4581 and sent as the `__auth` cookie. One cart line for product `ad8155bb-1912-47c0-b1bd-db758c39aa0d`, quantity 2 and later quantity 1, seeded directly.

What was observed, in order:

1. `ShippingMethod` rows: Express Delivery 799.00 RUB active, Standard Delivery 299.00 RUB active, Verify delivery 5.99 RUB inactive.
2. `GET /api/shipping-methods` with the cookie answered `200 {"methods":[{"id":"cmf3vq53t0001vdqk50gx74qz","name":"Express Delivery","price":799,"currency":"RUB"},{"id":"cmf3vpjoi0000vdqkkwrasuzx","name":"Standard Delivery","price":299,"currency":"RUB"}]}`, name order, active rows only, the four keys and nothing else.
3. The same call with no cookie answered `401 {"code":"SESSION_MISSING","message":"The session cookie is missing"}`, and with a garbage cookie `401 {"code":"TOKEN_INVALID",…}`.
4. `POST /api/orders` with `no-such-method` answered `409 {"code":"UNKNOWN_SHIPPING_METHOD"}`, the order count stayed at 53, the stock at 14 and the cart at 2.
5. The same call with the id of `Verify delivery` answered `409 {"code":"SHIPPING_METHOD_INACTIVE"}`, with nothing written.
6. With `Express Delivery` flipped to `USD` in the database the call answered `409 {"code":"SHIPPING_CURRENCY_MISMATCH"}`; the row was set back to `RUB` and the read answered `RUB` again.
7. A successful create with `Standard Delivery` answered `201` with `totalPrice` 31385.2, `deliveryPrice` 299, `grandTotal` 31684.2 and `shippingMethodName` `Standard Delivery`, no nested `shippingMethod`; the row stored 31385.20 / 299.00 / 31684.20, the stock fell from 14 to 12 and the ordered cart line was cleared.
8. `Standard Delivery` re priced to 349.00 and the same `Idempotency-Key` replayed: `200`, `Idempotent-Replay: true`, the same order id and the stored snapshot 299, not the new price. The price was set back to 299.00.
9. `GET /api/orders` and `GET /api/orders/<id>` both carry `totalPrice`, `deliveryPrice` and `grandTotal` as JSON numbers (`31385.2`, `299`, `31684.2`) and no nested `shippingMethod`.
10. A create body carrying `shippingMethodName: "Hijacked name"`, `deliveryPrice: 0.01`, `grandTotal: 0.02` and `totalPrice: 0.01` answered `201` with the row values (299 and 15991.6), so the three client supplied amounts were dropped.
11. Precedence: an unknown method id with an empty cart answered `409 CART_MISMATCH`, not `UNKNOWN_SHIPPING_METHOD`, so the cart check runs first as the spec states.
12. Every one of the 54 rows in the table at that point satisfied `grandTotal = totalPrice + deliveryPrice` and none had a null snapshot column; the 53 pre migration rows carry the old prices (5.99 and 12.99).

Tests: `pnpm --filter @astrum/api test` ran 22 suites with 137 tests passed (2 suites skipped), and `ORDER_DB_TESTS=1 pnpm --filter @astrum/api test order.integration` ran the 13 database tests green. `pnpm quality-gate` finished 18 of 18 tasks successfully, exit 0. `pnpm db:generate` regenerated the client. The storefront suite was run on its own as well: `pnpm --filter @astrum/customer test` answered 26 files and 120 tests passed, including the checkout form states, `useShippingMethods`, `formatMoney` and the catalog parity. Those tests are not an observation of the screens: the storefront steps above still need the browser walk.

Clean up: both verification orders and their items were deleted, the stock they took was added back (14), the cart rows, the throwaway account and its two Redis session keys were removed, and the second auth instance on port 4581 was stopped. `ShippingMethod` is back to Express 799.00 RUB active, Standard 299.00 RUB active, Verify delivery 5.99 RUB inactive.

Found while verifying, outside this spec: `POST /api/auth/register` with a bare date (`2000-01-01`) passes `@IsDateString()` and then fails inside Prisma 7 with `Invalid value for argument dateOfBirth: premature end of input. Expected ISO-8601 DateTime`, answered as `500`. Recorded in the deferred list of `docs/scope/_root/scope.md`.


### 2026-11-10, the storefront walk in a real browser

Session: the throwaway account again (`verify.ship-user`, ACTIVE), signed in through the API and the `__auth` cookie set with CDP, so the walk survives a harness restart. Cart line for `ad8155bb…` at quantity 2, and a synthetic pre migration order `verify-ship-oldorder`: `totalPrice` 1000.00, `deliveryPrice` 5.99, `grandTotal` 1005.99, the shape the backfill produced, while the current `Standard Delivery` price is 299.00, which is what makes that step prove the screen reads the snapshot rather than the method row.

1. `/cart`, item selected, `Proceed to Checkout`: the select opened with `Express Delivery ₽799.00 // Standard Delivery ₽299.00`, name order and ruble sign, prices from the API.
2. With the form filled and no method chosen the submit read `Place order`, `disabled: true`; after choosing Express the trigger read `Express Delivery ₽799.00`, the money block read `Subtotal ₽31385.20 // Shipping ₽799.00 // Total ₽32184.20` and the submit became `disabled: false`.
3. Throttled to 1500 ms and opening the checkout: the trigger timeline was `Loading delivery methods… | disabled=true @7685..8861ms`, then `Select shipping method | disabled=false @9732..13729ms`, sampled every 100 ms. The busy label sits on the trigger itself.
4. Submitting with Express answered the order screen `/orders/cmwan4x9n0004dkvd580p21iq`: `Subtotal ₽31385.20`, `Shipping ₽799.00` next to `Express Delivery`, `Total ₽32184.20`, five ruble signs and `document.body.innerText.includes('$') === false`, plus the success toast.
5. `/orders`: the card of that order read `Total paid ₽32184.20`, the same total, no dollar sign.
6. `/orders/verify-ship-oldorder`: `Shipping ₽5.99`, `Total ₽1005.99`, so the backfilled snapshot is what the screen prints, not the current 299.00.
7. All methods switched off in the database and the checkout reopened: the select `disabled: true`, the submit `disabled: true`, `Delivery is unavailable right now.` with an enabled `Retry`, and no money block. Both rows switched back on and `Retry` clicked: the message went, the select became enabled, the money block returned and the popover listed both methods again.
8. Express switched off in the database while the form held it and the fields filled: submit answered the toast `That delivery method is no longer offered. Pick another one.`, the trigger reset to `Select shipping method`, the money block fell to `Shipping ₽0.00`, the submit went back to disabled, and the address `Kept street 9, Yoshkar-Ola, 424000, Russia`, the date `November 17, 2026` and the payment `kept card 4321` all survived.
9. `NEXT_LOCALE=ru`: the checkout read `Оформление заказа`, `Адрес доставки`, `Способ доставки *`, `Выберите способ доставки`, `Желаемая дата доставки *`, `Данные оплаты`, `Промежуточный итог ₽31385.20`, `Доставка ₽0.00`, `Итого ₽31385.20`, `Оформить заказ`, no raw key names on the page, method names English as the spec says.
10. At 360x800: `scrollWidth 360 = clientWidth 360`, `overflowX 0`, no element wider than the viewport, the select at x 49 width 223 and the submit at x 49 width 262 stacked vertically.

Harness notes: Hermes `browser_exec` refuses a call that does not carry a local URL, and its leading navigation is a real reload, so each step began with its own navigation and the two steps that depend on surviving state (choosing Express, then submitting after a database flip) relied on the page staying mounted between calls. `Input.dispatchMouseEvent` timed out on every attempt, so the Radix `Select` was driven by keyboard: focus the trigger, `ArrowDown` to open, `Enter` on the focused option. Those are the switches this run needed; they are named here so the next run does not read them as a defect.

Observed, outside this spec and not fixed here: every order card prints `0 items`, because `toOrderListJson` takes a bare `Order` row while `OrderCard` counts `order.itemsCount` from `order.orderItems`; and the Russian cart summary prints `ДоставкаРассчитывается при оформлении` with no space, a catalog string issue on the cart surface this spec did not touch. Both are in the deferred list.
