# Scope: Astrum order flow

One order moves through three places: the storefront (`apps/customer`), the gateway (`apps/api-astrum`) and the shared schema (`packages/Astrum-db`). This plan holds the whole order path, slice by slice, so the storefront and backend scopes stay about their own pages. The seller surface began with the order panel, spec 0007. Session state and account confirmation cross the same places plus the auth service and a new worker, so their slices live here too. Becoming a seller crosses the storefront, the gateway and one `Business` row, so it is planned here as well.

**Build approach:** Tracer Bullet (every slice runs end to end through the storefront and the gateway).
**Workflow:** Beta (after `/develop`: `/check verify`, then `/test`). Features that move money or stock, or guard access, carry a `· GA` tag.

_These are recommendations to keep the build orderly, not requirements. Skip anything that does not fit. You decide when a feature is `done`._

## At a glance

| #   | Feature                               | Phase   | Status      |
| --- | ------------------------------------- | ------- | ----------- |
| 1   | Order price and stock on the server   | Slice 1 | done        |
| 2   | Idempotent checkout and cart clearing | Slice 1 | done        |
| 3   | Shipping methods from the API         | Slice 1 | done        |
| 4   | Order statuses with seller ownership  | Slice 2 | done        |
| 5   | Seller order panel                    | Slice 2 | done        |
| 6   | Customer cancel on the order screen   | Slice 2 | done        |
| 7   | Pickup handover                       | Slice 3 | done        |
| 8   | Reviews on the product screen         | Slice 4 | done        |
| 9   | Order flow end to end test and CI     | Slice 4 | planned     |
| 10  | Session store in Redis                | Slice 5 | done        |
| 11  | Account confirmation by email         | Slice 6 | in-progress |
| 12  | English interface by default          | Slice 7 | in-progress |
| 13  | Seller onboarding                     | Slice 8 | done        |
| 14  | Review likes and comments             | Slice 4 | done        |
| 15  | Payment through a test provider       | Slice 9 | done        |
| 16  | Order letters                         | Slice 9 | planned     |
| 17  | Confirm order lines when paid         | Slice 9 | in-progress |

## Slice 1: the order thread

The thinnest real order: the server decides the money and the stock, the browser just asks.

### 1. Order price and stock on the server · done · GA

Today the checkout form sends name, image and price, and the gateway stores them as sent, so the browser decides both money and stock.
**Done when:** each line price and the order total come from the product records, the order is written in one transaction, a line above the available stock is refused with a message naming the product, and stock drops exactly once per ordered unit.
- [x] Design it (spec): `/architect order price and stock on the server`
- [x] Build it: `/develop order price and stock on the server`
  - [x] Migration (two decimal money columns, currency backfilled from products, indexes) and narrowed DTOs with the validation status (AC-1, AC-2, AC-7)
  - [x] `AppError` carrier and the order service rewrite: products, transaction scoped cart read, currency check, conditional stock update, fresh availability on refusal (AC-1 to AC-6, AC-10)
  - [x] Owner check, `404` for a foreign order, decimal mapping in the three handlers (AC-8, AC-9)
  - [x] Storefront hook: `productId` and `quantity` only, error body read, cart revalidated on failure (AC-1, AC-4, AC-6)
  - [x] Tests: happy path, tampered body, 20 parallel requests on a stock of 5, limits, unknown shipping method, foreign read (AC-1 to AC-10)
- [x] Verify it: `/check verify order price and stock on the server` (2026-11-04: 10 of 10 AC on the live API; browser walkthrough still owed)
- [x] Test it: `/test order price and stock on the server` (2026-11-04: 28 tests in the order module, every `AC-1` to `AC-10` tagged, 41 passing with `ORDER_DB_TESTS=1`; the storefront `useCheckout` hook stayed untested because the package has no React testing library)
- [x] Review it (fresh model): `/check review order price and stock on the server` (2026-11-04: read on the same model, `delegation` is not configured in `config.yaml`; no blocking defect, one finding: the cancel toast shows a generic message instead of the server reason)
- [x] Document it: `/document order price and stock on the server` (README, `docs/DEVELOPMENT.md`, `docs/changelog/2026-11-04-order-price-and-stock.md`, `docs/changelog/2026-11-04-order-cancel.md`)
  spec [0001](../../specs/_root/0001-order-price-and-stock/index.md)
  code in `apps/api-astrum/src/modules/order`, `apps/api-astrum/src/common/helpers`, `packages/Astrum-db/prisma/migrations/20261104125143_order_price_and_stock`, `apps/customer/src/hooks/order`

### 2. Idempotent checkout and cart clearing · done · GA

A second click or a retry after a timeout can create a twin order, and the cart is only cleared in the browser.
**Done when:** a resubmission with the same `Idempotency-Key` returns the first order instead of creating a second, the ordered lines leave the cart on the server in the same transaction, and lines the customer did not select stay in the cart.
- [x] Design it (spec): `/architect idempotent checkout and cart clearing`
- [x] Build it: `/develop idempotent checkout and cart clearing` — 2026-11-04: schema, gateway and storefront built, `pnpm quality-gate` green
  - [x] Migration and gateway idempotency core: two nullable columns and the unique index, the header reader, the canonical fingerprint, the three replay paths with the fingerprint compare, the mapper dropping both columns (AC-1 to AC-4, AC-6, AC-7, AC-9, AC-12) — 2026-11-04: migration `20261104150202_order_idempotency` applied; repeat proved on the live database
  - [x] Cart clearing inside the order transaction, the skipped-clear log and the rollback policy (AC-5, AC-8) — 2026-11-04: `clearCart` after the order insert, three database specs green
  - [x] Storefront key generation and lifetime, `postItem` headers, replay read as success, the CORS header allowance (AC-10, AC-11) — 2026-11-04: CORS proved on the live preflight, the key helpers under vitest, the five UI steps confirmed by the owner
- [x] Verify it: `/check verify idempotent checkout and cart clearing` — 2026-11-04: 19 command steps and the database suite passed on the live stack, the five UI steps confirmed by the owner; log in the spec's `verify.md`
- [x] Test it: `/test idempotent checkout and cart clearing` (skipped: the owner marked the feature done on 2026-11-04)
- [x] Review it (fresh model): `/check review idempotent checkout and cart clearing` (skipped: the owner marked the feature done on 2026-11-04)
- [x] Document it: `/document idempotent checkout and cart clearing` (2026-11-10, [changelog entry](../../changelog/2026-11-04-idempotent-checkout.md))
  spec [0003](../../specs/_root/0003-idempotent-checkout-and-cart-clearing/index.md)

### 3. Shipping methods from the API · done

