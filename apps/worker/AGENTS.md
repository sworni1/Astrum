# Mail worker

## Overview

Background service that consumes `account.confirmation.requested` from RabbitMQ and delivers the confirmation letter. It owns the confirmation token (minted here, stored as a sha256 hash) and the retry ladder, and it never touches the HTTP session.

## Stack

- Node 24, TypeScript 7 (`tsc`), `tsx watch` in development
- `amqplib` against RabbitMQ 4, `nodemailer` against SMTP or the file outbox
- Prisma 7 client from `@astrum/db` with the pg adapter
- Tests: `tsx --test "src/**/*.test.ts"`

## Key files

| File                | Owns                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/main.ts`       | prisma, rabbit connection with retries, consumer, health server, SIGTERM drain                           |
| `src/config.ts`     | env parsing: `RABBITMQ_URL`, `SMTP_URL`, `WORKER_PORT`, `MAIL_OUTBOX_DIR`, `STOREFRONT_URL`, `MAIL_FROM` |
| `src/topology.ts`   | exchange, queue and retry queue names, retry delays, max attempts                                        |
| `src/consumer.ts`   | the message handler: mint, store, build, send, ack or move to the retry queue                            |
| `src/token.ts`      | raw token, sha256 hash, 24 hour expiry and the confirmation link                                         |
| `src/tokenStore.ts` | writes the `EmailToken` row through Prisma                                                               |
| `src/letter.ts`     | subject and body of the confirmation letter                                                              |
| `src/mailer.ts`     | SMTP transport, the file outbox fallback and the send timeout                                            |
| `src/health.ts`     | `GET /health`, answering rabbit and smtp readiness                                                       |
| `src/logger.ts`     | one structured JSON line per event, plus `describeError`                                                 |

## Commands

```bash
pnpm --filter @astrum/worker dev
pnpm --filter @astrum/worker test
pnpm --filter @astrum/worker check-types
```

## Conventions

- Sources stay flat in `src/`, the suites live in `src/__tests__/`; the `tsx --test` glob covers both.
- Only the sha256 hash reaches the database; the raw token exists in the letter and nowhere else.
- A delivery failure is republished to `retryQueueName(attempt)` with the `x-attempt` header; after the last delay the message goes to `mail.confirmation.dead` with the last error in `x-last-error`.
- A message is acked only after the send succeeded, so a crash mid delivery repeats the message instead of dropping it.
- Every attempt mints a fresh token and replaces the previous link, because the raw token lives only in the letter and never in the queue.
- An unknown user, an address that changed since the event, or an unparsable body is acked and logged as `email.skipped`, never retried.
- `prisma/schema.prisma` is a copy of `packages/Astrum-db/prisma/schema.prisma` and must stay byte identical to it.
- This package has no ESLint: `lint`, `format` and `format:check` are echo stubs that exit 0.

## Gotchas

- The queue topology is declared at boot, so a fresh broker gets its exchange and queues from this service; a publisher alone does not create them in the same shape.
- amqplib rejects a refused connection with an `AggregateError` whose own message is empty, so every log line goes through `describeError`, which unwraps the nested reasons.
- Environment is read once at boot: after editing `.env` restart the worker, otherwise the old `RABBITMQ_URL` keeps failing the handshake.
- Without `SMTP_URL` the letter is written to `MAIL_OUTBOX_DIR` and `GET /health` still answers `200`, only with `smtp: false`; until the broker connection is up the same probe answers `503` with `rabbit: false`. In the prod compose the SMTP peer is Mailpit on 1025 with its UI on 8025.
- SIGTERM cancels the consumer, waits for the in flight send and only then closes the connection, which is what lets the compose `stop_grace_period` drain cleanly.

_Drafted by /sync from the introducing change, worth a quick human pass._
