---

id: 0005
slug: account-confirmation-by-email
status: In Progress
adrs: []
date: 2026-11-05
---

# Account confirmation by email

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md)._

## Summary

An account becomes usable for ordering only after its owner proves they can read the mailbox on the address it was created with. Registration keeps working the way it does today: the customer is signed in right away and can browse, but ordering, writing reviews and editing the profile stay closed until a link from the email is followed. A new worker service, fed through RabbitMQ, owns token creation and delivery, so the auth service never blocks on a mail server and a failed letter can be retried without a person watching.

## Requirements

**User stories**:

- As a customer, I want to confirm my address by opening one link from the letter, so that the shop trusts the address I signed up with.
- As a customer, I want to still browse and keep a cart before confirming, so that registration does not stand between me and the catalogue.
- As a customer who lost or mistyped the letter, I want a way to ask for another one, so that one bad letter does not cost me the account.
- As the person who runs the shop, I want a letter that failed to be visible and retryable, so that a broken mail server does not silently drop confirmations.
- As the person who runs the shop, I want an invalid address to never place an order or write a review under an unconfirmed account.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

- **AC-1**: one migration adds the enum `UserStatus { PENDING, ACTIVE }`, the column `User.status UserStatus @default(PENDING)` and the table `EmailToken` (`id` uuid primary key, `userId` foreign key, `email` (the address the letter was minted for), `tokenHash` unique, `expiresAt`, `usedAt` nullable, `createdAt` default now, `@@index([userId])`, `onDelete: Cascade` from the user). Every account that exists before the migration reads `PENDING` afterwards with no separate update statement.
- **AC-2**: `POST /api/auth/register` creates the user in `PENDING` and still answers `200` with `{ token, expiresIn }` and a live session record, so registration signs the customer in as it does today. `GET /api/users/me` answers with the existing fields plus `status: "PENDING"` for that session.
- **AC-3**: registering an address that already exists answers `403` with body `{ code: "EMAIL_TAKEN", message }` and creates no user, whatever the status of the existing account.
- **AC-4**: a successful register publishes one message only after the user row is committed, on the durable direct exchange `astrum.events` with routing key `account.confirmation.requested`, body `{ userId, email, requestedAt }` and persistent delivery mode. The body carries no token. The publish is bounded at 2 seconds: a refused, timed out or unreachable broker is a failure, never a wait on a socket. When the publish fails the account stays created, the response is still `200`, and one structured log line `email.publish.failed` carries the `userId` and the error message.
- **AC-5**: the worker creates the link before sending it: on the first attempt for a message, in one transaction it inserts exactly one `EmailToken` row (`email` = the address carried by the message, `tokenHash` = sha256 hex of 32 bytes from `crypto.randomBytes` in base64url, `expiresAt` = mint time plus 24 hours) and sets `usedAt = now()` on every other unused row of that user, so only the newest letter works. Retries of that same message reuse the token already minted, so a retry never invalidates a letter that was in fact delivered. A message whose `userId` has no user row, or whose `email` differs from the address stored today, is acked and dropped with one log line `email.skipped` instead of being retried, because a stale letter must not confirm a newer address. The raw token exists in memory and in the letter only: it is never written to a database column and never appears in an application log line.
- **AC-6**: the letter carries a Russian subject and body, a plain text part and a minimal HTML part, and exactly one link `${STOREFRONT_URL}/api-gateway/auth/confirm?token=<raw>`. The sender is `MAIL_FROM`. The worker acks a message only after `sendMail` resolves, so a letter is never acked before it left.
- **AC-7**: a failed send (an SMTP error, or no resolution within 10 seconds) is retried through waiting queues with 60, 300 and 900 second delays, tracked in the `x-attempt` header, with one log line `email.send.failed` per attempt carrying the attempt number and the error. After the third delay expires, the fourth failure moves the message to `mail.confirmation.dead` with the last error, writes one log line `email.dead_lettered`, and sends nothing more. A message that succeeds on any attempt produces exactly one letter.
- **AC-8**: `GET /api/auth/confirm?token=<raw>` finds the row by sha256 of the parameter and always answers `302` to `${STOREFRONT_URL}/auth/confirm-email?status=<value>`, never JSON. Four values exist and nothing else does. `ok` when the row is unused and unexpired and its `email` equals `User.email`: `usedAt` is set and `User.status` becomes `ACTIVE` before the redirect. `ok` also when the row is used and the user is already `ACTIVE` (a second click, or a mail scanner that opened the link first). `used` when the row is used and the user is still `PENDING`, which is what a link replaced by a newer letter or by an email change looks like. `expired` when `expiresAt` has passed. `invalid` when no row matches, when the parameter is missing or empty, and when the row's `email` is not the address stored on the user today; in those cases nothing is changed. The raw token appears in no application log line, and the gateway's request logger skips this path so the query string is never printed.
- **AC-9**: `POST /api/orders` and `POST /api/products/:productId/reviews` answer `403` with `{ code: "EMAIL_NOT_CONFIRMED", message }` for a `PENDING` account, the handler never runs, and no order or review row is written. The same account keeps reading orders, the cart, the wishlist and every product endpoint without restriction.
- **AC-10**: the gate reads `User.status` from Postgres by primary key on each gated request, so the database is the only holder of that answer. When the read fails the answer is `503` with `{ code: "ACCOUNT_STATUS_UNAVAILABLE" }`, never `403`, and the handler is not reached. Confirming writes the column once, which means a confirmation finished in one browser lets the same session order in another browser without signing in again, and an email change takes the rights away everywhere at the same moment.
- **AC-11**: `POST /api/auth/confirm/resend` takes `{ email }` validated by a DTO, requires no session, and answers `204` with no body in every outcome. For a `PENDING` account it publishes one `account.confirmation.requested` message; for an unknown or `ACTIVE` address it publishes nothing; when a limit is reached it publishes nothing and writes one log line `email.resend.rate_limited` with the address and the limit that fired. Limits are 3 requests per 15 minutes per address and 10 per hour per IP, counted in Redis on `rl:confirm:email:<email>` and `rl:confirm:ip:<ip>` by one Lua script per key that runs `INCR` and sets `EXPIRE` only on the first increment, so a crash can never leave a counter without a lifetime. The address is lowercased. The IP is `req.ip` on the auth service, where `main.ts` already sets `trust proxy` to 1, so it resolves to the last `X-Forwarded-For` entry that Caddy writes; locally, with no proxy in front, that value is the gateway address and the bucket is shared, so the per IP half is verified in the compose stack rather than on a dev machine. An address that fails the DTO answers `400`.
- **AC-12**: `PATCH /api/users/me` on a `PENDING` account accepts only `email`: a body carrying `nickName` answers `403` with `{ code: "EMAIL_NOT_CONFIRMED" }`. With `email` equal to the stored one the answer is `400` with `{ code: "EMAIL_UNCHANGED" }` and nothing is published. With an address owned by another account the answer is `409` with `{ code: "EMAIL_TAKEN" }`, replacing the unhandled unique constraint error that answers `500` today. With a free address it stores the address, sets `status` back to `PENDING`, sets `usedAt` on every unused token of the user, publishes one `account.confirmation.requested` message for the new address, and answers `200` with the profile including `status`. On an `ACTIVE` account the endpoint keeps accepting `nickName`, and an email change follows the same rules.
- **AC-13**: `/auth/confirm-email` is reachable without a session, which means it joins `publicRoutes` in `src/proxy.ts`, and renders four outcomes from the `status` query: `ok` (confirmed message and a link to sign in), `expired`, `used` and `invalid` (each with its message and the resend form). With no `status` it serves the screen shown right after registration: the address the letter went to, a resend button, and a 60 second disabled state after each send. The page declares `robots: noindex`.
- **AC-14**: a successful register keeps the session and routes to `/auth/confirm-email` instead of the home page, and a `403 EMAIL_TAKEN` on register shows the sign in link plus the resend action. Every content page shows a banner for a `PENDING` account with a resend action, and the banner disappears after confirmation without a re-login, because the profile query is revalidated when the confirm page reports `ok`. A `403 EMAIL_NOT_CONFIRMED` from any call shows one toast carrying the resend action.
- **AC-15**: while the account is `PENDING` the profile form keeps the email field editable and disables the nickname field, so a save never sends a body the API refuses; saving a new address shows the "проверьте новую почту" message and the banner stays until the new address is confirmed.
- **AC-16**: the dev `docker-compose.yml` gains `astrum-rabbit` (`rabbitmq:4-management`, ports 5672 and 15672) and `astrum-mailpit` (`axllent/mailpit`, ports 1025 and 8025). The prod `docker-compose.prod.yml` gains `rabbitmq` (named volume, no published ports, health check through `rabbitmq-diagnostics -q ping`) and `worker` (one replica, `depends_on` rabbit healthy, `restart: unless-stopped`, no published port, image built from a new `apps/worker/Dockerfile` that follows the `turbo prune` pattern of the auth image). The root `dev` script starts the broker and Mailpit beside the database and Redis. `GET /health` on the worker answers `503` while the Rabbit connection is not ready and `200` with `{ rabbit: true, smtp: <boolean> }` when it is; `/health` on `api` and `auth` is left unchanged, so a broker outage never pulls them out of the balancer. SIGTERM on the worker stops consumption, lets the in-flight send finish within 10 seconds, then closes the connection.
- **AC-17**: `.env.example` and `.env.prod.example` document `RABBITMQ_URL`, `SMTP_URL`, `MAIL_FROM`, `STOREFRONT_URL` and `WORKER_PORT`. The worker throws at boot without `RABBITMQ_URL`, `MAIL_FROM` and `STOREFRONT_URL`; the auth service throws at boot without `RABBITMQ_URL` and `STOREFRONT_URL`, because it publishes and builds the redirect. With `SMTP_URL` absent the worker uses a development transport that writes the letter to the log and to a file under `MAIL_OUTBOX_DIR` (default `./tmp/mail`).

