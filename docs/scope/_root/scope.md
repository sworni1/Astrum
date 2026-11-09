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
| 3   | Shipping methods from the API         | Slice 1 | planned     |
| 4   | Order statuses with seller ownership  | Slice 2 | in-progress |
| 5   | Seller order panel                    | Slice 2 | in-progress |
| 6   | Customer cancel on the order screen   | Slice 2 | planned     |
| 7   | Pickup handover                       | Slice 3 | planned     |
| 8   | Reviews on the product screen         | Slice 4 | planned     |
| 9   | Order flow end to end test and CI     | Slice 4 | planned     |
| 10  | Session store in Redis                | Slice 5 | done        |
| 11  | Account confirmation by email         | Slice 6 | in-progress |
| 12  | English interface by default          | Slice 7 | in-progress |
| 13  | Seller onboarding                     | Slice 8 | done        |

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
- [ ] Test it: `/test idempotent checkout and cart clearing` (skipped: the owner marked the feature done on 2026-11-04)
- [ ] Review it (fresh model): `/check review idempotent checkout and cart clearing` (skipped: the owner marked the feature done on 2026-11-04)
- [ ] Document it: `/document idempotent checkout and cart clearing` (skipped: the owner marked the feature done on 2026-11-04)
  spec [0003](../../specs/_root/0003-idempotent-checkout-and-cart-clearing/index.md)

### 3. Shipping methods from the API · planned

The checkout form carries two hardcoded ids that exist in one demo database only.
**Done when:** the form lists the methods the API returns, the delivery price of the chosen method enters the total the server computes, and an unknown method id is refused.
- [ ] Build it: `/develop shipping methods from the API`

## Slice 2: statuses and the seller

### 4. Order statuses with seller ownership · in-progress · GA

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

### 5. Seller order panel · in-progress · GA

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

### 6. Customer cancel on the order screen · planned

The cancel button on the order screen calls a route that does not exist.
**Done when:** a customer cancels an order while it is `PENDING`, the screen shows the new status without a reload, the stock comes back, and the button is gone once the order is confirmed.
- [ ] Build it: `/develop customer cancel on the order screen`

## Slice 3: handover

### 7. Pickup handover · planned

Pickup is how this shop hands an order over, and nothing closes an order today.
**Done when:** a customer chooses a pickup point at checkout, the seller marks the order handed over at that point, the order becomes `DELIVERED`, and the order screen shows the pickup point and the handover date.
- [ ] Design it (spec): `/architect pickup handover`

## Slice 4: closing the loop

### 8. Reviews on the product screen · planned

The review API already refuses a review without a `DELIVERED` purchase, while the product screen still renders mock reviews.
**Done when:** the product screen shows the reviews and the rating summary from the API, a customer with a delivered line can write one review, and the form stays hidden for anyone who did not buy.
- [ ] Design it (spec): `/architect reviews on the product screen`

### 9. Order flow end to end test and CI · planned

Nothing proves the order path keeps working, and no pipeline runs the gates.
**Done when:** one end to end test walks register, add to cart, checkout and see the order against a real database, and CI runs types, lint, unit tests and that test on every pull request.
- [ ] Design it (spec): `/architect order flow end to end test and CI`

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
- [ ] Review it (fresh model): `/check review account confirmation by email`
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

Becoming a seller today means an engineer runs `pnpm db:assign-business <email>`: it hands over an unassigned `Business` that owns products, creates one when none is free, and sets `ownerUserId`. Nothing in the product offers this, a `Business` row carries nothing but an id and a creation date, and the seller panel answers only after that script runs and only while `SELLER_ORDER_WORKFLOW_ENABLED` is on.
**Done when:** a confirmed, signed in user becomes a seller from the storefront in one deliberate action, without anyone running a script or touching the database; the seller area and the seller endpoints answer for that account right away and after a reload, with `SELLER_ORDER_WORKFLOW_ENABLED` on; an unconfirmed account and a second attempt create nothing; and the account ends up owning exactly one shop of its own.
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

## Fixed

Bugs found while verifying a slice, recorded here once the fix lands so the plan stays honest.

