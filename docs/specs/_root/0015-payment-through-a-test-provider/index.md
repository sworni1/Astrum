# 0015. Payment through a test provider

**Date**: 2026-11-12
**Status**: In Progress

## Summary

The checkout stores a payment method and a payment status and nothing charges anything, so an online card order sits unpaid until a human reads it. This decision puts a real test provider in front of the order: the customer presses a pay control on the order screen, pays on a hosted Stripe page in test mode, and comes back to an order that says paid. The server believes only a signed callback from the provider, checks the amount and the currency against the stored order, and treats a second delivery as nothing. Stock stays held for 32 minutes; an abandoned payment closes the order and puts the stock back, and a callback that arrives after a cancel is recorded as money owed back.

## Requirements

**User stories**:

- As a customer with an online card order, I want to pay it from the order screen, so that the order stops waiting for a payment I already made.
- As a customer, I want the order screen to tell me the truth about my payment, so that I never see "paid" for money that did not leave, or "pending" for money that did.
- As the shop, I want the provider callback to be the only proof of payment, so that a crafted request cannot mark an order paid.
- As the shop, I want an abandoned payment to give the stock back, so that inventory is not frozen by a page nobody returns to.
- As a seller, I want to see whether an order line is paid, so that I do not ship goods nobody paid for.

**Acceptance criteria** (the contract):