## Decision

**Chosen option**: Option 1: RabbitMQ and a dedicated worker

The auth service publishes one event when an address needs a letter, a new `apps/worker` service consumes it, mints the single use token, writes its hash and sends the letter, and the gateway refuses the closed actions for a `PENDING` account by reading a per user status key in Redis, with Postgres as the fallback.

**Implementation skills**: none installed for this stack

## Feature design

**Data model sketch**:

| Entity | Fields | Constraints |
|---|---|---|
| `User` (existing) | `status UserStatus @default(PENDING)` | one row per account; the enum has `PENDING` and `ACTIVE` |
| `EmailToken` (new) | `id` uuid pk, `userId` string fk, `email` string, `tokenHash` string, `expiresAt` DateTime, `usedAt` DateTime nullable, `createdAt` DateTime default now | unique on `tokenHash`; index on `userId`; relation to `User` with `onDelete: Cascade` |

Redis keys, outside the schema. The account status has no entry here: it is a column, read on demand.

| Key | Value | TTL | Written by |
|---|---|---|---|
| `rl:confirm:email:<email>` | counter | 900 | auth (resend) |
| `rl:confirm:ip:<ip>` | counter | 3600 | auth (resend) |

**State transitions**:

```
account:   PENDING --confirm link--> ACTIVE
           ACTIVE  --email change--> PENDING

token:     created --confirm--> used (usedAt set)
           created --new letter for the same user--> used (invalidated)
           created --24 hours--> expired (derived from expiresAt, no write)
```

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/auth/register` | POST | email, password, gender, dateOfBirth, nickName (opt) | `{ token, expiresIn }` | public | 403 `EMAIL_TAKEN`, 400 validation (including the age rule) |
| `/api/auth/signin` | POST | email, password | `{ token, expiresIn }` | public | 403 wrong credentials (unchanged) |
| `/api/auth/confirm` | GET | `token` query | 302 to `${STOREFRONT_URL}/auth/confirm-email?status=<value>` | public | none: every outcome is a redirect |
| `/api/auth/confirm/resend` | POST | email | 204 without body | public, rate limited | 400 invalid address |
| `/api/users/me` | GET | none | profile plus `status` | session | 401 (existing) |
| `/api/users/me` | PATCH | nickName (opt), email (opt) | profile plus `status` | session | 403 `EMAIL_NOT_CONFIRMED`, 400 `EMAIL_UNCHANGED`, 409 `EMAIL_TAKEN` |
| `/api/orders` | POST | unchanged | order | session and `ACTIVE` | 403 `EMAIL_NOT_CONFIRMED` plus the existing order errors |
| `/api/products/:productId/reviews` | POST | unchanged | review | session and `ACTIVE` | 403 `EMAIL_NOT_CONFIRMED` plus the existing review errors |
| worker `/health` | GET | none | `{ rabbit, smtp }` | none (internal network) | 503 while the broker connection is not ready |

**Value sourcing** (every value each action produces, computes or displays names where it comes from):

| Action | Value produced or displayed | Source |
|---|---|---|
| register | `status` of the new account | `User.status` default `PENDING`, AC-1 |
| register | the address the event carries | the `email` column of the created row |
| worker | raw token | `crypto.randomBytes(32)` in base64url, in memory only |
| worker | `tokenHash` | sha256 hex of the raw token |
| worker | `expiresAt` | send time plus the 86400 second constant |
| worker | the link in the letter | `${STOREFRONT_URL}` plus `/api-gateway/auth/confirm?token=<raw>` |
| worker | sender address | `MAIL_FROM` |
| confirm | the user the token belongs to | `EmailToken.userId` found by `tokenHash` |
| confirm | the `status` value carried to the page | the row's `usedAt` and `expiresAt`, plus `User.status` |
| gateway gate | the account status | `User.status` column, read by primary key |
| screen shown after registration | the address the letter went to | the `email` field of `GET /api/users/me`, because that screen is reached signed in; without a session the page shows only the outcome from the query |
| resend | the counter identity | the request body `email`, lowercased, plus `req.ip` |
| profile read | `status` shown to the storefront | `User.status` column |
| banner and forms | whether the account is confirmed | the `status` field of `GET /api/users/me` |

**Key invariants**:

- at most one usable `EmailToken` row exists per user at any moment.
- a token is usable only while `usedAt IS NULL` and `expiresAt` is in the future.
- `User.status = ACTIVE` means the address currently stored on the row has been confirmed by whoever could read it.
- the raw token is never persisted and never logged; only its sha256 is stored.
- registration succeeds whether or not the broker answers.
- a gated action never writes a row for a `PENDING` account.
- Postgres is the only holder of the account status: no cache answers that question, so no cache can go stale.

**Security model**:

- The token is a bearer secret delivered only in the letter. It is hashed at rest, single use, valid 24 hours, and replaced by every new letter. The confirm route is public by necessity, and 256 bits of randomness make guessing useless, so it carries no rate limit.
- The resend route is public and answers `204` in every case, so it reveals nothing about which addresses exist. It is limited per address and per IP because anyone can aim it at a third party's mailbox.
- Registration keeps its current behaviour of answering `403` for a taken address, so an existing account is still discoverable there. That is unchanged by this spec and recorded as a follow-up decision for the password reset flow.
- The gate is an authorisation rule on account state. It lives in one middleware in the gateway and is mounted on the two writing routes; reads stay open by design.
- Personal data in play: an email address and a session cookie. Nothing regulated is touched, and the letter carries only the link. No audit log is added, because no money or access control record changes hands here beyond the status column.

**Configuration required**:

- `RABBITMQ_URL`: broker connection string, required by `auth` and the worker.
- `SMTP_URL`: mail submission URL for the worker; absent means the development transport.
- `MAIL_FROM`: sender address of the confirmation letter, required by the worker.
- `STOREFRONT_URL`: public storefront origin, required by `auth` for the redirect and by the worker for the link.
- `WORKER_PORT`: worker health port, default 5580.
- `MAIL_OUTBOX_DIR`: folder the development transport writes letters to, default `./tmp/mail`.

**Critical test scenarios** (each maps to an acceptance criterion in `## Requirements`):