The checkout form carries two hardcoded ids that exist in one demo database only.
**Done when:** the checkout lists the delivery methods the gateway serves from the database, each with its price and currency; an order stores the method name, its delivery price and a server computed grand total equal to the lines plus delivery; a method that is missing, switched off or in another currency is refused with its own code; and the checkout and the order screens print the ruble currency instead of a hardcoded dollar sign.
- [x] Design it (spec): `/architect shipping methods from the API`
- [x] Build it: `/develop shipping methods from the API` — 2026-11-10: migration applied and verified in the database, the gateway read answered 799 and 299 rubles from the live rows, 26 customer suites and 24 api suites green, `pnpm quality-gate` passed
  - [x] Schema, migration and the seeded methods: decimal price, currency, switch, the order snapshot and grand total, backfill before the requote (AC-1, AC-2, AC-3)
  - [x] Gateway read of the active methods and the shared money helper (AC-4)
  - [x] Order write: three refusals, the snapshot, the stored grand total, the mapper without the nested relation (AC-5, AC-6, AC-7)
  - [x] Storefront: the hook, the client money helpers, the checkout list with its busy and empty states (AC-8, AC-9, AC-10)
  - [x] Refusals and copy, the order screen and card, then the tests and the gate (AC-11 to AC-15) — the code and the tests landed; the AC-15 walk on the running stack is the verify step
- [x] Verify it: `/check verify shipping methods from the API` — 2026-11-10: all 22 steps of [verify.md](../../specs/_root/0009-shipping-methods-from-the-api/verify.md) passed on the running stack. The gateway read answered Express 799 and Standard 299 in rubles and 401 without a session; the three refusals (`409 UNKNOWN_SHIPPING_METHOD`, `SHIPPING_METHOD_INACTIVE`, `SHIPPING_CURRENCY_MISMATCH`) wrote no order, took no stock and left the cart alone; an order stored `deliveryPrice` 799 and `grandTotal` equal to lines plus delivery, and the replay after a price change answered the stored snapshot; the checkout listed both methods from the API, the money block and the submit followed the choice, the busy label sat on the trigger, the order screen and the order card printed the ruble amounts with no dollar sign, a pre migration order kept its 5.99 snapshot, an empty list disabled the select and the submit with a working Retry, a method switched off between load and submit produced the coded toast and kept the typed fields, the Russian copy rendered and the form stacked at 360 px with no horizontal scroll
- [x] Test it: `/test shipping methods from the API` (not run as its own step: the owner marked the feature done on 2026-11-10. AC-14 is covered by the suites that shipped with the feature: 22 api suites with 137 tests, 13 of them on the real database with `ORDER_DB_TESTS=1`, 26 customer files with 120 tests, and `pnpm quality-gate` green on 18 of 18 tasks)
  spec [0009](../../specs/_root/0009-shipping-methods-from-the-api/index.md)
  code in `apps/api-astrum/src/modules/shipping`, `apps/api-astrum/src/modules/order`, `packages/Astrum-db/prisma/migrations`, `apps/customer/src/hooks/shipping`, `apps/customer/src/features/pages/Cart/components/CheckoutForm`

## Slice 2: statuses and the seller

### 4. Order statuses with seller ownership · done · GA

The order screen shows an order status and a cancel action. The gateway only handles customer cancellation today. A client hook calls a route for line status changes, but the gateway has no such route. Products have a business id, but an order line does not record its seller.
**Done when:** each ordered line is tied to its seller; sellers can read and change only their own lines; allowed line status changes and their effect on the order status are clear and enforced; cancellation returns stock once; and invalid changes get a clear response.
- [x] Design it (spec): `/architect order statuses with seller ownership`
- [x] Build it: `/develop order statuses with seller ownership` (2026-11-07: API quality gate passed with 92 tests including database integration, database types passed)
  - [x] Business ownership schema, legacy backfill and checkout snapshots (AC-1 to AC-4)
  - [x] Seller order reads, pagination and ownership enforcement (AC-5, AC-7)
  - [x] Line transitions, customer cancellation, order status and atomic stock returns (AC-6, AC-8 to AC-12)
  - [x] Feature flag, error mapping, structured logs and rollout checks (AC-7, AC-13, AC-14)
- [x] Verify it: `/check verify order statuses with seller ownership` (2026-11-07: live API and Postgres checks passed for all 14 ACs)
- [x] Test it: `/test order statuses with seller ownership`
- [x] Review it (fresh model): `/check review order statuses with seller ownership`
- [x] Document it: `/document order statuses with seller ownership` (2026-11-07: `CHANGELOG.md`)
  code in `apps/api-astrum/src/modules/order`, `apps/api-astrum/src/modules/product`, `packages/Astrum-db/prisma/migrations/20261107230000_business_ownership_snapshot`, `packages/Astrum-db/prisma/migrations/20261107230100_business_ownership_constraints`
  spec [0002](../../specs/_root/0002-order-cancel.md)

### 5. Seller order panel · done · GA

A seller has an API and no screen: the gateway answers the seller's own lines and accepts line status changes (spec 0002), while the storefront only shows customer orders and nothing tells a signed in user whether they sell.
**Done when:** a seller can sign in; sees only their own order lines grouped by order; can use clear actions to move eligible lines through the agreed status flow; and requests for another seller's lines are refused.
- [x] Design it (spec): `/architect seller order panel` — 2026-11-08: 16 acceptance criteria after a cross check
- [x] Build it: `/develop seller order panel`
  - [x] Identity and access: `isSeller` on the profile read, the account gate on the status route, the storefront type (AC-2, AC-13)
  - [x] Thin thread: the page, the list hook and the refusal screens (AC-1, AC-4, AC-11)
  - [x] The `Sales` navigation entry for sellers (AC-3)
  - [x] Actions, dialogs, the mutation and coded refusals (AC-5 to AC-10)
  - [x] Copy, density, mobile, accessibility, the assignment script and the tests (AC-12, AC-14 to AC-16)
- [x] Verify it: `/check verify seller order panel` — 2026-11-08: all 23 steps of the spec's `verify.md` are closed against the live storefront and gateway; the last one open (AC-5, a page change replacing the rows with the skeleton) failed first, then was fixed with a reproduction test and re-checked live at 1500 ms latency on 21 orders, and the `placehold.co` thumbnails were fixed and seen decoding (19 of 19); log in the spec's `verify.md`
- [x] Test it: `/test seller order panel`
- [x] Review it (fresh model): `/check review seller order panel`
- [x] Document it: `/document seller order panel` (2026-11-08: changelog entry in
  `docs/changelog/2026-11-08-seller-order-panel.md`)
  spec [0007](../../specs/_root/0007-seller-order-panel/index.md)
  code in `apps/customer/src/app/(content)/seller/orders`, `apps/customer/src/features/pages/SellerOrders`, `apps/customer/src/hooks/order`, `apps/customer/src/features/layout/Navbar`, `apps/api-astrum/src/modules/user`, `apps/api-astrum/src/modules/order/seller-order.routes.ts`, `packages/Astrum-db/scripts`

### 6. Customer cancel on the order screen · done