- **AC-1**: The gateway reads `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from the environment. Both appear in `.env.example` and `.env.prod.example` with placeholder values and a comment naming where each value comes from (the Stripe dashboard in test mode, and `stripe listen` in development). With either value absent the process still boots, logs exactly one `payment.provider.unconfigured` warning naming every missing variable (evaluated once at module load), the pay route answers `502 PAYMENT_PROVIDER_UNAVAILABLE`, the sync route does the same once it has to reach Stripe, and the webhook answers `503 PAYMENT_PROVIDER_UNAVAILABLE` and writes nothing. No publishable key is read anywhere, because the checkout page is hosted by Stripe.

- **AC-2**: `POST /api/orders` with `paymentMethod = ONLINE_CARD` takes one `now` in the create path and stores `paymentExpiresAt = now + PAYMENT_WINDOW_MINUTES` (one exported constant, `32`: Stripe's 30 minute floor plus a safety margin, because `createdAt` itself is a database default the application never holds) in the transaction that writes the order, keeps the existing stock decrement, and stores `paymentStatus = PENDING`. `CASH` and `CARD_ON_DELIVERY` orders store `paymentExpiresAt = null`. `paymentDetails` is no longer read from the body: the DTO stops requiring it, `canonicalOrderBody` drops it from the fingerprint in the same change, the zod schema and the checkout form drop the field, and the column stays nullable for existing rows. The order detail read answers `paymentExpiresAt`, the list read answers it too through the same spread, and neither carries a provider session id, a provider payment id, a checkout URL, or any Payment row.

- **AC-3**: The gateway accepts `ONLINE_CARD`, `CASH` and `CARD_ON_DELIVERY` on create through one exported `CHOOSABLE_PAYMENT_METHODS` array, enforced by `@IsIn` in `CreateOrderDto` and by `z.enum(CHOOSABLE_PAYMENT_METHODS)` in the checkout schema, and answers `422 VALIDATION` with `errors` naming `paymentMethod` for `PAYPAL` and `STRIPE`. The enum members and the existing rows stay untouched, and the order screen keeps printing their labels. The checkout select offers the three accepted methods only; `PAYPAL` and `STRIPE` stop being selectable, and no catalog key is deleted, because old orders still print those labels.

- **AC-4**: `POST /api/orders/:orderId/payment` sits behind `authenticateToken` and `requireActiveAccount`. It answers the caller's own order only; a missing or foreign order answers `404 ORDER_NOT_FOUND`. It refuses with `409 ORDER_NOT_PAYABLE` when `paymentMethod` is not `ONLINE_CARD`, with `409 PAYMENT_ALREADY_PAID` when `paymentStatus` is `PAID`, and with `409 PAYMENT_WINDOW_EXPIRED` when the stored window has already passed, applying the close of AC-8 in that same request before answering. When the order already has an attempt with a `checkoutUrl` and a future `expiresAt`, it answers `200 { url, expiresAt }` with the stored values and sends no Stripe request. Otherwise it makes sure exactly one attempt row exists in status `PENDING` for the order (a second concurrent request is stopped by the partial unique index; the loser joins that same row and calls Stripe with the same `Idempotency-Key`, so Stripe replays one session and both requests converge on one URL, and only an already stored `checkoutUrl` takes the 200 branch above), sets `paymentExpiresAt = now + PAYMENT_WINDOW_MINUTES` and the attempt's `expiresAt` to the same instant in one transaction, snapshots `amount = order.grandTotal` and `currency = order.currency` on the attempt, and then calls Stripe outside that transaction with `Idempotency-Key` set to the attempt's id. A Stripe failure leaves the attempt `PENDING` with `checkoutUrl = null` and answers `502 PAYMENT_PROVIDER_UNAVAILABLE`; the next press re uses the same attempt and the same key. One refusal is the exception: when Stripe rejects the create because that `Idempotency-Key` was first used with a different payload (a field added to the create call after the attempt was written), the attempt is retired to `CANCELLED` in that same request, one `payment.attempt.retired` warning names the order and the attempt, a fresh attempt row takes its place and the create is retried once under the new key, so a payload change cannot freeze an order behind a spent key; a second refusal answers `502`. Success stores `providerSessionId` and `checkoutUrl` and answers `201 { url, expiresAt }`, including for the loser that had to wait on the winner. A repeated press after success takes the reuse branch above, so it sends no second Stripe request.

- **AC-5**: `POST /api/payments/stripe/webhook` is mounted on the app before `express.json` and outside `authenticateToken`, parses the body with `express.raw({ type: "application/json", limit: "1mb" })`, and verifies `Stripe-Signature` with `stripe.webhooks.constructEvent` and `STRIPE_WEBHOOK_SECRET`. A missing or invalid signature answers `400 PAYMENT_INVALID_SIGNATURE` and writes nothing. A verified event is inserted into `PaymentEvent` before it is applied, the unique key `(provider, eventId)` decides the race, and a unique violation answers `200` with no further write, so two concurrent deliveries cannot both apply. The handler acts on `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed` and `checkout.session.async_payment_failed`; every other type answers `200` and writes nothing. For a session event it finds the attempt by `providerSessionId`, then by `metadata.order_id`; for a `payment_intent.payment_failed` event it finds the attempt by `providerPaymentIntentId`, then by `metadata.order_id`. When a session id matches no attempt but the order id does, it adopts the order's `PENDING` attempt that has no `providerSessionId`, writes that session id onto it, and applies the event, so the next delivery takes the index branch; when no attempt can be adopted the event is stored with `applied: false`, one `payment.webhook.unmatched` line is logged, and the answer is `200`. Before any state change it compares `session.amount_total` (or, for a PaymentIntent event, `data.object.amount`) with the order's `grandTotal` in minor units and the event object's `currency` with the order's currency, both lowercased; a mismatch stores the event with `applied: false`, logs `payment.webhook.amount_mismatch`, changes nothing and answers `200`. The event row stores a trimmed summary only (type, event id, session id, amount, currency, session status, payment status) and never the customer name or email.

- **AC-6**: `checkout.session.completed` with `payment_status = paid` moves the attempt to `PAID` and the order's `paymentStatus` to `PAID` in one transaction, sets `paidAt`, stores `providerPaymentIntentId` from `session.payment_intent` when it is present, marks the event `applied: true`, and writes only when the attempt is not already `PAID`. It never touches `Order.status` and never touches stock, because stock left the shelf when the order was created. A second delivery, whether the same event id or a different one, changes nothing and answers `200`. The decimal to minor unit conversion lives in one exported helper, `toMinorUnits` (`Math.round(Number(value) * 100)`), used by session creation and by the comparison, so the two cannot disagree.

- **AC-7**: `payment_intent.payment_failed` writes `lastErrorCode` from `last_payment_error.decline_code` with `last_payment_error.code` as the fallback (and one fixed `unknown` code when both are absent) and `lastErrorMessage` from `last_payment_error.message` trimmed to 255 characters on the attempt, keeps the attempt `PENDING` because the hosted session is still usable, and sets the order's `paymentStatus` to `FAILED` when it was `PENDING`; the stored `checkoutUrl` stays reusable, so a retry on the Stripe page or a new press succeeds on the same session. `checkout.session.async_payment_failed` moves the attempt to `FAILED` and the order's `paymentStatus` to `FAILED`, and returns no stock. In both cases a later paid event moves the order to `PAID` through AC-6, and stock is untouched.

- **AC-8**: `checkout.session.expired` moves the attempt to `EXPIRED` and sets the order's `paymentStatus` to `CANCELLED`. When the order `status` is `PENDING` (no seller action yet) it also runs the existing close logic in the same transaction. That logic is the customer cancellation extracted into one helper that accepts an open transaction (`closeOrder(tx, order)`), taken after the owner check and keeping `lockOrder` inside so the expiry caller passes the loaded order, reused by the expiry handler, the sweep and the cancel route: lines in `PENDING` or `CONFIRMED` become `CANCELLED`, stock returns through the existing helper exactly once, and the order `status` becomes `CANCELED`. Any other order `status` (`CONFIRMED`, `SHIPPED` or `DELIVERED`) takes the seller branch: the attempt still becomes `EXPIRED` and the payment status still becomes `CANCELLED`, the order and its stock stay as they are, and one `payment.expired_after_seller_action` warning is logged. A repeat changes nothing.

- **AC-9**: The gateway runs a reconciliation pass every 60 seconds, started in `server.ts` and never in `app.ts`, wrapped in `pg_try_advisory_xact_lock` inside one `prisma.$transaction` so one replica works at a time and a tick is skipped while another holds the lock (a session level advisory lock would outlive its pooled connection). The lock key is one exported `PAYMENT_SWEEP_LOCK_KEY` constant. Each pass selects at most 20 orders with `paymentMethod = ONLINE_CARD`, `paymentStatus IN (PENDING, FAILED)`, `paymentExpiresAt < now()` and `status IN (PENDING, CONFIRMED)`, ordered by `paymentExpiresAt asc`, and for each retrieves the attempt's Stripe session. A `PENDING` order takes the closing branch of AC-8 below and logs `payment.sweep.closed`; a `CONFIRMED` order takes the AC-8 seller branch (attempt `EXPIRED`, payment `CANCELLED`, no stock move, one warning) and is never cancelled. The retrieval decides on its own: `paid` applies AC-6, `expired` applies AC-8, `open` past the deadline expires the session then applies AC-8, a Stripe error logs `payment.sweep.failed` and leaves the order for the next tick, and an attempt with no `providerSessionId` applies AC-8 directly. Every close is a conditional update that writes only while `paymentStatus` is still `PENDING` or `FAILED`, so a payment landing between the select and the update wins, and stock is returned only when that update changed the order.

- **AC-10**: `POST /api/orders/:orderId/payment/sync` sits behind `authenticateToken`, answers the caller's own order only (`404 ORDER_NOT_FOUND` otherwise), refuses `409 ORDER_NOT_PAYABLE` for a method other than `ONLINE_CARD`, makes no Stripe call when the order has no attempt, or when its newest attempt (by `createdAt desc` among `PENDING` and `FAILED`) has no `providerSessionId`; both answer `200` with the current status, so an unconfigured gateway does not turn a harmless read into a `502`. Otherwise it retrieves that attempt's session and applies AC-6, AC-7 or AC-8 through the same apply function the webhook uses. It answers `200 { paymentStatus, status, paymentExpiresAt }`, changes nothing on a paid order, and answers `502 PAYMENT_PROVIDER_UNAVAILABLE` when Stripe cannot be reached.

- **AC-11**: The existing customer cancellation answers as today and, when the order has an attempt in `PENDING` or `FAILED` with a `providerSessionId`, resolves it before the cancellation transaction opens and asks Stripe to expire that session at that point (a failure is logged as `payment.cancel.expire_failed` and does not block; the network call never runs inside the transaction that holds the order lock), then closes the attempt (`PENDING` or `FAILED` to `CANCELLED`) and sets the order's `paymentStatus` to `CANCELLED` when it was `PENDING` or `FAILED`. A `PAID` order keeps `PAID` and a `REFUNDED` order keeps `REFUNDED`. The stock return and the `CANCELED` transition are unchanged, and a second cancel still writes nothing.

- **AC-12**: A paid event that arrives after the attempt was `CANCELLED` or `EXPIRED` moves the attempt to `PAID` and the order's `paymentStatus` to `PAID`, leaves the order `status` `CANCELED` and stock as returned, and logs one `payment.refund_owed` warning naming the order id. A repeat changes nothing. Money that arrived is never dropped from the record, and the refund itself is out of scope.

- **AC-13**: The order screen renders the pay control only when `paymentMethod = ONLINE_CARD`, `order.status` is not `CANCELED`, `paymentStatus` is `PENDING` or `FAILED`, and `paymentExpiresAt` is in the future. The deadline prints through `useFormatter` as `orders.payment.payBefore`, the catalog string `Pay before {time}` filled with `format.dateTime(date, { timeStyle: "short" })`. The control is a `Button` disabled while its request runs, with `orders.payment.paying` on the trigger, and the handler returns early while in flight so a second press sends nothing. On `201` or `200` the browser navigates to the answered `url`. On `409 PAYMENT_WINDOW_EXPIRED` the hook revalidates the order and the toast is keyed on the response `code`, read through `apiRefusal` (`@/common/helpers/apiRefusal`, which reads a code on any status; the global `useFetcher` interceptor reads codes on `401` and `403` only, so it cannot carry these branches) and mapped by `OrderPage/lib/paymentRefusal.ts`, which covers every code the route can answer (`ORDER_NOT_FOUND`, `ORDER_NOT_PAYABLE`, `PAYMENT_ALREADY_PAID`, `PAYMENT_WINDOW_EXPIRED`, `PAYMENT_PROVIDER_UNAVAILABLE`) and a request that got no answer, split the way `lib/cancelRefusal.ts` already splits an answered refusal from an unanswered one. On `502` the toast is `orders.payment.providerUnavailable` and the screen stays usable. When the deadline has passed but the sweep has not closed the order yet, the control is not rendered and the screen prints `orders.payment.windowExpired` instead. An order whose `status` is `CANCELED` and whose `paymentStatus` is `PAID` prints `orders.payment.refundOwed` beside the payment row, so the customer reads why money is coming back. The client clock rule is a hint: the server refusal is the authority and is always surfaced.

- **AC-14**: `success_url` is `${STOREFRONT_URL}/orders/{orderId}?payment=return` and `cancel_url` is `${STOREFRONT_URL}/orders/{orderId}?payment=cancelled`. With `payment=return` the page calls the sync route once on mount (a ref guard, so a re-render or a strict mode double mount sends no second request), renders `orders.payment.checking` while it runs, then renders the order: `PAID` shows the paid state, `PENDING` or `FAILED` shows `orders.payment.notConfirmed` with the pay control still offered. A sync failure raises no blocking error, falls back to the order as read, and still offers the pay control. With `payment=cancelled` the page raises no toast and shows `orders.payment.cancelled`; the order stays payable. After either branch the query parameter is dropped with `router.replace`, so a refresh does not repeat the call.

- **AC-15**: Every new string exists in `apps/customer/messages/en.json` and `apps/customer/messages/ru.json` under `orders.payment` with the same key set: `pay`, `paying`, `payBefore`, `windowExpired`, `checking`, `notConfirmed`, `cancelled`, `providerUnavailable`, `refundOwed`, `notPayable`, `alreadyPaid`, `failed` (the last one also answers a request that got no reply, as the cancel screen does). The code to copy map is `OrderPage/lib/paymentRefusal.ts`, a pure table with a test covering every branch, so no component branches on a server message. No localized string comes from the server, which answers codes only. The payment status table still prints every `PaymentStatus` member through `PAYMENT_STATUS_KEYS`, and the attempt enum is never printed: an `EXPIRED` attempt shows on the order as the order's `CANCELLED`.

- **AC-16**: The seller orders read answers `paymentStatus` and `paymentMethod` per order group, because a payment status alone cannot tell an online order from cash. The explicit `select` in `findSellerOrders`, the `SellerOrderGroupRow` type and `toSellerOrderGroupJson` each gain both fields, and the seller panel prints them beside an `ONLINE_CARD` order that is not `PAID`. Nothing else in the seller flow changes and no seller transition reads payment.

- **AC-17**: `pnpm --filter @astrum/api test` and `pnpm --filter @astrum/customer test` lock the behaviour, and each scenario fails without its change: an invalid signature answers `400` and writes no row; an amount that differs from the stored `grandTotal` applies nothing; the same event id twice applies once; a paid event on an already paid attempt changes nothing; a decline then a paid event ends `PAID`; an expired session returns stock exactly once and a second delivery returns none; the sweep applies a paid session the webhook missed; the sweep leaves a `CONFIRMED` order alone; the pay route answers the stored URL on a repeat and sends one Stripe request; a foreign order answers `404`; a provider error answers `502` and leaves the attempt reusable; cancel expires the session and closes the attempt; a paid event after a cancel marks `PAID` and logs `refund_owed`; the seller read carries `paymentStatus`; the customer suite covers the pay control's states, the single sync call on return, and the refusal copy. `pnpm check-types` and `pnpm quality-gate` pass.

## Decision

**Chosen option**: Option 1: Stripe Checkout in test mode, one table of payment attempts, a webhook event log, and a reconciliation pass every minute.

Add a `Payment` table (one row per attempt), a `PaymentEvent` table (a trimmed record of each delivery), `paymentExpiresAt` on `Order`, and a `payment` module in the gateway. The customer pays on a Stripe hosted page, the gateway believes only a signed callback, and a one minute pass repairs anything a lost callback would leave behind.

**Implementation skills**: none installed that shape this decision. `apps/customer/AGENTS.md` (its `## Coding standard`, S1 to S5) and `apps/customer/CODE_REVIEW.md` govern the storefront part and are followed.