- Happy path: register, take the letter out of Mailpit, follow the link, order a product successfully, verifies **AC-2**, **AC-5**, **AC-8**, **AC-9**.
- Failure case: SMTP refuses the connection, the message moves through the three waiting queues, the fourth failure lands in `mail.confirmation.dead`, and one `email.dead_lettered` line is written, verifies **AC-7**.
- Failure case: the broker is stopped, registration still answers `200`, the account exists in `PENDING`, and `email.publish.failed` is logged, verifies **AC-4**.
- Failure case: a used token is opened a second time by the same customer and the page answers `ok` without a second status write, verifies **AC-8**.
- Failure case: the status read fails because Postgres is unreachable, and the two gated routes answer `503` with `ACCOUNT_STATUS_UNAVAILABLE`, never `403`, verifies **AC-10**.
- Auth/permission: a `PENDING` account is refused on `POST /api/orders` and on a product review, while its cart, order list and product reads keep working, verifies **AC-9**.
- Auth/permission: changing the profile email on a `PENDING` account is accepted for the email field and refused for `nickName`, and a taken address answers `409`, verifies **AC-12**.

## Build plan

Ordered as the project builds every slice: a thin thread through all four places first, then thickness. Tasks 1 to 3 make the gate real and the event reachable end to end; 4 to 8 fill the letter, the confirm path and the surfaces.

