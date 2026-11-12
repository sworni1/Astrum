# Rationale: 0015. Payment through a test provider

## Context

Astrum takes orders but never takes money. The checkout stores `paymentMethod` and `paymentStatus`, the order screen prints them, and `paymentDetails` is free text typed by the customer. There is no payment module, no callback route, no provider reference on the order, and no environment variable that names a provider. An order with `ONLINE_CARD` is therefore indistinguishable from an order nobody ever tried to pay.

Three forces shape any fix. First, money and stock: stock leaves the shelf inside the order transaction today, so an unpaid order freezes inventory until someone cancels it by hand. Second, truth: a browser returning from a payment page is not proof that money moved, so the paid state has to come from a server to server callback that can be authenticated. Third, operability: a callback can be lost, arrives twice, arrives after a state change, or carries an amount that differs from the stored order, and each of those has to leave the database in a state a human can explain.

The stack fixes most of the answer. The gateway is Express 5 with Prisma 7 and Postgres, every router from `/api/users` onward sits behind `authenticateToken`, the JSON body parser is mounted before them (the `/api/auth` proxy sits before the parser and carries no token check, which is why the raw webhook belongs in that same early band), and the api process runs three replicas behind Caddy. The storefront is Next 16 with SWR and a Russian interface. There is no queue consumer for payments and no scheduler in the project, so any repair job has to live inside the api process or wait for a new worker capability.

## Options considered

### Option 1: Stripe Checkout on a hosted page

The gateway creates a Stripe Checkout Session for the order and redirects the browser to the Stripe page. Stripe hosts the card form, so no card data touches this project. A signed webhook (`Stripe-Signature`, an HMAC over the raw body) reports the outcome, and a test mode account with instant keys is enough to run the whole flow.

**Pros**:
- No card data reaches the server, which keeps the project out of card data handling entirely.
- A real signature over the raw body gives a check a forged request cannot pass, and Stripe retries a failed delivery on its own schedule.
- Test keys need no business verification, so the integration can be built and shown end to end immediately.
- Rouble is a supported presentment currency, so the stored `grandTotal` is charged as stored.

**Cons**:
- Stripe cannot serve a Russian merchant, so it is a test integration and not a path to real selling.
- The hosted page sits on another domain and carries its own interface, which cannot be styled to match the storefront.
- A local run needs the Stripe CLI (or a tunnel) to receive callbacks.

### Option 2: Stripe Elements inside the storefront

The card form is rendered inside the storefront with Stripe Elements and confirmed against a PaymentIntent.

**Pros**:
- The payment step stays on our domain and can match the storefront design.
- The same webhook story as Option 1.

**Cons**:
- A publishable key, a client side SDK, and a card form inside the storefront widen the surface and the PCI scope.
- More client code, more states, and a second place where an amount is displayed.
- The same Russian merchant problem as Option 1.

### Option 3: A Russian provider test shop (YooKassa or Robokassa)

A Russian payment service in test mode, with rouble amounts and a flow a real Russian shop would ship.

**Pros**:
- The right provider for the market the shop pretends to serve.
- A test shop is free and available without a signed contract.

**Cons**:
- YooKassa does not sign its notifications. Authenticity rests on an allowlist of source addresses plus a server side status re check, which is a weaker story than an HMAC and needs a second API call on every callback.
- Robokassa signs with an MD5 hash and requires a numeric invoice id, while order ids here are cuids, so a second identifier has to be invented and kept in step.
- The account setup (a phone, a form, a dashboard) is a prerequisite that would block the build.

### Option 4: A local fake provider in the repository

A small service in the repo that serves a fake payment page, signs its own callback, and runs in the compose stack.

**Pros**:
- Fully offline and deterministic in CI, with no external account and no CLI.
- The callback contract can be designed exactly as the shop wants it.

**Cons**:
- Nothing is learned about a real provider's failure modes: retries, duplicate events, signature edge cases, dashboard behaviour.
- It is infrastructure written for the demo, and it never proves the shop can integrate with anything.

## Rationale