## Rationale

Reasoning, options and the measured state before the decision: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

| Entity | Field | Use in this decision |
|---|---|---|
| `Payment` (new) | `id`, `orderId`, `provider`, `providerSessionId` (unique, nullable), `providerPaymentIntentId` (nullable), `amount` `Decimal(10,2)`, `currency`, `status`, `checkoutUrl` (text, nullable), `expiresAt`, `paidAt` (nullable), `lastErrorCode` (nullable), `lastErrorMessage` (`varchar(255)`, nullable), `createdAt`, `updatedAt` | One row per payment attempt. `id` doubles as the Stripe idempotency key, so a retried create cannot make a second session. `providerSessionId` is unique and nullable: it is written after the Stripe call, and Postgres treats nulls as distinct. `amount` and `currency` snapshot the order at attempt creation. `@@index([orderId, createdAt])` serves the order screen and the sweep. |
| `PaymentEvent` (new) | `id`, `provider`, `eventId`, `type`, `paymentId` (nullable, SetNull), `orderId` (nullable), `sessionId` (nullable), `amountTotal` (int, nullable, minor units), `currency` (nullable), `sessionStatus` (nullable), `paymentStatus` (nullable), `applied` (bool), `receivedAt` | A trimmed record of each delivery. `@@unique([provider, eventId])` is the replay guard. No customer name and no email, so the log stays free of personal data. |
| `Order` (changed) | `paymentExpiresAt DateTime?`, back relation `payments Payment[]` | The stored deadline of the current window. Written at order creation and reset when a session is created; read by the pay route, the sweep and the order screen. |
| `PaymentProvider` (new enum) | `STRIPE` | Names the provider in the two new tables. |
| `PaymentAttemptStatus` (new enum) | `PENDING`, `PAID`, `FAILED`, `CANCELLED`, `EXPIRED` | The attempt lifecycle. `EXPIRED` (window closed) stays distinct from `CANCELLED` (the customer cancelled), which the order level status cannot express. |