1. Migration and the status on the read path: the enum, the column with its default, the `EmailToken` table with its unique and index, `pnpm db:generate`, and `status` added to the auth service user select plus `GET /api/users/me`. Satisfies **AC-1**, **AC-2**. — done: `20261105112608_account_confirmation` applied, all 29 existing rows read `PENDING`, `GET /api/users/me` answers the status
2. The thin thread of the gate: the `requireActiveAccount` middleware reading `User.status` by primary key, with the `503` case on a failed read, mounted on `POST /api/orders` and on the nested review `POST`, plus the storefront toast for `EMAIL_NOT_CONFIRMED`. Satisfies **AC-9**, **AC-10**. — done: `403 EMAIL_NOT_CONFIRMED` live on the pending account while `GET /api/cart` answered `200`, and `503 ACCOUNT_STATUS_UNAVAILABLE` with Postgres stopped
3. The register path and the broker: `403 EMAIL_TAKEN`, the publisher with a durable connection and a confirm channel in auth, the `astrum.events` exchange, and a worker skeleton that consumes and logs. Satisfies **AC-3**, **AC-4**. — done: register answered `200` in 92 ms with the broker stopped and logged `email.publish.failed`
4. The worker package proper: `apps/worker` with `tsx`, config validation, `GET /health`, SIGTERM drain, the Rabbit and Mailpit services in both compose files, the `turbo prune` Dockerfile, and the `.env` templates. Satisfies **AC-16**, **AC-17**. — done: `GET /health` answers `200 {rabbit:true,smtp:true}` on the running stack, 16 unit tests on config and topology
5. The letter: token minting with invalidation of the previous one, the Mailpit SMTP transport plus the development transport, the Russian letter with its one link, the three waiting queues and the dead letter queue. Satisfies **AC-5**, **AC-6**, **AC-7**. — done: the letter arrived in Mailpit with the Russian subject, one link and both parts; the three waiting queues and the dead letter queue are declared at boot
6. The confirm path: `GET /api/auth/confirm` with its four outcomes and the status write, the request logger skip in the gateway, and the storefront `/auth/confirm-email` page with the four outcomes, added to `publicRoutes`. Satisfies **AC-8**, **AC-13**. — done: `ok` on the first click, `ok` on the second, `used` after a newer letter, `expired` with the row pushed into the past, `invalid` for an unknown or missing token, each a `302` to the page that renders it
7. Resend and the surfaces around it: the endpoint with its DTO and Redis limits, the screen shown right after registration with its cooldown, the header banner, the post register routing, and the `EMAIL_TAKEN` handling on the register form. Satisfies **AC-11**, **AC-13**, **AC-14**. — done: `204` with the address and the IP counters, the screen shows the address from `/users/me` and the button counts down from 59 s after a send, the banner renders on the storefront
8. The email change rules: the `PATCH` field rules, `400 EMAIL_UNCHANGED`, `409 EMAIL_TAKEN`, the status reset with token invalidation and the event, and the profile form behaviour while `PENDING`. Satisfies **AC-12**, **AC-15**. — done: `403` on a nickname while pending, `400` on the same address, `409` on a taken one, `200` with `status: PENDING` and a letter to the new address, nickname field disabled in the profile form