Option 1 wins on the forces that matter here. It is the only option that produces a real signed callback with no card data on our side and no account setup blocking the build. The whole point of this slice is the server side of a payment: an attempt row, an authenticated callback, an amount check, a replay guard, and a repair job. A hosted page keeps the browser out of that story, which is exactly where the risk lives. Option 2 buys visual control at the price of a card form in the storefront and a publishable key, and none of the acceptance criteria need it. Option 3 is the right answer for a shop that actually sells in Russia, but its callback authenticity story is weaker and its prerequisite is an account the engineer does not have yet. Option 4 would teach nothing about a real provider.

The engineer accepted the known cost: Stripe cannot serve a Russian merchant, so this is a test integration. The adapter boundary (one `StripeGateway` with four methods) exists so a real provider can replace it later without touching the order rules.

Two smaller calls were made inside the decision. The Stripe page shows one summary line for the whole order rather than a line per item, because the order screen already carries the breakdown and a second copy would be a second place to drift. The customer email is not sent to Stripe, because the gateway does not read user records today and Stripe asks for an address on its own page anyway.

## Corrections to the scope seed

The scope row was written before the design existed. Four of its phrases needed attention, three of them a correction and one a confirmation, and the row is updated to the accepted outcome.

1. **"a failed or abandoned payment leaves the order payable again and frees the stock it held"** mixes two outcomes that cannot both hold. A declined card leaves the order payable and keeps the stock held; an abandoned session frees the stock and closes the order, so it is not payable again. The accepted split follows the provider's own events: a decline is not the end of a session, an expiry is.
2. **"a cancelled order closes its payment"** holds for the session, which is expired on cancel. It cannot hold for money: a callback that lands after a cancel is recorded as `PAID` with a `payment.refund_owed` warning, because dropping the fact that money arrived is worse than an order that needs a manual refund.
3. **"a callback whose signature and amount are checked against the stored order"** holds as written. Stripe signs the raw body, and the amount is compared in minor units against the stored `grandTotal`.
4. **The payment window** starts at order creation and restarts when a session is created, because Stripe refuses an `expires_at` closer than 30 minutes to session creation. A customer who presses pay 25 minutes after ordering gets a fresh 32 minute window (Stripe's floor plus a safety margin, because a session cannot be told to live exactly 30 minutes from a call made a moment later), and the stored deadline follows.

The row also said `ONLINE_CARD`, `PAYPAL` and `STRIPE` are labels the order screen prints. They stay labels for existing rows, but only `ONLINE_CARD` is offered at checkout from now on, since a single test provider cannot honestly stand behind three names.

## Measured state before the decision

- Orders in the development database: 77. `CASH` 40, `CARD_ON_DELIVERY` 31, `ONLINE_CARD` 1, `PAYPAL` 1, `STRIPE` 4. The four `STRIPE` rows are 2 `PENDING` and 2 `CANCELLED`, so retiring the method from the checkout breaks no live flow.
- Payment code in the repository: none. `paymentMethod`, `paymentStatus` and `paymentDetails` are written on create, printed on the order screen, and read once by the cancel path (`paymentStatus === "PENDING"` becomes `CANCELLED`).
- Mount chain: every `/api/*` router sits behind `authenticateToken`, and `express.json` is mounted before them, so a raw body webhook has to be mounted earlier in `app.ts`.
- Seller read: `findSellerOrders` uses an explicit `select`, and `toSellerOrderGroupJson` lists its fields, so `paymentStatus` does not arrive on its own.
- Deployment: the Caddyfile publishes only the storefront on 80 and 443. The api is reachable as `proxy:3580` inside the network, so a provider callback from the internet needs its own public path.
- Dependencies: no `stripe` package anywhere in the workspace.
- Idempotency: `canonicalOrderBody` (`apps/api-astrum/src/modules/order/idempotency.ts`) hashes `paymentDetails`, so dropping the field from the DTO changes every fingerprint.
- Environment templates: neither declares `DOMAIN`. Only `docker-compose.prod.yml` and the `Caddyfile` read it, with a `localhost` default.
- Environment: neither `.env.example` nor `.env.prod.example` names a provider or a signing secret.
