# Context

The shop lets anyone order with any address they type. `POST /api/auth/register` hashes the password, writes the user row and signs a session in one go, and nothing after that moment ever asks whether the address exists. Two consequences follow. An address that was typed wrong at registration still owns an account, still places orders and still writes reviews, and the shop has no way to reach that person again. And the address is editable from the profile form, where `UpdateUserDto` accepts `email` and `updateUser` writes it straight through, so a stolen session can move an account to an attacker controlled address without ever proving they can read it.

Meanwhile the project has no way to send a letter at all. There is no mail transport in any manifest, no broker, no queue and no background process: everything runs inside a request. The storefront has no screen for "we sent you something", the profile has no notion of an unconfirmed account, and the gateway's only authorisation question today is whether the session is alive.

The decision is what proves the address, what an account may do before that proof arrives, and how a letter is produced and delivered without turning registration into a request that depends on a mail server. Doing nothing leaves a shop where the only check on an address is that someone typed it.

> ⚠️ Premise note: the answer chosen here switches every existing account to `PENDING` at deploy time. That is a deliberate reading of "подтверждение обязательно всем", and it has a cost worth naming: after the migration no current customer can order until they fetch a letter, including the development accounts used by the test suite and by manual checks. The cheaper path is a data backfill that marks existing rows `ACTIVE` and confirms only new registrations; it was offered and declined. If the lockout turns out to be too wide in practice, one `UPDATE` in a follow-up migration reverses it, and the shipped code does not change. A second premise worth stating: a broker plus a worker for one letter type is more machinery than a single table would need. It was chosen deliberately and compared honestly in Option 2 below, so the cost is accepted rather than unnoticed.

# Options considered

### Option 1: RabbitMQ and a dedicated worker

The auth service publishes `account.confirmation.requested` and forgets about it. A new `apps/worker` process consumes the event, mints the token, writes its hash, sends the letter through SMTP, retries with delays and parks what cannot be delivered in a dead letter queue. The broker is a separate stateful service with its own management interface.

**Pros**:
- the delivery path is decoupled from registration, so a mail outage never fails a signup and never slows it.
- durable queues, waiting queues and a dead letter queue are built in, and the retry topology is configuration rather than code.
- the queue is reusable for the order emails already deferred in the scope.

**Cons**:
- a fourth stateful container to run, watch and back up, plus its own credentials.
- publish and commit are not atomic: a crash between the user insert and the publish loses the letter, and only the resend button recovers it.
- the topology (exchange, three waiting queues, dead letter queue, attempt header) is real configuration a reader has to learn.

### Option 2: Postgres outbox with a polling worker

A `MailJob` table is written in the same transaction as the user row, and the worker claims rows with `FOR UPDATE SKIP LOCKED`, counts attempts in a column and treats `status = FAILED` as the dead letter.

**Pros**:
- nothing is lost between the commit and the send, because there is no second system to reach.
- no new container, no new credential, one less thing to operate, and the job list is queryable with SQL.
- retries and dead letters are columns, so an operator reads them without a broker UI.

**Cons**:
- delivery latency is the poll interval rather than a push, and polling needs its own care not to spin.
- every consumer competes for the same table as the request path, which couples mail volume to database load.
- it does not give the project the broker and worker pattern the scope and the roadmap set out to build.

### Option 3: BullMQ on the existing Redis

The queue lives in the Redis instance that already holds sessions, through BullMQ, which brings retries with backoff and a failed set out of the box.

**Pros**:
- no new container and no new client library family.
- retries, backoff and a failure list come from the library rather than from hand written topology.

**Cons**:
- the Redis here has persistence switched off on purpose, so a restart loses queued letters along with the sessions.
- a queue sharing an instance with the session store couples two failure domains: memory pressure from the queue evicts sessions.
- BullMQ needs its own connection settings (`maxRetriesPerRequest: null`) that conflict with the deliberately aggressive ones the session client uses.

### Option 4: Send inside the registration request

No queue and no worker: `register` mints the token, writes the row and awaits the SMTP call before answering.

**Pros**:
- the smallest possible change: one service, one call, no new component.

**Cons**:
- a slow or broken mail server becomes a slow or broken registration, and the customer sees a failed signup for a reason that has nothing to do with them.
- no retry without holding the request open, and nothing survives a process restart.
- it hard codes the shape that the order emails will need to break later.

# Rationale

Option 1 was chosen, and Option 2 is the honest runner up. The deciding forces are in the Context: the project already committed to a queue plus worker architecture in its roadmap, the retry and dead letter behaviour this feature needs is native to a broker rather than hand rolled, and separating delivery from registration is the property that matters most, because a signup must never fail on a mail server. Option 2 is genuinely better on the two points that matter for correctness (no lost letter between commit and publish, and no container to operate), and it would be the pick for a shop whose only requirement were delivery. It loses here because it does not deliver the reusable background path the next slice (order emails) will want, and because the owner asked for a broker and a worker explicitly, with the broker's operational cost accepted.

Option 3 was declined on durability: this Redis is configured without persistence on purpose, so letters would be lost on restart exactly when a restart is most likely. Option 4 was declined because it puts a third party's availability directly on the registration path.

Two smaller decisions inside the design were weighed the same way.

**Where the account status is read.** The first draft of this spec put the status in a per user Redis key, `account:<userId>`, written at register, sign in, confirm and email change, and read by the gate with Postgres behind a miss, to keep the database out of a request that runs on every gated write. A cross check of that draft found the hole that killed it: when the cache write fails after a successful commit, the key keeps answering the old value until it expires, which blocks a freshly confirmed customer for a day and, after an email change, leaves an account trusted on an address that was never confirmed. Deleting the key on a failed write would close it, but the key then buys one saved indexed read on two POST routes and costs a write at four sites plus a stale window to reason about. The decision was therefore reversed to a primary key read of `User.status` on the gated routes, with a `503` when the read fails. The rejected alternative worth recording is putting `status` inside the session record: a session minted before the confirmation keeps its old value, so a customer who confirms in one browser stays blocked in the other until they sign in again.

**Who mints the token.** The worker does, not the auth service. If the auth service minted it, the raw secret would travel inside the broker message, and a letter that fails three times would sit in the dead letter queue with a live token for up to a day. Minting in the worker means the message carries only `{ userId, email }`, so no queue anywhere holds a secret, and the cost is that the "one active link per user" rule lives in the worker rather than in the service that owns the account. That rule is a single transaction on one table, and the invariant is written down and tested, so the trade is worth it.