## Consequences

**Positive**:

- an address nobody can read can no longer place an order or write a review.
- the email change hole closes: an address is confirmed before the account keeps its full rights.
- the project gains its first queue and its first worker, which the deferred order emails can reuse instead of inventing a second mechanism.
- a letter that fails is retried without a person, and a letter that cannot be sent is kept in a dead letter queue instead of vanishing.
- the token is single use, hashed at rest, and exists in no database column and in no log.

**Negative / tradeoffs**:

- every account that exists at deploy time becomes `PENDING`, so no existing customer can order until they confirm. The development accounts, including `vanyanikitin84@gmail.com`, need a letter fetched from Mailpit before an order can be placed again.
- the shop now operates a second stateful service and a worker: two more containers to run, watch and restart, and a broker whose outage delays every confirmation.
- one Postgres read by primary key is added to the two gated routes. It buys no cache and no stale answer, which matters more here than the lookup costs.
- the one click link can be consumed by a mail scanner before the customer opens it. The common outcome is the `ok` page with the account already confirmed; when a newer letter had replaced the link, the page answers `used` and another letter is needed. Two step confirmation (a page with a button) is the alternative and was declined.
- a resend sent while the broker is down is lost: the endpoint still answers `204`, the failure is only a log line, and the customer has to press the button again.
- a crash between minting the token and acking the message leaves a letter in the inbox whose link answers `used`, because the redelivery mints a fresh token and invalidates the old one.
- the resend route is public, so it can be aimed at a third party's address until the per address and per IP limits fire.
- a mail outage of about 28 minutes exhausts the three delays and pushes letters into the dead letter queue, where recovery is manual.
- an `ACTIVE` customer who changes their email loses ordering until the new address is confirmed, and a typo there needs a second change through the same field.
- the letter is the only thing that proves the address, so an address typed wrong at registration is discovered only when no letter arrives.