The cancel button on the order screen (`apps/customer/src/features/pages/Orders/OrderPage/index.tsx`) calls `PATCH /api/orders/:orderId/status`, which the gateway serves (feature 4, spec 0002, verified on the live API on 2026-11-07); the screen path itself has never been walked end to end, and the ladder has no verify step.
**Done when:** a customer cancels an order while it is `PENDING` or `CONFIRMED`, after one confirmation; the screen shows the new status without a reload; the stock comes back; the action is gone once no cancellable status remains; and a cancelled order prints what happened to its payment instead of claiming the payment is still pending.
- [x] Design it (spec): `/architect customer cancel on the order screen`
- [x] Build it: `/develop customer cancel on the order screen`
  - [x] The gateway answer into the cache plus `revalidateOrder` through `allSettled` (AC-5, AC-6) — done: `src/hooks/order/useUpdateOrderStatus.ts`, the call order pinned by `useUpdateOrderStatus.test.tsx`
  - [x] The `AlertDialog` with its keep and send controls, `XCircle`, the busy state that keeps focus, and the two eligible statuses (AC-1 to AC-4, AC-8, AC-10) — done: `components/CancelOrderDialog` (it owns its trigger and open state, so the header only decides whether to render it) plus `canCancel()` in `lib/status.ts`
  - [x] The three outcomes, each re reading the order (AC-6) — done: `cancelRefusal` gained `cancelUnconfirmed`, every branch awaits `revalidateOrder`, covered in `useCancelOrder.test.tsx`
  - [x] Payment labels and both catalogs, the two dead keys deleted (AC-7, AC-9) — done: `PAYMENT_STATUS_KEYS` in `lib/payment.ts`, both catalogs carry the new keys and lost `orders.paid` and `orders.paymentPending`
  - [x] Tests including the two existing mocks (AC-11) — done: `pnpm --filter @astrum/customer test` 174 passed; the `verify.md` walk belongs to the `Verify it` row
- [x] Verify it: `/check verify customer cancel on the order screen` — 2026-11-11, PASS on the running dev stack (24 of 25 verify steps exercised, every acceptance criterion met; the one skipped step is the 10000 ms timeout, same branch as the observed transport failure). Two premise corrections are recorded in `verify.md`: `AlertDialog` ignores an overlay click by design, so Escape and the keep control carry that clause.
- [x] Test it: `/test customer cancel on the order screen` (not run as its own pass: the owner closed the slice on 2026-11-11. Coverage that exists: 174 tests in 40 files for `@astrum/customer`, the AC-11 scenarios named one by one in `CancelOrderDialog/index.test.tsx`, `OrderPageHeader/index.test.tsx`, `useCancelOrder.test.tsx`, `useUpdateOrderStatus.test.tsx`, `payment.test.ts` and `cancelDialogCopy.test.ts`, plus the live walk of 24 verify steps on the running stack)
  spec [0011](../../specs/_root/0011-customer-cancel-on-the-order-screen/index.md)
  code in `apps/customer/src/features/pages/Orders/OrderPage/` (header, dialog, cancel hook, payment table) and `apps/customer/messages`

## Slice 3: handover

### 7. Pickup handover · done

Pickup is how this shop hands an order over, and nothing closes an order today.
**Done when:** a customer chooses a pickup point at checkout, the seller marks the order handed over at that point, the order becomes `DELIVERED`, and the order screen shows the pickup point and the handover date.
- [x] Design it (spec): `/architect pickup handover` — 2026-11-12: 16 acceptance criteria after a cross check
- [x] Build it: `/develop pickup handover`
  - [x] Schema, migration, operator script, the points read and the `isPickup` flag on the method read (AC-1 to AC-4)
  - [x] Checkout: the data layer and the point field with its three refusals (AC-5, AC-6, AC-14)
  - [x] Order create, then the customer order answers and surfaces (AC-7 to AC-9)
  - [x] Seller read, the handover route and the per line dates (AC-10 to AC-12)
  - [x] Seller panel, copy and tests (AC-13 to AC-15); the live walk of `verify.md` stays with `Verify it`
- [x] Verify it: `/check verify pickup handover` — 2026-11-12, PASS on the running dev stack (55 of 57 verify steps exercised and passing, every acceptance criterion met; the two left unticked are the Russian copy of the loading and failure states, never on screen because the local API answers first, and the focus return after Escape, which lands on `body`). Five premise corrections and the harness switches are recorded in `verify.md`.
- [x] Test it: `/test pickup handover` (not run as its own pass: the owner closed the slice on 2026-11-12. Coverage that exists: 213 tests in 36 suites for `@astrum/api` with `ORDER_DB_TESTS=1`, including the two seller handover race, 240 tests in 53 files for `@astrum/customer`, and the live walk of 55 of 57 `verify.md` steps on the running stack)
  spec [0013](../../specs/_root/0013-pickup-handover/index.md)
  code in `packages/Astrum-db/prisma/migrations/20261112120000_pickup_handover`, `packages/Astrum-db/scripts/pickupPoint.ts`, `apps/api-astrum/src/modules/pickup`, `apps/api-astrum/src/modules/order` (create, seller read, handover, line dates), `apps/customer/src/hooks/pickup`, `apps/customer/src/hooks/seller/useSellerHandover.ts`, `apps/customer/src/features/pages/Cart/components/CheckoutForm`, `apps/customer/src/features/pages/SellerOrders`, `apps/customer/src/features/pages/Orders`, `apps/customer/messages`

## Slice 4: closing the loop

### 8. Reviews on the product screen · done

The review API already refuses a review without a `DELIVERED` purchase, while the product screen still renders mock reviews.
**Done when:** the product screen shows the reviews and the rating summary from the API, a customer with a delivered line can write one review, and the form stays hidden for anyone who did not buy.
- [x] Design it (spec): `/architect reviews on the product screen` — 2026-11-11: 15 acceptance criteria after a cross check pass
- [x] Build it: `/develop reviews on the product screen`
  - [x] Gateway read: `reviewState` on the product answer, the shared serializer, the zero filled distribution, the `createdAt, id` ordering, the `after` check and the router param fix (AC-1, AC-7, AC-12)
  - [x] Gateway write: `AppError` codes for every refusal, `APPROVED` on create, the path product, `getReviewById` off the bare `Error` (AC-11)
  - [x] Storefront data layer and the thin thread: types, the two hooks, the real list, the card, the empty and error states (AC-2, AC-4, AC-6, AC-14)
  - [x] Summary, the header line and the write dialog with its six refusal branches (AC-3, AC-5, AC-8, AC-9, AC-10)
  - [x] Both catalogs and the test suites (AC-13, AC-15)
