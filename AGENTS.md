# Astrum

## Stack

- **Language / Runtime**: TypeScript 7 (`tsc`) with the TypeScript 6 compiler API aliased as `typescript` for eslint and ts-jest, Node 24
- **Framework**: Next.js 16 App Router (storefront), Express 5 (API gateway), NestJS 11 (auth service)
- **Key dependencies**: Prisma 7 with `@prisma/adapter-pg`, React 19.3, Tailwind CSS 4, Zod 4, class-validator
- **Package manager**: pnpm 12.8.1 workspaces with Turborepo 2.11; Postgres 16 in Docker
- **Known pin**: `@nestjs/*` stays on 11.2.8 because NestJS 12 is ESM-only; Prisma stays on 7.10.1 because the `latest` tag is a release candidate. See `docs/adr/0002-toolchain-baseline.md`.

## Build approach

<TBD, set by /scope>

## Commands

```bash
pnpm install                # install every workspace
pnpm dev                    # docker start astrum-db, then turbo dev (ports 3000, 3580, 4580)
pnpm build                  # turbo build
pnpm check-types            # tsc --noEmit per package
pnpm lint                   # real in customer and auth, echo stubs elsewhere
pnpm test                   # turbo test (jest and vitest per package)
pnpm quality-gate           # check-types, lint and test
pnpm db:generate            # prisma generate into packages/Astrum-db/generated
pnpm prisma:migrate:dev     # create a migration
pnpm db:up                  # Postgres container only
pnpm docker:prod:up         # full stack in replicas behind Caddy (ports 80/443)
pnpm docker:prod:down       # stop the stack
pnpm docker:prod:logs       # follow every service log
pnpm docker:prod:scale      # rebuild and restart the api replicas only
```

## Deployment topology

`docker-compose.prod.yml` + `Caddyfile` are the deployable shape; `docker-compose.yml` stays the dev-only Postgres.

```
browser -> proxy:80/443 -> customer x2
customer -> proxy:3580  -> api x3 -> auth x1 -> db
```

- Runtime configuration comes from `.env.prod` (template: `.env.prod.example`); service hostnames inside the network are `db`, `auth`, `api`, `proxy`.
- Only the proxy publishes ports. `api:3580` and `auth:4580` are reachable inside the `astrum` network only.
- `migrate` is a one-shot service that runs before anything else starts.
- Replicas are discovered by Caddy through `dynamic a <service> <port>`; plain `reverse_proxy service:port` balances nothing.
- `GET /health` exists on all three services and is the only probe URL.
- The stack shares the Postgres volume `astrum_astrum-db-data` with the dev container (`POSTGRES_VOLUME` in `.env`). Never run `pnpm dev` and `pnpm docker:prod:up` at the same time — two postmasters on one data directory.
- See `docs/adr/0003-container-topology-and-load-balancing.md`.

## Rules

- Layout is fixed: `apps/*` are runnable services, `packages/*` are shared libraries. A shared package never imports from an app.
- The browser talks only to `apps/customer`; customer reaches the gateway through the `/api-gateway/*` rewrite; the gateway reaches auth. A new backend integration is proxied through `apps/api-astrum`.
- The session lives in the `__auth` HttpOnly cookie, written by customer `src/common/helpers/session.ts` and verified by the gateway middleware. There is no Authorization header.
- Commits follow Conventional Commits with type and scope in English and subject in Russian; the allowed types are enforced in `commitlint.config.js`.
- React component files use PascalCase names, request logic lives in dedicated hooks, and code carries no comments unless the owner asks for them.
- Do not create git commits unless explicitly requested.
- Run `pnpm db:generate` after a fresh install or a schema change; type checks and builds fail while the generated client is missing.
- Hooks are live: `commit-msg` validates the format through commitlint, `pre-commit` formats staged files and runs `pnpm check-types`, `pre-push` runs `pnpm quality-gate`. Test one hook without committing with `git hook run <hook>`.
- `typescript` in every `package.json` is an alias for `@typescript/typescript6`: tools that need a compiler API read it, while `tsc` comes from `@typescript/native` (TypeScript 7). Install both, never one.

## Context files

- [apps/customer/AGENTS.md](apps/customer/AGENTS.md): Next.js storefront
- [apps/api-astrum/AGENTS.md](apps/api-astrum/AGENTS.md): Express API gateway
- [apps/auth-astrum/AGENTS.md](apps/auth-astrum/AGENTS.md): NestJS auth service
- [packages/Astrum-db/AGENTS.md](packages/Astrum-db/AGENTS.md): shared Prisma schema and client

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