**Provider session parameters** (the values the Stripe call carries, so no builder invents one):

- `mode`: `payment`
- `line_items`: one entry, `quantity: 1`, `price_data.currency` = `order.currency.toLowerCase()`, `price_data.unit_amount` = `toMinorUnits(order.grandTotal)`, `price_data.product_data.name` = `Astrum order <order.id>`
- `success_url`, `cancel_url`: from `STOREFRONT_URL` as AC-14 states
- `client_reference_id`, `metadata.order_id` and `payment_intent_data.metadata.order_id`: all `order.id`, so a PaymentIntent event carries the order id too
- `expires_at`: `Order.paymentExpiresAt` in epoch seconds, which is 32 minutes ahead because the same transaction just set it, comfortably above the Stripe floor of 30 minutes
- no `customer_email`, because the gateway reads no user record and Stripe asks on its own page

A raw partial unique index lands in the migration SQL, because Prisma cannot express it: `CREATE UNIQUE INDEX "Payment_one_pending_per_order" ON "Payment" ("orderId") WHERE "status" = 'PENDING';` with a comment in `schema.prisma` saying where it lives. The schema edit lands in `packages/Astrum-db/prisma/schema.prisma` and in the three app copies, byte identical, then `pnpm db:generate`.

**State transitions**:

Order `paymentStatus`:

| From | To | Trigger |
|---|---|---|
| (new) | `PENDING` | order creation |
| `PENDING` | `PAID` | paid event (AC-6) |
| `PENDING` | `FAILED` | card decline or async failure (AC-7) |
| `PENDING`, `FAILED` | `CANCELLED` | expired session or sweep close (AC-8) or customer cancel (AC-11) |
| `FAILED` | `PAID` | paid event (AC-6) |
| `CANCELLED` | `PAID` | paid event after cancel (AC-12), refund owed |
| `PAID` | `REFUNDED` | manual only, out of scope |

Payment attempt `status`:

| From | To | Trigger |
|---|---|---|
| (new) | `PENDING` | pay route |
| `PENDING` | `PAID` | paid event or sync (AC-6, AC-10) |
| `PENDING` | `FAILED` | `checkout.session.async_payment_failed` (AC-7) |
| `PENDING`, `FAILED` | `EXPIRED` | expired event or sweep (AC-8, AC-9) |
| `PENDING`, `FAILED` | `CANCELLED` | customer cancel (AC-11) |
| `CANCELLED` | `PAID` | paid event after cancel (AC-12) |
| `EXPIRED` | `PAID` | paid event after the sweep closed the order (AC-12) |

`Order.status` is never changed by a payment event. Only the expiry close sets it to `CANCELED`, and only while it is `PENDING`.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/orders/:orderId/payment` | POST | none (the order id is in the path) | `{ url, expiresAt }` | session cookie, active account | `404 ORDER_NOT_FOUND`, `409 ORDER_NOT_PAYABLE`, `409 PAYMENT_ALREADY_PAID`, `409 PAYMENT_WINDOW_EXPIRED`, `502 PAYMENT_PROVIDER_UNAVAILABLE` |
| `/api/orders/:orderId/payment/sync` | POST | none | `{ paymentStatus, status, paymentExpiresAt }` | session cookie | `404 ORDER_NOT_FOUND`, `409 ORDER_NOT_PAYABLE`, `502 PAYMENT_PROVIDER_UNAVAILABLE` |
| `/api/payments/stripe/webhook` | POST | raw body, `Stripe-Signature` | `{ received: true }` | public, signature verified | `400 PAYMENT_INVALID_SIGNATURE`, `503 PAYMENT_PROVIDER_UNAVAILABLE` |
| `/api/orders/:orderId` | GET | existing | adds `paymentExpiresAt`, drops every provider id | session cookie, owner | unchanged |
| `/api/seller/orders` (seller read) | GET | existing | adds `paymentStatus` per group | session cookie, seller, workflow flag | unchanged |

Both payment routes live in the order module router, so they inherit the existing `/api/orders` mount and its `authenticateToken`. The codes above are one exported `PAYMENT_ERROR_CODES` object in `apps/api-astrum/src/modules/payment/payment.constants.ts`, and every refusal is an `AppError` so `handleErrors` answers the coded shape. The webhook gets its own router, mounted before `express.json` and outside the authenticated mounts, because a parsed body cannot be signature checked.

**Value sourcing**:

| Action / screen | Value produced or displayed | Source |
|---|---|---|
| Session creation | amount charged | `order.grandTotal` (DB column) through `toMinorUnits` |
| Session creation | currency | `order.currency` (DB column), lowercased for Stripe |
| Session creation | order reference | `order.id` in `metadata.order_id` and in `client_reference_id` |
| Session creation | return URLs | `STOREFRONT_URL` (existing env var) plus `/orders/<id>` and the query parameter |
| Session creation | deadline | `PAYMENT_WINDOW_MINUTES` constant plus `now()`, stored in `Order.paymentExpiresAt` |
| Payment row | provider session id, checkout URL | the Stripe create response |
| Webhook | authenticity | `STRIPE_WEBHOOK_SECRET` (env var) and the `Stripe-Signature` header |
| Webhook | replay guard | `event.id` into `PaymentEvent (provider, eventId)` |
| Webhook | amount check | `session.amount_total` against `toMinorUnits(order.grandTotal)` |
| Order screen | deadline text | `Order.paymentExpiresAt` through `useFormatter` |
| Order screen | pay control visibility | `paymentMethod`, `paymentStatus`, `Order.status`, `paymentExpiresAt` from the order read |
| Seller panel | payment label | `paymentStatus` in the seller read |
| Refusal toasts | code to copy | the response `code` mapped in `apps/customer/src/hooks/order/`, never the server message |

**Key invariants**:

1. At most one attempt in `PENDING` per order (the partial unique index), and at most one attempt with a usable session per order (the pay route reuses a stored URL before it creates anything).
2. An attempt becomes `PAID` only through the apply function, which is reached only from a signature verified event or from a Stripe retrieve, and only after the amount and the currency match the stored order.
3. `Order.paymentStatus` has these writers and no others: order creation (`PENDING`), paid apply (`PAID`), decline or async failure (`FAILED`), expiry close (`CANCELLED`), customer cancel (`CANCELLED`), late paid apply (`PAID`).
4. Stock returns exactly once per order, through the existing cancellation helper, and only inside the conditional close that actually changed the order.
5. Money crosses to Stripe only as minor units produced by `toMinorUnits` from the stored `grandTotal`; no other conversion exists.
6. The event log never stores a customer name or email.
7. No provider secret reaches the browser, a log line or a response body.

**Security model**:

- The webhook is the only public route in the feature. Authenticity is the signature; replay protection is the unique event id; the body is capped at 1 MB and the signature is checked before any database write.
- Pay and sync are owner only. A missing or foreign order answers `404`, never `403`, so the route reveals nothing about other customers' orders.
- `requireActiveAccount` sits on the pay route (a write). Sync carries no account gate: an account that changed its email can be unconfirmed after ordering, and blocking the sync would leave a paid order showing unpaid.
- No card data reaches the server. The card form lives on the Stripe hosted page, so the project stays outside card data handling (PCI scope stays at the self assessment level that a hosted page allows).
- Secrets come from the environment only. `.env.example` carries placeholders, never a real key.
- Logs are structured JSON lines with the event name, the order id and the session id. No checkout URL, no raw body, no email.

**Configuration required**:

- `STRIPE_SECRET_KEY`: the test mode secret key (`sk_test_...`), the only credential the gateway sends to Stripe.
- `STRIPE_WEBHOOK_SECRET`: the signing secret (`whsec_...`), from `stripe listen` in development and from the dashboard endpoint in production.
- `DOMAIN`: read by `docker-compose.prod.yml` and the `Caddyfile` today, with no line in either env template, so it is added to both; the production webhook URL is `https://$DOMAIN/api/payments/stripe/webhook`, reachable only after the Caddyfile change in the build plan.
- `STOREFRONT_URL`: already exists and is reused for the return URLs.