- [x] Verify it: `/check verify reviews on the product screen` — 2026-11-11: the dedicated pass was waived when the owner marked the feature done. A walkthrough on the dev stack covered the empty state, both blocked states, the write dialog with its field messages, a written review, the summary and the mobile layout (1440x900 and 390x844); the rest of `verify.md` was not run, and the photo layout could not be seen because the local image optimizer answers `500`
- [x] Test it: `/test reviews on the product screen` — 2026-11-11: no separate pass was run; the tests landed with the build, 31 gateway cases (`reviews/*.spec.ts`) and 36 storefront cases (feature, `reviewsKeys`, `create-review.scheme`), and `pnpm --filter @astrum/customer test` answers 209 passed
  spec [0012](../../specs/_root/0012-reviews-on-the-product-screen/index.md)
  code in `apps/api-astrum/src/modules/reviews`, `apps/api-astrum/src/modules/product`, `apps/customer/src/features/pages/ProductOverview`, `apps/customer/src/hooks/review`, `apps/customer/src/common/types/product.types.ts`, `apps/customer/messages`

### 9. Order flow end to end test and CI · planned

Nothing proves the order path keeps working, and no pipeline runs the gates.
**Done when:** one end to end test walks register, add to cart, checkout and see the order against a real database, and CI runs types, lint, unit tests and that test on every pull request.
- [ ] Design it (spec): `/architect order flow end to end test and CI`

### 14. Review likes and comments · done

The card carries a like and a comment control that spec 0012 left visibly disabled, so the reviews block still promises two features it does not have.
**Done when:** a confirmed customer likes a review and the number moves at once, the liked set comes from its own route so the shared list stays one body for every reader, a flat comment thread opens under the card with its own form, the author can soft delete their own reply, both counters come from the server row, and every refusal answers a code the screen branches on.
- [x] Design it (spec): `/architect review likes and comments` — 2026-11-12: 15 acceptance criteria after a cross check pass
- [x] Build it: `/develop review likes and comments`
  - [x] Schema and the four schema copies: `ReviewLike`, `ReviewComment`, `Review.likeCount` and `Review.commentCount`, one migration, then `pnpm prisma:generate` (AC-2, AC-4, AC-8, AC-10)
  - [x] Likes: the two idempotent routes, the liked set route and the counters in the shared serializer (AC-2, AC-3, AC-4, AC-5)
  - [x] Likes on the screen: `useReviewLikes`, `useReviewCounts`, `ReviewLikeButton` with its optimistic press and rollback (AC-1, AC-5, AC-6, AC-13)
  - [x] Comments read and write: the page, the create with the hourly limit, the soft delete, then the thread, the form and the delete dialog (AC-7, AC-8, AC-9, AC-10, AC-11, AC-12)
  - [x] Copy in both catalogs, the removed `comingSoon`, and the test suites (AC-13, AC-14, AC-15)
- [x] Verify it: `/check verify review likes and comments` — 2026-11-12: the full pass ran on the dev stack against every AC and every command in `verify.md` (55 steps). The first run failed on one runtime defect, the like press answering `400` because the client sent the literal `null` body through `express.json`; the fix in `useFetcher.putItem` landed the same day and the re-run passed every step: 20 cards plus an appended page liked from the screen, both refusals, the transport failure and its recovery, the thread, the paging, the delete dialog, Russian copy, the keyboard walk, and the four gates (api 238 tests, customer 268, lint 0 errors, types 5 of 5). `useFetcher` carries the fix with no suite of its own, which `/test` owes it
- [x] Test it: `/test review likes and comments` — 2026-11-12: no separate pass was run; the feature closed with the suites that landed alongside the build. The gateway answers 238 tests over 36 suites (3 skipped) covering the repeat like, the unlike, the counters against the child rows, the ordering with its tiebreak, the dropped extra row, the clamped limit, the foreign cursor, the deleted row, `mine`, the `429`, the failed insert, the foreign delete, the repeat delete and the `400` naming `body`; the storefront answers 268 tests over 58 files, 58 of them in `src/hooks/review` and `Reviews`; `pnpm check-types --force` is 5 of 5 and lint exits 0. One gap is recorded rather than closed: `useFetcher.putItem`, which carries the like body fix, has no suite of its own
  spec [0014](../../specs/_root/0014-review-likes-and-comments/index.md)
  code in `apps/api-astrum/src/modules/reviews`, `apps/api-astrum/src/modules/product`, `packages/Astrum-db/prisma`, `apps/customer/src/features/pages/ProductOverview/Reviews`, `apps/customer/src/hooks/review`, `apps/customer/src/common/types/review.types.ts`, `apps/customer/messages`

## Slice 5: session state

### 10. Session store in Redis · done · GA

A session today is a signed token and nothing else: the auth service signs `{ userId }` for one day, the gateway verifies the signature on each request, the storefront keeps its own copy in the `__auth` cookie for seven days, and logging out only deletes that cookie. Nothing on the server remembers a session, so a copied token stays valid until it expires and no replica can revoke it.
**Done when:** signing in writes one session record, keyed by an id carried inside the token, to a store every replica reads; the gateway answers `401` for a token whose record is gone, whatever replica serves the request; logging out revokes that one session so the same token is refused everywhere at once while the user's other sessions keep working; and a request on a live session still passes.
- [x] Design it (spec): `/architect session store in Redis`
- [x] Build it: `/develop session store in Redis` — 2026-11-04: store, guard, logout, revocation, health and the storefront handlers built, `pnpm quality-gate` green
  - [x] Store and client: `redis` service in both compose files, `REDIS_URL` in both env templates, one `ioredis` client per app that fails at boot without it (AC-13)
  - [x] Thin thread: `sid` in the token, the record written with `EX 86400` before the answer, the guard reading it, `503` on a failed write, the unused `updateSession` deleted (AC-1, AC-2, AC-9, AC-14)
  - [x] Refusals: the four `401` codes, an unreadable record, an owner mismatch, a token without `sid`, one log line per branch (AC-2, AC-3, AC-7, AC-10)
  - [x] Revocation: `POST /api/auth/logout` with `cookie-parser`, password change and account deletion (AC-4, AC-5, AC-6)
  - [x] Health and the storefront: Redis in `/health`, the logout server action, the shared `401` handling (AC-8, AC-11, AC-12)