- **Previous account's data after an account switch** · fixed 2026-11-10 · from spec 0008 · `handleSignIn` and `handleRegister` (`apps/customer/src/hooks/auth/useAuth.ts`) and `useLogOut` (`apps/customer/src/hooks/useLogOut.ts`) drop the whole SWR store through `apps/customer/src/hooks/useSessionCacheReset.ts` before the next page renders, `router.refresh()` follows the cookie write on the sign in path, and three regression tests (`hooks/auth/useAuth.test.tsx`, `hooks/useLogOut.test.tsx`) fail without the fix · `docs/changelog/2026-11-10-session-cache-reset.md`

## Deferred

Kept so the plan stays honest, built only when the loop above runs.

- **Online payment through a test provider**: pay before handover · needs a decision
- **Order emails**: confirmation and status changes · needs a decision
- **Courier delivery**: a shipping address instead of a pickup point · needs a decision
- **Returns and refunds** · needs a decision
- **Second currency** · needs a decision
- **Storefront checkout timeout above the server budget**: the client gives up at 10000 ms while the server transaction may still be committing · from spec 0003, a separate small change
- **Two order create hooks**: `useCreateOrder` is unused and sends no idempotency key · from spec 0003, cleanup
- **Log out everywhere**: a `user:<id>:sessions` index plus the button that uses it · from spec 0004 · needs a decision
- **Session renewal and a device list**: refresh on activity, plus the screen that lists sessions · from spec 0004 · needs a decision
- **Session alerts**: metrics and an alert on `session.store.error` and on a `/health` `503` · from spec 0004
- **Storefront guard reading the session**: stops a revoked customer from seeing page shells before the first API call · from spec 0004 · needs a decision
- **Cyrillic copy guard**: a check that refuses Cyrillic literals in `apps/customer/src`, so a hardcoded string cannot come back · from spec 0006
- **Shareable Russian links**: a `[locale]` segment in the address, once a Russian page needs to be linked or crawled · from spec 0006 · needs a decision
- **Seller list filter and order status**: a `status` query parameter and a `status` field in `GET /api/seller/orders`, extending spec 0002, AC-5 · from spec 0007
- **Seller notifications**: a mail or a badge when a new line arrives · from spec 0007 · needs a decision
- **Seller batch actions**: act on several lines at once · from spec 0007 · needs a decision
- **Excel seed creates its businesses**: `seedFromExcel.ts` writes a product `businessId` without the matching `Business` row, which the foreign key added by spec 0002 rejects · from spec 0007
- **Seller facing product management screen**: create, edit and publish products from the storefront; the gateway route and DTO exist · from spec 0008 · needs a decision
- **Shop name policy**: reserved names, impersonation and moderation before a name is public · from spec 0008 · needs a decision
- **Account gate on product creation**: `POST /api/products` runs behind `authenticateToken` only, with no account state gate · from spec 0008 · needs a decision
- **AGENTS.md schema claim**: `packages/Astrum-db/AGENTS.md` and `apps/worker/AGENTS.md` call the auth and worker schemas byte identical; they are trimmed subsets · from spec 0008
- **Shop ownership on account deletion**: `Business.ownerUserId` becomes null and the operator script can reassign the shop and its products · from spec 0008 · needs a decision
- **Seller workflow flag**: `SELLER_ORDER_WORKFLOW_ENABLED` gates `GET /api/seller/orders` and `PATCH /api/order-items/:orderItemId/status`, is read once at boot from `process.env` and defaults to `false` in the root, api and prod templates, so a fresh clone and a template deploy ship the seller panel dark while the storefront learns the state only from a `503`; either remove it together with the `disabled` screen and spec 0007 AC-11, or keep it as a kill switch with a `true` default, an owner, a review date and a state readout on `/api/users/me` or a config route · from spec 0008 · needs a decision

## Legend

- **Next step** = the first unticked box.
- **Status**: `planned` → `in-progress` → `done`, plus `existing` (built before this scope) and `dropped`.
- A row with `Design it (spec)` runs `/architect` first; the tag `needs a decision` is implied by that box.
- **Workflow tag** beside a heading (for example `· GA`) overrides the project default for that feature.
