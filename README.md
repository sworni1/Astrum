# Astrum

[English](README.md) · [Русский](README.ru.md)

An e-commerce platform in a monorepo: a Next.js storefront, an Express API gateway, a separate NestJS authentication service and one shared Prisma plus PostgreSQL data schema. Everything runs with a single `docker compose`, and every layer except the database runs in several replicas behind one balancer.

> **Stage: MVP in progress.** The catalogue, the cart, the account, checkout and email confirmation work: the server decides the price, the contents and the stock of an order, and a repeated submit does not create a second order. A confirmed account can open its own shop from the profile page. The rest of the end to end flow is still ahead: fulfilment, payment and the review screen.

## What works

- **Catalogue**: 4.7 thousand products (demo data), 10 categories, a product page with specifications, recommendations, cursor pagination and search inside a category
- **Account**: registration and sign in (argon2), the session in an HttpOnly cookie, guarded routes on the storefront and on the API
- **Email confirmation**: a letter with a 24 hour link goes through the broker and the worker, the storefront shows a check your mail screen and offers a resend with a rate limit; while the account is `PENDING`, orders, reviews and profile edits stay closed
- **Profile**: editing the data, changing the password, deleting the account
- **Selling**: a confirmed account opens its own shop from the profile page with one name and one button; the storefront and the gateway create exactly one shop per account, a repeated press answers with the existing shop and renames nothing, and the seller area appears without a reload
- **Cart and wishlist**: adding, changing the quantity with a stock check, removing, selecting the lines for checkout
- **Checkout**: the delivery methods come from the API with their prices and currency, the order stores the chosen method and its delivery price, the grand total is computed on the server, and a missing, switched off or wrong currency method is refused with its own code
- **Orders**: the server decides the price, the contents and the stock; lines carry only `productId` and `quantity`, the sums are `Decimal`, the stock is taken in a transaction and a refusal comes as a code (`OUT_OF_STOCK`, `CART_MISMATCH`); a repeated submit with the same `Idempotency-Key` returns the first order, the ordered cart lines are cleared on the server, and the order page opens for its owner only. Order cancellation and status transitions work; fulfilment is not built yet
- **Reviews**: an API with a purchase check (only after `DELIVERED`), one review per order line and moderation; the review screen still runs on mock data

## Architecture

One Caddy plays two roles: the public entry point and the internal balancer in front of the gateway. No layer calls another one directly at a single address, every hop goes through Caddy, so the API replicas are balanced too. The sessions of all replicas meet in Redis, and confirmation letters go through RabbitMQ into a separate worker.

```
browser
  │  HttpOnly cookie __auth
  ▼
proxy (Caddy) · :80 / :443         public entry point, TLS
  ▼
apps/customer ×2   Next.js 16 · :3000 (standalone)
  │  /api-gateway/*  →  proxy:3580
  ▼
proxy (Caddy) · :3580              inside the network, never published
  ▼
apps/api-astrum ×3   Express 5 · :3580 ─── /api/auth ───▶ apps/auth-astrum   NestJS 11 · :4580
  │            │                                                  │
  │            └──── session:<sid> ──▶ redis 7 · :6379 ◀──────────┘
  │                                                               │
  │                                        account.confirmation.requested
  │                                                               ▼
  │                                                     rabbitmq 4 · :5672
  │                                                               ▼
  │                                    apps/worker · :5580 ──▶ mailpit · :8025
  │                                                               │
  └───────────────────────────┬───────────────────────────────────┘
                              ▼
                     PostgreSQL 16 · Prisma 7
                      packages/Astrum-db
```

Replicas keep no state in the process: a session is a signed JWT in a cookie plus one `session:<sid>` record in Redis that the gateway reads on every guarded request, so signing out revokes the session at once on all three replicas. Redis lives in the same compose network without a volume and without persistence: a container restart ends every live session. Caddy finds the replicas through compose DNS (`dynamic a`), checks each one with `GET /health` (Postgres and Redis) and drops a failed replica from rotation, with a retry to a neighbouring replica while a check window runs. The Prisma connection pool is capped by `DB_POOL_SIZE`, and a separate one shot service applies the migrations before the applications start.