In development the webhook reaches the gateway through the Stripe CLI: `stripe listen --forward-to http://localhost:3580/api/payments/stripe/webhook`, which prints the `whsec_...` value for `STRIPE_WEBHOOK_SECRET`. In production the `Caddyfile` main site gains a path matcher for `/api/payments/stripe/webhook` that reverse proxies to the api replicas with the same dynamic discovery block the `:3580` site already uses, and the storefront keeps the fallback handler.

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: an `ONLINE_CARD` order is created, paid on the hosted page, and the order reads `PAID` after the callback, with stock taken exactly once, verifies **AC-4**, **AC-5**, **AC-6**.
- Failure case: an amount that differs from the stored `grandTotal` and a repeated event id both leave the order unpaid exactly once, verifies **AC-5**, **AC-6**.
- Failure case: an abandoned session returns stock exactly once and closes the order; a `CONFIRMED` order survives the expiry, verifies **AC-8**, **AC-9**.
- Failure case: a paid callback after a cancel marks `PAID` and logs `refund_owed` instead of dropping the money, verifies **AC-12**.
- Auth/permission: a foreign order answers `404` on pay and on sync, and a forged signature answers `400` with no write, verifies **AC-4**, **AC-5**, **AC-10**.
- Screen: the pay control appears only for a payable online order, the return from Stripe syncs once, and every refusal reaches the customer as a coded message, verifies **AC-13**, **AC-14**, **AC-15**.

