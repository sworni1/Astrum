# 0001: Monorepo with a gateway and a separate auth service

- **Status**: Accepted
- **Date**: 2026-11-02
- **Deciders**: project owner
- **Related**: [AGENTS.md](../../AGENTS.md)

## Context

The store needs a browser client, business endpoints, and authentication. Authentication has its own dependencies (argon2, JWT signing, passport) and its own security surface, while the catalogue, cart, wishlist and orders share one database and one Prisma schema. Every service must read the same tables, so a shared package is the only way to keep the schema in one place.

A single Next.js application with route handlers would be simpler, but it would put password hashing and the session secret inside the same process that renders pages, and it would make every future service depend on the front end.

## Options considered

1. **One Next.js app** with server actions and route handlers. Cheapest to start, weakest boundary, secrets and UI share a process.
2. **Two services without a gateway**: the browser calls the auth service and the API directly. Two CORS surfaces, two cookie domains, duplicated session logic in the client.
3. **Three services behind a gateway** (chosen): customer renders, the gateway owns business routes, auth owns identity.

## Decision

The repository is a pnpm workspace with Turborepo:

- `apps/customer` is the only service the browser talks to. It proxies `/api-gateway/*` to the gateway through a Next rewrite and stores the session in the `__auth` HttpOnly cookie.
- `apps/api-astrum` is the gateway. It mounts business routers under `/api`, verifies the `__auth` JWT, and proxies `/api/auth/*` to the auth service, so the browser never learns the auth service URL.
- `apps/auth-astrum` owns registration, sign in, refresh and token signing. It is reached only through the gateway.
- `packages/Astrum-db` owns `prisma/schema.prisma` and the generated client. Every service imports `@astrum/db`, never a relative path.

Services do not import each other's source. A new integration goes through the gateway.

## Consequences

- **Positive**: one schema, one session cookie, one CORS surface, and services deploy independently. Secrets stay out of the rendering process. A new backend is added by mounting a router, not by touching the client.
- **Negative**: three processes to run locally, ports 3000, 3580 and 4580 must stay free, and a change touching the schema invalidates the generated client for every package, so `pnpm db:generate` is part of the pipeline.
- **Follow ups**: keep the cookie name in sync across `customer/src/common/helpers/session.ts`, `api-astrum/src/middlewares/authenticateToken.ts` and the auth service; add a spec before introducing a fourth service.