- [ ] Verify it: `/check verify session store in Redis` (not run as its own step: on 2026-11-04 twelve of the fourteen AC were exercised on the live dev stack during `/develop`, the two browser steps for AC-11 and AC-12 stayed unrun and live in the spec's `verify.md`; the owner marked the feature done)
- [ ] Test it: `/test session store in Redis` (skipped: the owner marked the feature done on 2026-11-04; the guard, the auth service and the auth controller carry suites written with the feature)
- [ ] Review it (fresh model): `/check review session store in Redis` (skipped: the owner marked the feature done on 2026-11-04)
- [x] Document it: `/document session store in Redis` (2026-11-04: `docs/changelog/2026-11-04-session-store-in-redis.md`, roadmap split in `README.md`)
  spec [0004](../../specs/_root/0004-session-store-in-redis/index.md)
  code in `apps/api-astrum/src/session`, `apps/api-astrum/src/middlewares/authenticateToken.ts`, `apps/api-astrum/src/modules/user/user.service.ts`, `apps/auth-astrum/src/redis`, `apps/auth-astrum/src/auth`, `apps/customer/src/common/helpers/session.ts`, `apps/customer/src/hooks/useFetcher.ts`, `docker-compose.yml`, `docker-compose.prod.yml`

## Slice 6: confirming an account

### 11. Account confirmation by email · in-progress · GA

Registering hands out a session at once, so an account works before anyone proved they own the mailbox. Nothing here can send that proof: there is no mail transport, no broker, no worker, and `User` carries no status at all.
**Done when:** a new account and every existing one starts `PENDING`, can sign in and browse, and is refused on ordering, on writing a review and on every profile field except the email; one link from the letter confirms it once and works in one click, while an expired, replaced or unknown link lands on a page that says which and offers another letter; the letter ships through a worker fed by a broker, retries with delays, and keeps what it cannot deliver in a dead letter queue; asking for another letter is limited per address and per IP; changing the address puts the account back to `PENDING` and sends a letter to the new one.
- [x] Design it (spec): `/architect account confirmation by email`
- [x] Build it: `/develop account confirmation by email` — 2026-11-05: schema, gate, worker, confirm, resend and the email change rules built, `pnpm quality-gate` green, the whole path proved on the running stack
  - [x] Schema and the status on the read path: migration, `EmailToken` bound to the address, `status` in `GET /api/users/me` (AC-1, AC-2) — done: migration applied, 29 existing rows read `PENDING`, the profile answers the status
  - [x] Gate and publisher: `requireActiveAccount` reading `User.status` with its `503` case, `EMAIL_TAKEN` on register, the event published after commit (AC-3, AC-4, AC-9, AC-10) — done: `403` and `503` proved live, register answered `200` in 92 ms with the broker stopped
  - [x] Worker and the letter: `apps/worker`, Rabbit and Mailpit in both compose files, token minting, the letter, retries and the dead letter queue (AC-5, AC-6, AC-7, AC-16, AC-17) — done: `/health` `{rabbit:true,smtp:true}`, the letter in Mailpit with one link, 16 worker tests
  - [x] Confirm and resend: `GET /api/auth/confirm` with its four outcomes, `resend` with its limits, the storefront screen and banner (AC-8, AC-11, AC-13, AC-14) — done: four outcomes proved by redirect, the screen rendered at desktop and mobile, the cooldown counted down from 59 s
  - [x] Email change and rights: the `PATCH /api/users/me` rules, `400` and `409`, the status reset, the profile form (AC-12, AC-15) — done: `403`, `400`, `409` and a `200` that went back to `PENDING` and sent a letter
- [x] Verify it: `/check verify account confirmation by email` — 2026-11-05: all 17 acceptance criteria walked on a freshly started stack, including the letter lifecycle, both rate limits, the boot refusals and the 21 minute retry ladder that ends in the dead letter queue; three defects found on the way and fixed (`consumer.ts`), the confirm token reaching the gateway access log and `email.publish.failed` logging an empty reason; log in the spec's `verify.md`, three steps still owed
- [x] Test it: `/test account confirmation by email` — 2026-11-05: отдельного прохода `/test` не было (по решению владельца), покрытие закрыто тем, что уже лежит в репозитории: `apps/worker` 24 теста на топологию, токены, письмо, лестницу ретраев и outbox, `auth` 41 тест на регистрацию, confirm, resend и лимиты, `api` 73 теста включая `requireActiveAccount`, плюс живые 17 AC из `/check verify`; `pnpm quality-gate` 18 из 18
- [x] Review it (fresh model): `/check review account confirmation by email`
- [x] Document it: `/document account confirmation by email` — 2026-11-05: entry `docs/changelog/2026-11-05-account-confirmation.md`, written from the diff and the verify report (Added, Changed, Fixed, Verified, Open)
  spec [0005](../../specs/_root/0005-account-confirmation-by-email/index.md)
  code in `packages/Astrum-db/prisma/migrations/20261105112608_account_confirmation`, `apps/auth-astrum/src`, `apps/api-astrum/src/middlewares/requireActiveAccount.ts`, `apps/api-astrum/src/events`, `apps/api-astrum/src/modules/user`, `apps/worker`, `apps/customer/src/features/auth/ConfirmEmail`, `apps/customer/src/features/layout/ConfirmEmailBanner`, `docker-compose.yml`, `docker-compose.prod.yml`

Today: the register path signs a token in `apps/auth-astrum/src/auth/auth.service.ts` and the storefront writes the cookie in `apps/customer/src/hooks/auth/useAuth.ts`; `POST /api/auth/*` is proxied whole, so a confirm route needs no gateway change.

## Slice 7: English by default

### 12. English interface by default · in-progress · Alpha

A visitor meets Russian in places: toasts and screens across ten storefront files, the subject and body of the confirmation letter, and most of the root README with parts of the app READMEs. English should be what a visitor sees first, with Russian kept as a second locale.
**Done when:** every storefront screen, toast, form error, confirmation page and review block answers in English by default, the confirmation letter arrives in English, the root README, each app README and `docs/DEVELOPMENT.md` read in English, a language switcher moves the whole interface to Russian and back, that choice survives a reload, and no Russian string is left in the English catalog.
- [x] Design it (spec): `/architect english interface by default`
- [x] Build it: `/develop english interface by default` (2026-11-06: built, `pnpm quality-gate` green, the storefront build and the switch checked in a browser)
  - [x] Locale plumbing and switcher: next-intl with no routing layer, the cookie, the server action and the switcher in the navbar, the mobile menu and the auth screens, localized metadata (AC-1 to AC-4, AC-11)
  - [x] Every storefront screen on the catalog, both catalogs complete and in parity, dates through the formatter (AC-5 to AC-8)
  - [x] Letter language from the request through register, resend, the address change and the worker (AC-9, AC-10)
  - [x] Documentation in English, tests updated, `pnpm quality-gate` green (AC-12, AC-13)
- [ ] Verify it: `/check verify english interface by default`
  spec [0006](../../specs/_root/0006-english-interface-by-default/index.md)
  code in `apps/customer/src/i18n`, `apps/customer/messages`, `apps/customer/src/components/LocaleSwitcher.tsx`, `apps/customer/src/common/actions`, `apps/worker/src/letters`

## Slice 8: becoming a seller

### 13. Seller onboarding · done · GA

Becoming a seller today means an engineer runs `pnpm db:assign-business <email>`: it hands over an unassigned `Business` that owns products, creates one when none is free, and sets `ownerUserId`. Nothing in the product offers this, a `Business` row carries nothing but an id and a creation date, and the seller panel answers only after that script runs.
**Done when:** a confirmed, signed in user becomes a seller from the storefront in one deliberate action, without anyone running a script or touching the database; the seller area and the seller endpoints answer for that account right away and after a reload; an unconfirmed account and a second attempt create nothing; and the account ends up owning exactly one shop of its own.
- [x] Design it (spec): `/architect seller onboarding` (2026-11-09: 15 acceptance criteria after a cross check)
- [x] Build it: `/develop seller onboarding` — 2026-11-09: schema, gateway, page and entry points built, `pnpm quality-gate` green, the migration applied and the schema confirmed live
  - [x] Schema, migration and clients: `Business.name`, the three step migration, the script and fixtures, regenerate (AC-13)
  - [x] Gateway endpoint: `POST /api/seller/onboarding` with the account gate, the name normalization, the idempotent repeat and its specs (AC-5 to AC-8)
  - [x] Storefront page and hook: `/seller/onboarding`, the form, the states, the success card and the catalog keys (AC-1, AC-3, AC-4, AC-9 to AC-11)
  - [x] Entry points, layout and tests: the profile section, the panel action, the accessibility pass and `pnpm quality-gate` (AC-2, AC-12, AC-14, AC-15)
- [x] Verify it: `/check verify seller onboarding` — 2026-11-10: PASS, 17 of 17 verify steps ran, 15 acceptance criteria checked live (AC-3 and AC-10 owe two unobserved sub-states, listed in the spec `verify.md`)
- [x] Test it: `/test seller onboarding`
- [x] Review it (fresh model): `/check review seller onboarding`
- [x] Document it: `/document seller onboarding` (2026-11-10: changelog entry in
  `docs/changelog/2026-11-10-seller-onboarding.md`, roadmap line in `README.md` and `README.ru.md`)
  spec [0008](../../specs/_root/0008-seller-onboarding/index.md)
  code in `apps/api-astrum/src/modules/seller`, `apps/customer/src/features/pages/SellerOnboarding`, `apps/customer/src/features/pages/Profile/actions/SellOnAstrum`, `apps/customer/src/hooks/seller/useBecomeSeller.ts`, `packages/Astrum-db/prisma/schema.prisma`

## Slice 9: payment, acceptance and order letters

### 15. Payment through a test provider · in-progress · GA

The checkout stores `paymentMethod` and `paymentStatus` and nothing charges anything: `ONLINE_CARD`, `PAYPAL` and `STRIPE` are labels the order screen prints, no env template names a provider, the gateway has no payment module, no callback route and no provider reference on the order, and `paymentDetails` is free text typed by the client.
**Done when:** a customer pays an online card order on the Stripe test page from the order screen and lands back on it, the order's `paymentStatus` becomes `PAID` once from a callback whose signature, session, amount and currency are checked against the stored order, a second delivery of the same callback changes nothing, a declined card leaves the order payable for the rest of its 32 minute window with the stock still held, an abandoned payment closes the order and returns the stock once, cancel expires the session and a callback that lands afterwards is recorded as `PAID` with a refund owed, and `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` arrive from the environment in dev and in the production template.
- [x] Design it (spec): `/architect payment through a test provider`
- [x] Build it: `/develop payment through a test provider`
  - [x] Schema, adapter, pay route, paid callback and the pay control (AC-1, AC-2, AC-4, AC-5, AC-6, AC-13) — done: two new tables, two enums and `Order.paymentExpiresAt` applied to the dev database (`Payment_one_pending_per_order` partial unique index live), `stripe@23.1.0` behind `PaymentGateway`, `POST /api/orders/:orderId/payment`, the raw body webhook mounted before `express.json`, and `PaymentActions` on the order screen
  - [x] Failure paths of the callback (AC-5, AC-7, AC-12) — done: amount and currency compared through `toMinorUnits`, the event log inserted before the apply with the unique key as the replay guard, the adoption branch for a session stored after the callback, the decline and async failure transitions, and `payment.refund_owed` on a paid callback after a cancel
  - [x] Expiry, sweep and cancel (AC-8, AC-9, AC-11) — done: `closeOrder(tx, order)` shared by the cancel route and the expiry, the one minute pass behind `pg_try_advisory_xact_lock` started from `server.ts`, and the cancel expiring the session before its transaction opens
  - [x] Sync and the return screen (AC-10, AC-14) — done: `POST /api/orders/:orderId/payment/sync` through the same apply path, one call on mount behind a ref guard, the checking state, and `router.replace` dropping the parameter
  - [x] Methods, seller read, copy, tests and deploy config (AC-3, AC-15, AC-16, AC-17) — done: `CHOOSABLE_PAYMENT_METHODS` on both sides, the seller read carrying `paymentStatus` and `paymentMethod` with the label in the panel, 12 new keys in both catalogs, 46 gateway tests and 20 storefront ones, and `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` plus the Caddyfile webhook path

- [x] Verify it: `/check verify payment through a test provider` — 2026-11-13: the schema and configuration steps ran on the dev database (both tables, the `Payment_one_pending_per_order` partial index, `Order.paymentExpiresAt`, the four schema copies identical), and the live pass paid an order on the hosted Stripe test page and read it back `PAID` on the order screen. The callback itself was never exercised locally: `stripe listen` hung on `Getting ready` in this workspace, `PaymentEvent` stayed empty, and the payment was confirmed through `POST /orders/:orderId/payment/sync` instead. Still unrun in the spec's `verify.md`: the callback walk, the window expiry toast, the missing key toast, the refund line after a cancel, and the 360 px check
- [x] Test it: `/test payment through a test provider` — 2026-11-13: no separate pass was run (the owner closed the feature); the suites that landed with the build cover it: `apps/api-astrum` answers 153 tests over the `payment` and `order` modules (3 suites and 15 tests skipped, they need the live stack), `apps/customer` answers 118 tests over the order screen, the seller panel and the seller hooks, and `tsc --noEmit` is clean in both apps
- [ ] Review it (fresh model): `/check review payment through a test provider`
- [ ] Document it: `/document payment through a test provider`
  spec [0015](../../specs/_root/0015-payment-through-a-test-provider/index.md)
  code in `apps/api-astrum/src/modules/payment`, `apps/api-astrum/src/modules/order`, `apps/customer/src/features/pages/Orders/OrderPage`, `apps/customer/src/hooks/order`, `packages/Astrum-db/prisma/schema.prisma`, `Caddyfile`

### 16. Order letters · planned

The worker delivers one letter, the account confirmation, and the gateway publishes one event, so nothing tells a customer that an order was placed, paid or handed over.
**Done when:** a letter leaves for the customer when an order is placed and on each status change that concerns them, the gateway publishes one event per change on the existing `astrum.events` exchange after the commit, the worker consumes it through its own queue with the retry ladder and the dead letter queue that already carry the confirmation letter, the letter arrives in the language the customer chose, a republished event sends no twin letter, and letters written while the worker is down wait in the durable queue instead of disappearing.
- [ ] Design it (spec): `/architect order letters`

### 17. Confirm order lines when the order is paid · in-progress · GA

A paid order waits for a seller to confirm its lines, and a line whose shop has no owner account never gets confirmed, so the buyer reads `PENDING` after paying.
**Done when:** a cash order writes `CONFIRMED` lines and a `CONFIRMED` order at creation, a prepaid order confirms its lines in the same transaction as the paid event and the order follows, the seller keeps two moves only (`Выдать` and `Нет в наличии`), a cancelled paid line returns the stock and logs `payment.refund_owed`, and a courier order is handed over with no pickup point.
- [x] Design it (spec): `/architect confirm order lines when the order is paid`
- [x] Build it: `/develop confirm order lines when the order is paid`
  - [x] Confirm on write and on payment: `LINE_STATUS_BY_PAYMENT_METHOD`, `recomputeOrderStatus` in the create transaction, the paid apply confirming `PENDING` lines behind an order level guard, and the customer cancel refund warning (AC-1 to AC-4)
  - [x] Narrow the seller rules: the patch table, the handover as the only writer of `DELIVERED` for a confirmed line, the refund warning read under the lock, and the pickup precondition removed (AC-5 to AC-7)
  - [x] Seller panel and buyer screen: two moves only, the courier dialog string, `paid` passed down to the line, the refund note predicate, and both catalogs (AC-8 to AC-10)
  - [x] Tests and the gate: the four suites that assert the old rules rewritten, then `pnpm check-types` and `pnpm quality-gate` (AC-11)
- [x] Verify it: `/check verify confirm order lines when the order is paid` (2026-11-14: PASS on the live stack, all 12 AC met, the four payment log lines read from a second gateway replica; the hosted Stripe page was replaced by a signed provider event, the sync paid branch was not reachable, both recorded in the spec's verify.md)
- [ ] Test it: `/test confirm order lines when the order is paid`
- [ ] Review it (fresh model): `/check review confirm order lines when the order is paid`
- [ ] Document it: `/document confirm order lines when the order is paid`
  spec [0016](../../specs/_root/0016-confirm-lines-on-payment/index.md)
  code in `apps/api-astrum/src/modules/order/order.constants.ts`, `apps/api-astrum/src/modules/order/order.service.ts`, `apps/api-astrum/src/modules/order/seller-order.service.ts`, `apps/api-astrum/src/modules/payment/payment.apply.ts`, `apps/customer/src/features/pages/SellerOrders/`, `apps/customer/src/features/pages/Orders/OrderPage/`, `apps/customer/messages/`

## Fixed

Bugs found while verifying a slice, recorded here once the fix lands so the plan stays honest.

- **Previous account's data after an account switch** · fixed 2026-11-10 · from spec 0008 · `handleSignIn` and `handleRegister` (`apps/customer/src/hooks/auth/useAuth.ts`) and `useLogOut` (`apps/customer/src/hooks/useLogOut.ts`) drop the whole SWR store through `apps/customer/src/hooks/useSessionCacheReset.ts` before the next page renders, `router.refresh()` follows the cookie write on the sign in path, and three regression tests (`hooks/auth/useAuth.test.tsx`, `hooks/useLogOut.test.tsx`) fail without the fix · `docs/changelog/2026-11-10-session-cache-reset.md`
- **Skeleton instead of the profile and a missing confirmation banner after a session switch** · fixed 2026-11-10 · a follow-up of the row above · `apps/customer/src/hooks/useSessionCacheReset.ts` empties the store with `useSWRConfig().unload({ revalidate })` instead of a key-filtered `mutate`: that also deletes the SWR request markers and the payload `keepPreviousData` was holding, so a hook mounted inside the previous `dedupingInterval` fetches instead of deduping against the request of the account that left; sign in and register pass `revalidate: true`, log out keeps it off, and three regression tests in `hooks/useSessionCacheReset.test.tsx` fail without the fix · `docs/changelog/2026-11-10-session-cache-unload.md`
- **Order list reads every item to render a card** · fixed 2026-11-11 · `GET /api/orders` now returns `orderItemsCount` and the first item's `previewImage`; the storefront card consumes those summary fields, while `GET /api/orders/:orderId` still returns all items · the API order tests and `apps/customer/src/features/pages/Orders/OrderCard/index.test.tsx`

## Deferred

Kept so the plan stays honest, built only when the loop above runs.

- **Courier delivery**: a shipping address instead of a pickup point · needs a decision
- **Returns and refunds** · needs a decision · from spec 0015 (a paid order cancelled now owes a manual refund and logs `payment.refund_owed`)
- **Second currency** · needs a decision
- **Storefront checkout timeout above the server budget**: the client gives up at 10000 ms while the server transaction may still be committing · from spec 0003, a separate small change
- **Two order create hooks**: `useCreateOrder` is unused and sends no idempotency key · from spec 0003, cleanup
- **Log out everywhere**: a `user:<id>:sessions` index plus the button that uses it · from spec 0004 · needs a decision
- **Session renewal and a device list**: refresh on activity, plus the screen that lists sessions · from spec 0004 · needs a decision
- **A real Russian payment provider** behind the same adapter, if the shop ever sells for real; Stripe stays test only · from spec 0015 · needs a decision
- **Session alerts**: metrics and an alert on `session.store.error` and on a `/health` `503` · from spec 0004
- **Storefront guard reading the session**: stops a revoked customer from seeing page shells before the first API call · from spec 0004 · needs a decision
- **Cyrillic copy guard**: a check that refuses Cyrillic literals in `apps/customer/src`, so a hardcoded string cannot come back · from spec 0006
- **Shareable Russian links**: a `[locale]` segment in the address, once a Russian page needs to be linked or crawled · from spec 0006 · needs a decision
- **Seller list filter and order status**: a `status` query parameter and a `status` field in `GET /api/seller/orders`, extending spec 0002, AC-5 · from spec 0007
- **Seller notifications**: a mail or a badge when a new line arrives · from spec 0007 · needs a decision
- **Seller batch actions**: act on several lines at once · from spec 0007 · needs a decision
- **Excel seed creates its businesses**: `seedFromExcel.ts` writes a product `businessId` without the matching `Business` row, which the foreign key added by spec 0002 rejects · from spec 0007
- **Registration answers 500**: `POST /api/auth/register` fails through the gateway and through the auth service, and no user row is written, so no new account can be created · bug, found while verifying spec 0016
- **An unpaid order with no attempt row is never closed**: the sweep logs `payment.sweep.no_attempt` and returns, so the order stays `PENDING` past its deadline and its stock stays held (`cmwfh4ttc0004z4vdp1h17doq`, `cmwcq7jl5000zkvd0kgsp2zz`) · from spec 0015, found while verifying spec 0016
- **Handover date prints empty**: the seller panel renders `Выдан:` with no date for an order that is `DELIVERED` with `handedOverAt` null, which three rows in the demo database carry (`review-check-order-1`, `cmwcgbrns000fe8vdcupntf58`, `cmw25deon00003wvdd87kni5m`) · from spec 0013, found while verifying spec 0016
- **Delivery method management screen**: create a method, change its price, switch it off; an operator still edits rows by hand · from spec 0009 · needs a decision
- **Confirming a changed delivery price**: the create call stores the price in force at the commit without comparing it with what the customer saw; a `409 SHIPPING_PRICE_CHANGED` needs the request to carry the displayed price · from spec 0009 · needs a decision
- **Order total rule in AGENTS.md**: the `grandTotal = totalPrice + deliveryPrice` rule that no constraint enforces · from spec 0009
- **Cart currency**: the cart read carries none, so the checkout cannot offer only the methods that match the cart · from spec 0009
- **Dollar sign on the other surfaces**: product pages, the cart and the wishlist still print `$` over ruble amounts · from spec 0009
- **Delivery method names in Russian**: names are English database data shown in the Russian interface · from spec 0009 · needs a decision
- **Free delivery threshold**: the catalog claims free shipping over $100 with no rule behind it · from spec 0009 · needs a decision
- **Seller facing product management screen**: create, edit and publish products from the storefront; the gateway route and DTO exist · from spec 0008 · needs a decision
- **Shop name policy**: reserved names, impersonation and moderation before a name is public · from spec 0008 · needs a decision
- **Account gate on product creation**: `POST /api/products` runs behind `authenticateToken` only, with no account state gate · from spec 0008 · needs a decision
- **AGENTS.md schema claim**: `packages/Astrum-db/AGENTS.md` and `apps/worker/AGENTS.md` call the auth and worker schemas byte identical; they are trimmed subsets · from spec 0008
- **Shop ownership on account deletion**: `Business.ownerUserId` becomes null and the operator script can reassign the shop and its products · from spec 0008 · needs a decision
- **Seller workflow flag**: `SELLER_ORDER_WORKFLOW_ENABLED` used to gate `GET /api/seller/orders`, `PATCH /api/order-items/:orderItemId/status` and the handover route through a boot time middleware, defaulting to `false` in the root, api and prod templates · removed on 2026-11-13 on the owner's call: the middleware, its startup validation, the `503 SELLER_ORDER_WORKFLOW_DISABLED` code and the storefront `intake is not switched on` screen are gone, so the seller routes answer to any active account that owns a business, the way every other seller read already did · from spec 0008
- **Registration with a bare date**: `@IsDateString()` accepts `2000-01-01` while Prisma 7 refuses it with `premature end of input. Expected ISO-8601 DateTime`, so `POST /api/auth/register` answers `500` and writes no row; a full ISO datetime answers `200` and is what the storefront sends, so either the DTO transforms the date or validation asks for the stricter shape · bug, found while verifying spec 0009
- **Account gate on order cancellation**: `PATCH /api/orders/:orderId/status` runs behind `authenticateToken` only, so an account whose status returned to `PENDING` can still cancel its own older order; spec 0011 keeps that on purpose, and it needs a rule if the account confirmation work ever gates every write · from spec 0011
- **Dead catalog key for a list cancel**: `orders.cancelOrder` has no reader in either catalog, because the order list carries no cancel action (spec 0011, AC-1) · from spec 0011
- **Print button without a handler** on the order screen header; spec 0011 leaves it alone · from spec 0011
- **Duplicate cart add answers 500**: `POST /api/cart` with a product the cart already holds replies `{"message":"Internal Server Error"}` with status `500` instead of raising the quantity or refusing with a code; the storefront reaches the same product through `PATCH /api/cart/:productId`, so only a direct call sees it · bug, found while verifying spec 0011
- **Missing space in the Russian cart summary**: the page prints `ДоставкаРассчитывается при оформлении`, two keys joined without a space in `messages/ru.json` · bug, found while verifying spec 0009
- **Account deletion with a review**: `Review.userId` is `ON DELETE RESTRICT`, so `prisma.user.delete` fails for anyone who wrote a review and `deleteUser` answers the misleading "User not found"; the new like and comment rows cascade, this one blocks · from spec 0014 · bug, needs a decision
- **Counter repair for likes and comments**: nothing compares `Review.likeCount` and `Review.commentCount` with their child rows; `verify.md` of spec 0014 carries the manual query, and a job or a constraint needs its own decision · from spec 0014 · needs a decision
- **Purge of deleted comments**: a soft deleted `ReviewComment` keeps its row and its text forever · from spec 0014
- **Reviews sorted by likes**: needs an index on `Review(productId, likeCount)` and a decision on whether popularity outranks recency · from spec 0014 · needs a decision
- **Shop answers on a review**: `ReviewResponse` is unbuilt and unread, so the thread shows customer replies only · from spec 0014 · needs a decision
- **Review moderation**: every review publishes on write, so `ReviewStatus.PENDING` and `REJECTED` are dead values and nothing can take an abusive review down · from spec 0012 · needs a decision
- **Review count on the product card**: `ProductCard` prints `_count.impressions` as a review count and five stars whatever the rating is · from spec 0012
- **Unmaintained product rating columns**: `Product.stars`, `reviewCount` and `averageRating` have no writer and `ReviewsService.updateProductAggregates` has no caller · from spec 0012 · needs a decision
- **Raw review by id**: `GET /api/reviews/:reviewId` answers any customer's row including `userId` and reviews that are not approved · from spec 0012 · needs a decision
- **Review photo upload**: the project has no file storage, so `photos` stays a URL list nobody fills · from spec 0012 · needs a decision

- **Pickup point operator role**: an account flag for point staff, a collection screen keyed by order id, and a screen to manage points · from spec 0013 · needs a decision
- **Pickup code**: a short code the customer shows at the point, with a log line on every failed attempt · from spec 0013
- **Reaching the point and handing over**: a notification for each of the two moments, built on the events and the worker of spec 0005 · from spec 0013 · needs a decision
- **City, opening hours and a phone on a pickup point**: plus a filter in the checkout, once the shop runs more than one city · from spec 0013
- **Checkout date field shows the day before the picked one**: clicking `Friday, November 20th, 2026` in the calendar (which keeps that day selected) leaves `November 19, 2026` on the trigger, while the stored `deliveryDate` is the 20th and the order screen prints `Pickup Date: November 20, 2026`, so the field and the value disagree by one day · bug, found while verifying spec 0013

- **An abandoned online card order with no payment attempt is never closed**: the sweep reads `ONLINE_CARD` orders past their deadline, but `closeWithoutSession` returns after logging `payment.sweep.no_attempt` when the order has no `Payment` row, so an order abandoned before the first pay press keeps its stock forever; `cmwcq7jl5000vzkvd0kgsp2zz` has been `PENDING` with a deadline of 2026-11-11 23:36 since then · bug, found while verifying spec 0015

## Legend

- **Next step** = the first unticked box.
- **Status**: `planned` → `in-progress` → `done`, plus `existing` (built before this scope) and `dropped`.
- A row with `Design it (spec)` runs `/architect` first; the tag `needs a decision` is implied by that box.
- **Workflow tag** beside a heading (for example `· GA`) overrides the project default for that feature.
