# 2026-11-05 · Account confirmation by email

Spec: [0005-account-confirmation-by-email](../specs/_root/0005-account-confirmation-by-email/index.md).

## Added

- `packages/Astrum-db/prisma/migrations/20261105112608_account_confirmation` — the enum
  `UserStatus` (`PENDING`, `ACTIVE`), `User.status` as `NOT NULL DEFAULT 'PENDING'` with no
  backfill (every existing row keeps its access through the gate described below), and the
  `EmailToken` table with a unique `tokenHash`, an index on `userId` and a cascade delete.
- `apps/worker/` — a new service that owns the letter: `topology.ts` declares the exchange
  `astrum.events` and five queues (`mail.confirmation`, `.wait.1`, `.wait.2`, `.wait.3` with
  TTL 60, 300 and 900 seconds dead lettering back to the exchange, and `.dead`);
  `consumer.ts` reads the attempt header, acks and drops a message whose account is gone or
  whose address changed; `tokenStore.ts` mints 32 random bytes, stores their sha256 and sets
  `expiresAt` 24 hours ahead; `letter.ts` builds the Russian text and html parts with one
  link; `mailer.ts` picks SMTP or the outbox; `health.ts` answers `GET /health` with the
  broker and the transport; `config.ts` refuses to boot and names the missing variable.
- `apps/auth-astrum/src/events/` — the publisher: a confirm channel on `astrum.events`,
  routing key `account.confirmation.requested`, a persistent body carrying `userId`, `email`
  and `requestedAt`, and never the token.
- `apps/auth-astrum/src/config/auth.config.ts` — the token lifetime and the storefront URL
  in one place, read through the same validation as the rest of the service.
- `apps/api-astrum/src/middlewares/requireActiveAccount.ts` — the gate in front of the order
  and review routers: `403 EMAIL_NOT_CONFIRMED` for a `PENDING` account, `503
  ACCOUNT_STATUS_UNAVAILABLE` when the status cannot be read, never a silent `500`.
- `apps/api-astrum/src/events/` — the gateway publishes the same confirmation event after an
  email change, bounded by a 2 second timeout, so a broker that is down costs one log line.
- `apps/customer/src/app/(auth)/auth/confirm-email/page.tsx` with
  `features/auth/ConfirmEmail/{index,ResendForm}.tsx` — the four outcomes `ok`, `used`,
  `expired` and `invalid`, plus the screen shown after registration.
- `apps/customer/src/features/layout/ConfirmEmailBanner/` — the amber banner on every content
  page while the account is `PENDING`, with an inline resend.
- `apps/customer/src/hooks/user/useResendConfirmation.ts`,
  `common/helpers/confirmEmail.ts` — one entry point for the resend call, shared by the
  screen, the banner and the toast action.
- Tests: `apps/worker/src/{config,consumer,letter,logger,mailer,token,topology}.test.ts`
  (24 cases), `apps/auth-astrum/src/auth/auth.{service,controller}.spec.ts`,
  `apps/api-astrum/src/__tests__/requireActiveAccount.test.ts`.
- Environment: `RABBITMQ_URL`, `STOREFRONT_URL`, `MAIL_FROM`, `SMTP_URL` and
  `MAIL_OUTBOX_DIR` in `.env.example`, `.env.prod.example` and each app's `.env.example`;
  `rabbit`, `mailpit` and `worker` in `docker-compose.yml` and `docker-compose.prod.yml`.

## Changed

- `apps/auth-astrum/src/auth/auth.service.ts` — registration creates the token and publishes
  the event without waiting on the broker; `GET /api/auth/confirm` resolves a token into one
  of the four outcomes and answers `302` to the storefront, never JSON; a second click on a
  live token does not write `usedAt` again; `POST /api/auth/confirm/resend` answers `204`
  whether or not the address exists, and counts three per 15 minutes per address and ten per
  hour per IP.
- `apps/auth-astrum/src/redis/redis.service.ts` — a counter helper with a window, the same
  shape the resend limits need.