**Neutral**:

- the confirm link points at the storefront origin and travels through its `/api-gateway` rewrite, so the same URL works on the local machine and on the shipped domain without a second public entry.
- the broker message carries no token, so neither the queue nor the dead letter queue ever holds a live secret.
- `/health` on `api` and `auth` deliberately ignores the broker: a mail outage must not take a working replica out of rotation.
- no new environment variable is read by the storefront, so the browser bundle is unchanged.

## Follow-up

- [ ] Alert on `email.dead_lettered` and on a growing `mail.confirmation` depth; the queue is invisible to a person until the first silent loss.
- [ ] Notify the old address after an email change, so a change made from a hijacked session is visible to the rightful owner.
- [ ] Purge `EmailToken` rows older than 30 days; nothing deletes them today.
- [ ] The deferred order emails reuse `astrum.events`, the worker and the dead letter queue instead of a second mechanism.
- [ ] Registration still reveals whether an address exists (`403 EMAIL_TAKEN`). The password reset flow must not inherit that behaviour without a decision.
- [ ] When the seller surface exists, its routes need the same `requireActiveAccount` treatment.
- [ ] Decide whether a customer may sign in twice under different sessions and confirm in one of them only; today the status key makes both order after a single confirmation, which is the intended reading but worth one explicit test during `/check verify`.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