Email confirmation goes through the broker: `apps/auth-astrum` publishes an `account.confirmation.requested` event into the `astrum.events` exchange after registration and after a resend, the gateway does the same after an address change, and `apps/worker` takes it from the `mail.confirmation` queue, mints a one time 24 hour link (the database keeps only the sha256 of the token, the token itself stays in the letter) and sends the letter over SMTP; without `SMTP_URL` it writes the letter into `MAIL_OUTBOX_DIR`. A failed delivery returns to a waiting queue after 60, 300 and 900 seconds, and after the fourth attempt the letter lands in `mail.confirmation.dead` with the text of the last error. While an account is `PENDING`, the gateway answers `403 EMAIL_NOT_CONFIRMED` for orders, reviews and profile edits; sign in, the catalogue and the cart stay open. In the production stack Mailpit plays the SMTP role, and its interface is open at `http://localhost:8025`.

| Service    | Port   | Reachable                              | Replicas |
| ---------- | ------ | -------------------------------------- | -------- |
| `proxy`    | 80/443 | from outside                           | 1        |
| `customer` | 3000   | inside `astrum` only                   | 2        |
| `api`      | 3580   | inside only, through `proxy`           | 3        |
| `auth`     | 4580   | inside only, from `api`                | 1        |
| `worker`   | 5580   | inside only                            | 1        |
| `rabbitmq` | 5672   | inside only                            | 1        |
| `mailpit`  | 8025   | from outside, prod stack only          | 1        |
| `redis`    | 6379   | inside the network, on the host in dev | 1        |
| `db`       | 5432   | inside only                            | 1        |

The reasoning behind the choice and the rejected alternatives (Swarm, nginx, Traefik) live in [ADR-0003](docs/adr/0003-container-topology-and-load-balancing.md).

## Stack

| Layer          | Technologies                                                                                |
| -------------- | ------------------------------------------------------------------------------------------- |
| Storefront     | Next.js 16 (App Router), React 19, TypeScript 7, Tailwind 4, shadcn/ui                      |
| Data in the UI | SWR, React Hook Form with Zod                                                               |
| API gateway    | Express 5, Prisma 7, class-validator                                                        |
| Authentication | NestJS 11, Passport JWT, argon2, Swagger                                                    |
| Sessions       | Redis 7 (ioredis): one `session:<sid>` record for the life of the token                     |
| Events         | RabbitMQ 4 (amqplib): the `astrum.events` exchange, retries and a dead letter queue         |
| Mail           | `apps/worker` on nodemailer, SMTP or Mailpit with its interface on 8025                     |
| Database       | PostgreSQL 16, Prisma 7                                                                     |
| Infrastructure | pnpm workspaces, Turborepo, Docker Compose with replicas behind Caddy, husky and commitlint |

## Roadmap

- [x] Catalogue, product page, search, recommendations
- [x] Account, profile, session
- [x] Cart and wishlist
- [x] Containers: replicas behind one entry point, health check, graceful shutdown
- [x] Server side recalculation of the order price and stock: price and name from the product, one transaction, a refusal when the stock runs short
- [x] Checkout: clearing the server side cart and an idempotent repeated submit
- [x] Session store in Redis: the session lives on the server, the gateway checks it in Redis on every request, and signing out revokes the session at once on every replica (spec [0004](docs/specs/_root/0004-session-store-in-redis/index.md))
  - [x] Session schema: the token gains a session id, and Redis keeps a record with a TTL as long as the token (before, the JWT carried only `userId` for one day while the cookie lived seven)
  - [x] Redis in both compose files and in `.env.example` with `.env.prod.example`: the address `redis:6379` for `api` and `auth`, and the client dependency in the manifests (the storefront needs no store, it calls the gateway)
  - [x] Auth: writing the session on registration and sign in, the `POST /api/auth/logout` route that removes the record, and revoking the current session on a password change and on account deletion
  - [x] Gateway: `authenticateToken` checks the session in Redis after the signature, and a revoked token answers `401` on any of the three `api` replicas
  - [x] Storefront: signing out calls `logout` in the API first and only then clears the cookie
- [x] Account confirmation by email, through the broker and the worker (spec [0005](docs/specs/_root/0005-account-confirmation-by-email/index.md))
  - [x] Schema: `User.status` (`PENDING` / `ACTIVE`) and a confirmation token table with a TTL and single use (24 hours, only the sha256 of the token in the database)
  - [x] RabbitMQ in both compose files, the `account.confirmation.requested` event from the auth service after registration and from the gateway after an address change, and a republish on the customer request
  - [x] The `apps/worker` worker: the mail queue, retries after 60, 300 and 900 seconds, a dead letter queue, and an SMTP or a test transport (the letter goes into a file)
  - [x] Gateway and auth: `GET /api/auth/confirm?token=...` with the outcomes `ok`, `used`, `expired` and `invalid`, and orders, reviews and profile edits closed while the account is `PENDING`
  - [x] Storefront: the check your mail screen and a resend with a rate limit (3 per 15 minutes per address, 10 per hour per IP)
