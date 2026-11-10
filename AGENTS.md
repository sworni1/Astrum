# Astrum

## Stack

- **Language / Runtime**: TypeScript 7 (`tsc`) with the TypeScript 6 compiler API aliased as `typescript` for eslint and ts-jest, Node 24
- **Framework**: Next.js 16 App Router (storefront), Express 5 (API gateway), NestJS 11 (auth service), Node worker (`apps/worker`, mail delivery)
- **Key dependencies**: Prisma 7 with `@prisma/adapter-pg`, React 19.3, Tailwind CSS 4, Zod 4, class-validator, ioredis (sessions), amqplib (events), nodemailer (mail)
- **Package manager**: pnpm 12.8.1 workspaces with Turborepo 2.11; Postgres 16, Redis 7, RabbitMQ 4 and Mailpit in Docker
- **Known pin**: `@nestjs/*` stays on 11.2.8 because NestJS 12 is ESM-only; Prisma stays on 7.10.1 because the `latest` tag is a release candidate. See `docs/adr/0002-toolchain-baseline.md`.

## Build approach

Tracer Bullet: every slice runs end to end through the storefront and the gateway. Mirrored from `docs/scope/index.md`.

## Commands

```bash
pnpm install                # install every workspace
pnpm dev                    # start Postgres, Redis, RabbitMQ and Mailpit, then turbo dev (3000, 3580, 4580, 5580)
pnpm build                  # turbo build
pnpm check-types            # tsc --noEmit per package
pnpm lint                   # real in customer and auth, echo stubs elsewhere
pnpm test                   # turbo test (jest, vitest and node:test per package)
pnpm quality-gate           # check-types, lint and test
pnpm db:generate            # prisma generate into packages/Astrum-db/generated
pnpm prisma:migrate:dev     # create a migration
pnpm db:up                  # Postgres and Redis containers
pnpm docker:prod:build      # build the deployable images
pnpm docker:prod:up         # rebuild the images and start the full stack in replicas behind Caddy (80/443, mail UI 8025)
pnpm docker:prod:down       # stop the stack
pnpm docker:prod:logs       # follow every service log
pnpm docker:prod:scale      # rebuild and restart the api replicas only
```

## Deployment topology

`docker-compose.prod.yml` + `Caddyfile` are the deployable shape; `docker-compose.yml` stays the dev-only support stack.

```
browser -> proxy:80/443 -> customer x2
customer -> proxy:3580  -> api x3 -> auth x1
api, auth -> redis:6379           (session:<sid>)
api, auth -> rabbitmq:5672 -> worker:5580 -> mailpit:8025
api, auth, worker -> db:5432
```

- Runtime configuration comes from `.env.prod` (template: `.env.prod.example`); service hostnames inside the network are `db`, `auth`, `api`, `worker`, `rabbitmq`, `redis`, `mailpit`, `proxy`.
- Only `proxy` (80/443) and `mailpit` (8025) publish host ports. `api:3580`, `auth:4580` and `worker:5580` are reachable inside the `astrum` network only.
- `migrate` is a one-shot service that runs before anything else starts.
- Replicas are discovered by Caddy through `dynamic a <service> <port>`; plain `reverse_proxy service:port` balances nothing.
- `GET /health` exists on customer, api, auth and worker and is the only probe URL.
- The worker consumes the `mail.confirmation` queue bound to `astrum.events` and delivers through `SMTP_URL`; with no `SMTP_URL` it writes the letter into `MAIL_OUTBOX_DIR`. Retries wait 60, 300 and 900 seconds, then the message lands in `mail.confirmation.dead`.
- Two compose files, one meaning each: `docker-compose.yml` is the dev path (`pnpm dev` starts its Postgres, Redis, RabbitMQ and Mailpit containers, `pnpm db:up` starts Postgres and Redis), `docker-compose.prod.yml` is the deployable stack. Do not run `docker compose up` from the dev file expecting the new topology.
- The stack shares the Postgres volume `astrum_astrum-db-data` with the dev container (`POSTGRES_VOLUME` in `.env`). Never run `pnpm dev` and `pnpm docker:prod:up` at the same time — two postmasters on one data directory.
- See `docs/adr/0003-container-topology-and-load-balancing.md`.

## Rules

- Layout is fixed: `apps/*` are runnable services, `packages/*` are shared libraries. A shared package never imports from an app.
- The browser talks only to `apps/customer`; customer reaches the gateway through the `/api-gateway/*` rewrite; the gateway reaches auth. A new backend integration is proxied through `apps/api-astrum`.
- The session lives in the `__auth` HttpOnly cookie, written by customer `src/common/helpers/session.ts`, verified by the gateway middleware, and backed by one `session:<sid>` record in Redis that every replica reads. There is no Authorization header.
- Commits follow Conventional Commits with type and scope in English and subject in Russian; the allowed types are enforced in `commitlint.config.js`.
- React component files use PascalCase names, request logic lives in dedicated hooks, and code carries no comments unless the owner asks for them.
- Do not create git commits unless explicitly requested.
- Run `pnpm db:generate` after a fresh install or a schema change; type checks and builds fail while the generated client is missing.
- Hooks are live: `commit-msg` validates the format through the local `commitlint` binary, `pre-commit` is empty on purpose so a commit stays instant (formatting is manual: `pnpm format`), `pre-push` runs `pnpm quality-gate` (types, lint, tests). Test one hook without committing with `git hook run <hook>`.
- `typescript` in every `package.json` is an alias for `@typescript/typescript6`: tools that need a compiler API read it, while `tsc` comes from `@typescript/native` (TypeScript 7). Install both, never one.

## Context files

- [apps/customer/AGENTS.md](apps/customer/AGENTS.md): Next.js storefront
- [apps/api-astrum/AGENTS.md](apps/api-astrum/AGENTS.md): Express API gateway
- [apps/auth-astrum/AGENTS.md](apps/auth-astrum/AGENTS.md): NestJS auth service
- [apps/worker/AGENTS.md](apps/worker/AGENTS.md): mail delivery worker
- [packages/Astrum-db/AGENTS.md](packages/Astrum-db/AGENTS.md): shared Prisma schema and client

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