- `apps/api-astrum/src/modules/user/user.service.ts` — changing the address on an active
  account moves it back to `PENDING`, mints a new token and publishes the event, so the
  orders and reviews of that session close in the same request.
- `apps/customer/src/features/auth/Register/index.tsx` — an address that already exists is
  refused inline with «Войти» and «Отправить письмо снова» instead of a bare error.
- `apps/customer/src/features/pages/Profile/actions/EditProfileForm/index.tsx` — the nickname
  is locked while the account is `PENDING`, the address stays editable, and saving a new
  address asks «Are you absolutely sure?» first.
- `apps/customer/src/hooks/useFetcher.ts` — a `403 EMAIL_NOT_CONFIRMED` answers one toast
  carrying the «Отправить письмо» action, shown once per session.
- `apps/customer/src/common/helpers/showToast.tsx` — a toast may carry an action label and a
  handler.
- `apps/api-astrum/src/app.ts` — the request logger skips the confirm request by
  `originalUrl`, because `req.path` is the mount path for a proxied router and never matched.

## Fixed

- `apps/worker/src/consumer.ts` — a failing letter never left `wait.1`: the handler wrote the
  same attempt number back into the header that redelivery reads, so every failure looked
  like the first one, `wait.2`, `wait.3` and the dead letter were unreachable and a broker
  outage was retried forever. The header now names the attempt that comes next, while the
  dead lettered message keeps the number that failed.
- `apps/api-astrum/src/app.ts` — the raw confirmation token reached the gateway access log
  (`GET /api/auth/confirm?token=… 302`). The skip predicate compared `req.path` with the
  confirm path and never matched; after the fix the token appears in no service log.
- `apps/auth-astrum/src/events/describe-error.ts`, `apps/worker/src/logger.ts`,
  `apps/api-astrum/src/events/describe-error.ts` — `email.publish.failed`,
  `rabbit.connect.failed` and `rabbit.connection.error` logged `reason: ""`, because amqplib
  rejects a refused connection with an `AggregateError` whose own message is empty. The
  helper unwraps `errors[]` in all three services, so the line now reads
  `connect ECONNREFUSED ::1:5672 | connect ECONNREFUSED 127.0.0.1:5672`.
- `apps/worker/src/mailer.ts` — the outbox transport wrote the letter subject into the `From`
  header; it now writes `MAIL_FROM`.

## Verified

- `/check verify account confirmation by email` on a freshly started stack: all 17 acceptance
  criteria. The letter lifecycle (`ok`, a repeated click, `used` after a newer letter,
  `expired`, `invalid`), the gate on orders and reviews with the real `201` order afterwards,
  the `503` with the database stopped, both resend limits, the four screens, the banner, the
  boot refusals and the outbox.
- The retry ladder measured end to end with SMTP down: failures at 15:40:57, 15:41:59,
  15:47:10 and 16:02:44 with attempts 1 to 4, two `email.dead_lettered` lines and two
  messages parked in `mail.confirmation.dead` carrying `x-last-error`.
- The raw token of a live letter is absent from all four service logs; the gateway still logs
  `register`, `signin` and `users/me`.
- `pnpm quality-gate` → 18 of 18 tasks. Auth jest 41, api jest 73 with 7 skipped, worker
  `tsx --test` 24.
- Steps and the remaining manual walkthrough:
  [verify.md](../specs/_root/0005-account-confirmation-by-email/verify.md).

## Open

- Three walkthroughs are still unchecked in `verify.md`: the gated toast was never watched in
  a browser, the per IP half of the resend limit wants a run inside the compose stack, and
  «new nickname with an unchanged address» was proved through `PATCH /api/users/me` only.
- The 29 accounts that existed before the migration are `PENDING` by design, and nothing in
  the product can activate them again: they have no letter. A one off backfill or a manual
  `UPDATE "User" SET status = 'ACTIVE'` is a decision for the owner.
- The outbox transport writes the raw link to a file on disk; it is a development fallback
  and must not be enabled where that directory is shared.
- The confirmation letter has no plain text unsubscribe and no bounce handling, because the
  sender is a local Mailpit in every environment so far.