## Build plan

The project builds in Tracer Bullet slices: a thin end to end payment thread first, then the failure paths, then the repair machinery, then the walls. Each slice leaves the stack runnable.

1. **Thin thread: schema, adapter, pay route, paid callback, pay control.** Satisfies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-6**, **AC-13**.
   - Migration: `Payment`, `PaymentEvent`, the two enums, `Order.paymentExpiresAt`, the partial unique index, and the `createdAt + 32 minutes` backfill for existing `ONLINE_CARD` orders that are still `PENDING` (they will be closed by the first sweep and their stock returned). Copy the schema to the three app copies and run `pnpm db:generate`.
   - `stripe` dependency, a `StripeGateway` adapter (`createSession`, `retrieveSession`, `expireSession`, `constructEvent`) so tests fake the provider, `PAYMENT_WINDOW_MINUTES`, `toMinorUnits`, and the unconfigured branch.
   - Order creation writes `paymentExpiresAt` from one `now`, the DTO stops requiring `paymentDetails` (and `canonicalOrderBody` drops it), and `CHOOSABLE_PAYMENT_METHODS` narrows both the DTO and the checkout schema.
   - Pay route with the attempt row, the idempotency key, the deadline reset, the reuse branch, and the coded refusals.
   - Webhook router mounted before `express.json`, raw body, signature, event log, `checkout.session.completed` only.
   - Storefront: `paymentExpiresAt` on the order type, the pay hook, the pay control with its deadline and busy label, the redirect.

2. **Failure paths of the callback.** Satisfies **AC-5**, **AC-7**, **AC-12**.
   - Amount and currency checks, the unmatched session branch and its adoption rule, the unknown event type answer.
   - Insert the event before applying it and treat the unique violation as the replay answer; adoption writes the session id onto the attempt.
   - The `payment_intent.payment_failed` lookup by `providerPaymentIntentId`, and the write of that id from `session.payment_intent` on completed and async failed.
   - `payment_intent.payment_failed` (attempt stays `PENDING`, order `FAILED`, error saved) and `checkout.session.async_payment_failed` (attempt `FAILED`).
   - The paid after cancel branch with `payment.refund_owed`.

3. **Expiry, sweep and cancel.** Satisfies **AC-8**, **AC-9**, **AC-11**.
   - `checkout.session.expired` with the conditional close and the seller action guard.
   - The reconciliation pass behind `pg_try_advisory_xact_lock` inside one transaction, ordered by the deadline, logging `payment.sweep.closed`, started in `server.ts`.
   - Cancel: expire the session before the transaction opens, then widen the payment status condition to `PENDING` or `FAILED`.