- [x] Order statuses and the seller panel
- [x] Seller onboarding: a confirmed account opens its own shop from the storefront, and a second press opens nothing (spec [0008](docs/specs/_root/0008-seller-onboarding/index.md))
  - [x] Schema: `Business.name` required, added in three steps so existing rows keep their data (a nullable column, then `Shop ` plus the last 6 characters of the id, then `NOT NULL`)
  - [x] Gateway: `POST /api/seller/onboarding` behind the account gate, one shop per account through the unique index, and a repeat or a lost race answering with the stored shop
  - [x] Storefront: the `/seller/onboarding` page with its five states, the `Sell on Astrum` section on the profile, and the action on the panel screen for an account that does not sell
- [x] Delivery methods from the API: the checkout lists the methods the gateway serves with their prices and currency, the order stores the method, its delivery price and a server computed grand total, and a missing, switched off or wrong currency method is refused with its own code (spec [0009](docs/specs/_root/0009-shipping-methods-from-the-api/index.md))
- [ ] English interface by default: every storefront screen answers in English, Russian stays as a second locale, and the confirmation letter follows the chosen language (spec [0006](docs/specs/_root/0006-english-interface-by-default/index.md); built on 2026-11-06, the verify walk is still owed)
- [ ] Fulfilment: pickup or a receipt confirmation
- [ ] Payment through a test provider and order letters
- [ ] Reviews in full, moderation is off for now
  - [ ] Writing: a form on the product page after `DELIVERED`, ratings (overall, quality, delivery, match) and the text go to the API, and the review is `APPROVED` at once
  - [ ] Review likes: a `ReviewLike` table with one row per review and customer, the count in the response, a toggle in the UI
  - [ ] Review comments: customer replies under a review (`ReviewComment`), the list and the form, separate from the shop answer `ReviewResponse`
  - [ ] The review storefront: the lists and forms stop running on mocks, and the average rating and the count come from the database
- [ ] End to end tests of the order flow, CI

## Quick start

You need Node 24+, pnpm 12.8+ and Docker.

### Development

```bash
pnpm install
cp .env.example .env     # fill in JWT_SECRET and the database password
pnpm db:up               # Postgres 16 and Redis 7 in Docker
pnpm prisma:migrate:deploy
pnpm db:generate
pnpm dev                 # Postgres, Redis, RabbitMQ and Mailpit in Docker, then storefront :3000 · API :3580 · auth :4580 · worker :5580
```

The demo catalogue is loaded from an xlsx file by the `seed:excel` script; the database files stay out of the repository, so a fresh clone starts with an empty shop.

### The whole stack in Docker

```bash
cp .env.prod.example .env.prod   # fill in the database password and JWT_SECRET
pnpm docker:prod:build           # build the images
pnpm docker:prod:up              # http://localhost, mail on :8025
pnpm docker:prod:logs            # every service log
pnpm docker:prod:down            # stop the stack
```

- The domain lives in the **root `.env`** (`DOMAIN=http://localhost` locally, `DOMAIN=example.com` on a host, and Caddy issues the certificate itself). The container variables live separately in `.env.prod`, because these are two different substitution layers.
- Inside the network the services answer at compose names (`db`, `auth`, `api`, `proxy`), never at `localhost`.
- More replicas: `docker compose -f docker-compose.prod.yml up -d --no-deps --scale api=5 api`.
- `pnpm dev` and `docker:prod:up` share one Postgres volume (`POSTGRES_VOLUME`), so they must never run at the same time.

## Documentation

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): development notes on scripts, hooks, conventions, environment variables and the checklist for MVP readiness
- [docs/adr/](docs/adr/README.md): architecture decisions and their reasoning
- [docs/specs/](docs/specs/): feature specs with the contract, the reasoning and the verification log
- [docs/scope/](docs/scope/index.md): the living scope per workspace and the feature statuses
- [docs/changelog/](docs/changelog/): the change log by date

## Author

Ivan Nikitin · [github.com/sworni1](https://github.com/sworni1)