4. **Sync and the return screen.** Satisfies **AC-10**, **AC-14**.
   - Sync route through the shared apply function.
   - Return handling on the order page: one call on mount, the checking state, the three outcomes, the query parameter drop.

5. **Walls: methods, seller read, copy.** Satisfies **AC-3**, **AC-15**, **AC-16**.
   - Checkout select to three methods and the removed `paymentDetails` field, with the zod schema.
   - Seller read: `paymentStatus` and `paymentMethod` in the select, the row type and the mapper, and the panel label.
   - Both catalogs and the coded refusal map (`OrderPage/lib/paymentRefusal.ts`, reading codes through `apiRefusal`, never through the `useFetcher` interceptor).
   - The order type gains `paymentExpiresAt: string | null` and the seller group type gains `paymentStatus`, so every hand written fixture that builds those objects gains the field: `common/zodSchemes/checkout.scheme.test.ts`, `Orders/OrderCard/index.test.tsx`, `Orders/OrderPage/index.test.tsx`, `OrderPage/components/CancelOrderDialog/index.test.tsx`, `OrderPage/components/OrderPageHeader/index.test.tsx`, `SellerOrders/index.test.tsx` and `SellerOrders/SellerOrderGroup/index.test.tsx`.

6. **Tests, gate and deploy config.** Satisfies **AC-17**, **AC-1**.
   - Gateway suites: signature, amount mismatch, replay, decline then paid, expiry stock once, sweep paid and sweep skip, foreign order, provider error, cancel, paid after cancel, seller read.
   - Storefront suites: pay control states, single sync on return, refusal copy, catalog parity.
   - `pnpm check-types`, `pnpm quality-gate`.
   - `.env.example`, `.env.prod.example`, and the Caddyfile public route for the webhook path (a path matcher on the main site, proxied to the api replicas, with the storefront as the fallback handler).

## Consequences

**Positive**:

- An online card order can be paid end to end, and the paid state is proved by a signed callback rather than by a browser returning.
- The stock a pending payment holds comes back on its own, so an abandoned checkout no longer freezes inventory.
- Every delivery is recorded in a trimmed event log, so a dispute can be answered from the database.
- The provider sits behind one adapter, so a real provider for the Russian market can replace it without touching the order rules.

**Negative / tradeoffs**:

- Stock is held for up to 32 minutes for an order nobody pays. With the current catalogue this is acceptable; a high volume shop would need a shorter hold or a per product reservation table.
- A `CONFIRMED` order whose payment expires stays open and unpaid, because the seller already accepted it. It is logged and visible in the seller panel, not repaired.
- A payment that lands after a cancel is recorded as paid and refunded by hand. No refund route exists in this feature.
- Dropping `paymentDetails` from the DTO also changes the idempotency fingerprint, so a checkout retried with a key minted before this deploy answers `IDEMPOTENCY_KEY_REUSED`. The window is one checkout attempt, so the loss is a retry of an in flight order placed across the deploy.
- Stripe cannot serve a Russian merchant, so this works as a test integration only. A real launch needs another provider behind the adapter.
- The webhook widens the public surface: one unauthenticated route is added, and its only brake is the 1 MB body cap and the proxy tier. Application level rate limiting is a follow-up.
- `Order.paymentStatus` is now a mirror of the latest attempt, and six writers are named in the invariants. A neglected writer shows a stale label rather than a wrong order, but it is still a second source.

**Neutral**:

- The migration backfills a deadline on existing unpaid `ONLINE_CARD` orders, so the first sweep closes them and returns their stock. That is a data change to one demo order in the current database.
- The storefront drops the `paymentDetails` field from the checkout form. The column stays for old rows.
- A card decline keeps the attempt `PENDING`, because the hosted session is still usable. The decline is recorded on `lastErrorCode` and in `PaymentEvent`, not as a separate attempt.
- The gateway gains its first scheduled job. It runs inside the api process and takes a database lock, so the compose replicas do not fight.

## Follow-up

- [ ] Refunds: add a refund route and set `REFUNDED` from it. Today the refund is manual and the `payment.refund_owed` log line is the only signal.
- [ ] Rate limit the public webhook at the proxy tier, or add one application limiter shared across replicas. The current brake is the body cap and the signature check.
- [ ] A real seller facing provider (a Russian payment service) behind the same adapter if the shop ever sells for real. Stripe is test mode only for this owner.
- [ ] Drop the `paymentDetails` column when no row carries it, in a later cleanup migration.
- [ ] Environment note for the verify pass: the running dev volume was initialised with Postgres credentials (`greedyghoster`, `astrum-db`) that differ from the names `.env` carries. Reconcile one side before running the database steps, or the steps fail on a connection error rather than on the feature.
