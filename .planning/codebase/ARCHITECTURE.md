# Architecture

**Analysis Date:** 2026-04-05

## Pattern Overview

**Overall:** Multi-service monorepo (Turborepo + pnpm workspaces) with a BFF-style API gateway, dedicated auth service, customer SPA, and a single PostgreSQL database accessed through Prisma.

**Key Characteristics:**

- Three HTTP services: Express (`@astrum/api`), NestJS (`@astrum/auth`), Next.js App Router (`@astrum/customer`).
- One relational data store; schema ownership and migrations live under `packages/Astrum-db/prisma/`.
- Auth traffic to the Nest service is reverse-proxied from the Express app (`apps/api-astrum/src/app.ts`).
- JWT sessions use a shared secret; the browser stores an httpOnly cookie `__auth` set by the Next app (`apps/customer/src/common/helpers/session.ts`).

## Layers

**Presentation (customer):**

- Purpose: Server and client UI, route protection, calling backend via HTTP.
- Location: `apps/customer/src/`
- Contains: App Router pages under `apps/customer/src/app/`, feature UI under `apps/customer/src/features/`, hooks under `apps/customer/src/hooks/`.
- Depends on: Environment-configured API base URL (`NEXT_PUBLIC_API_GATEWAY_URL` in `apps/customer/src/hooks/useFetcher.ts`), `JWT_SECRET` for server-side session verification.
- Used by: End users in the browser.

**API gateway (business API + auth proxy):**

- Purpose: Terminate CORS, JSON body parsing, cookies; proxy `/api/auth` to the auth service; enforce JWT on protected REST routes.
- Location: `apps/api-astrum/src/`
- Contains: `apps/api-astrum/src/app.ts` (Express app wiring), `apps/api-astrum/src/modules/*` (domain routes/controllers/services), `apps/api-astrum/src/middlewares/`.
- Depends on: `AUTH_SERVICE_URL` for `http-proxy-middleware` (`apps/api-astrum/src/common/helpers/proxyOptions.ts`), `JWT_SECRET` for `jsonwebtoken` verification (`apps/api-astrum/src/middlewares/authenticateToken.ts`), Prisma client from `apps/api-astrum/lib/prisma.ts`.
- Used by: Customer app and any other HTTP clients targeting port `3580`.

**Auth service:**

- Purpose: Register and sign-in; issue JWT access tokens; persist users via Prisma.
- Location: `apps/auth-astrum/src/`
- Contains: NestJS modules (`apps/auth-astrum/src/app.module.ts`, `apps/auth-astrum/src/auth/auth.module.ts`), `AuthController` (`apps/auth-astrum/src/auth/auth.controller.ts`), `AuthService` (`apps/auth-astrum/src/auth/auth.service.ts`), Passport JWT strategy (`apps/auth-astrum/src/auth/strategy/jwt.strategy.ts`), `PrismaService` (`apps/auth-astrum/src/prisma/prisma.service.ts`).
- Depends on: `DATABASE_URL`, `JWT_SECRET` (via `ConfigModule`), Prisma client generated under `apps/auth-astrum/generated/prisma/`.
- Used by: Proxied through Express at `/api/auth` (see `apps/api-astrum/src/app.ts`); Swagger UI at `/swagger` on the auth app (`apps/auth-astrum/src/main.ts`).

**Data access (Prisma):**

- Purpose: ORM access to PostgreSQL with the `pg` driver and `@prisma/adapter-pg`.
- Location: Canonical schema and migrations: `packages/Astrum-db/prisma/schema.prisma`, `packages/Astrum-db/prisma/migrations/`. Per-app clients: `apps/api-astrum/lib/prisma.ts`, `apps/auth-astrum/src/prisma/prisma.service.ts`, shared singleton pattern in `packages/Astrum-db/lib/prisma.ts`.
- Contains: Generated client output configured as `output = "../generated/prisma"` in each schema file that uses that pattern.
- Depends on: `DATABASE_URL`.
- Used by: Express services and Nest `AuthService` / `PrismaService`.

## Data Flow

**Sign-in / register:**

1. Browser posts credentials to the API gateway path `/api/auth/...` (`apps/api-astrum/src/app.ts`).
2. Request proxies to Nest auth (`apps/auth-astrum/src/auth/auth.controller.ts`).
3. `AuthService` reads/writes `User` via Prisma (`apps/auth-astrum/src/auth/auth.service.ts`).
4. JWT string returned to client; Next may persist it in `__auth` via `createSession` (`apps/customer/src/common/helpers/session.ts`).

**Authenticated REST (products, cart, orders, etc.):**

1. Client sends requests with cookie `__auth` to `NEXT_PUBLIC_API_GATEWAY_URL` (see `apps/customer/src/hooks/useFetcher.ts`).
2. `authenticateToken` reads `req.cookies.__auth` and verifies with `JWT_SECRET` (`apps/api-astrum/src/middlewares/authenticateToken.ts`).
3. `req.userId` is set from the payload; controllers/services use Prisma in `apps/api-astrum/src/modules/*`.

**Server-rendered session check (Next):**

1. `middleware` (`apps/customer/src/middleware.ts`) decrypts/verifies the cookie for non-public paths using `decrypt` from `apps/customer/src/common/helpers/session.ts`.
2. Content layout may call `verifySession` (`apps/customer/src/app/(content)/layout.tsx`).

**State Management:**

- Server: React `cache` and cookies in Next (`apps/customer/src/common/helpers/session.ts`).
- Client: SWR usage in hooks (see `apps/customer/package.json`); feature hooks under `apps/customer/src/hooks/`.

## Key Abstractions

**Express module pattern:**

- Purpose: Group REST surface by domain.
- Examples: `apps/api-astrum/src/modules/user/user.routes.ts`, `user.controller.ts`, `user.service.ts` (same pattern for `product`, `wishlist`, `cart`, `order`, `reviews`).
- Pattern: `*.routes.ts` mounts `Router`; controllers are classes; DTOs use `class-validator` with `validateDto` (`apps/api-astrum/src/middlewares/validateDto.ts`).

**NestJS auth stack:**

- Purpose: Framework-native auth with Swagger and Passport JWT for future protected Nest routes.
- Examples: `apps/auth-astrum/src/auth/guard/jwt.guard.ts`, `apps/auth-astrum/src/auth/strategy/jwt.strategy.ts`.
- Pattern: `AuthModule` imports `JwtModule` (`apps/auth-astrum/src/auth/auth.module.ts`).

**Prisma client singleton:**

- Purpose: Avoid connection explosion in development.
- Examples: `packages/Astrum-db/lib/prisma.ts` (global cache when `NODE_ENV !== 'production'`).

## Entry Points

**Express API:**

- Location: `apps/api-astrum/src/server.ts`
- Triggers: `pnpm dev` / `tsx watch` via `apps/api-astrum/package.json`.
- Responsibilities: Listen on port `3580`, mount `app` from `apps/api-astrum/src/app.ts`.

**NestJS auth:**

- Location: `apps/auth-astrum/src/main.ts`
- Triggers: `nest start` scripts in `apps/auth-astrum/package.json`.
- Responsibilities: Listen on port `4580`, global prefix `/api`, Swagger at `/swagger`, CORS for `http://localhost:3000`.

**Next.js customer:**

- Location: `apps/customer/src/app/layout.tsx`, route segments under `apps/customer/src/app/`
- Triggers: `next dev` / `next start` per `apps/customer/package.json`.
- Responsibilities: App Router UI; middleware in `apps/customer/src/middleware.ts`.

**Prisma CLI (migrations / generate):**

- Location: Root scripts delegate to `@astrum/db` (`package.json` at repo root).
- Triggers: `pnpm prisma:migrate:dev`, `pnpm db:generate`, etc.
- Responsibilities: Apply migrations from `packages/Astrum-db/prisma/migrations/`.

## Error Handling

**Strategy:** Per-handler try/catch in services/controllers; shared helper for generic Express errors (`apps/api-astrum/src/common/helpers/errorHandler.ts`). Nest uses standard exceptions (`ForbiddenException` in `apps/auth-astrum/src/auth/auth.service.ts`).

**Patterns:**

- HTTP status via `http-status-codes` on the Express API (`apps/api-astrum/src/middlewares/authenticateToken.ts`).
- Validation errors surfaced as JSON messages from `validateDto` pipeline.

## Cross-Cutting Concerns

**Logging:** `morgan('dev')` on the Express app (`apps/api-astrum/src/app.ts`). Console logging in Next session helpers on verification failure (`apps/customer/src/common/helpers/session.ts`).

**Validation:** `class-validator` DTOs + `ValidationPipe` in Nest (`apps/auth-astrum/src/main.ts`); Express uses `validateDto` with `class-transformer`/`class-validator` (`apps/api-astrum/src/middlewares/validateDto.ts`).

**Authentication:** JWT signed in Nest (`apps/auth-astrum/src/auth/auth.service.ts`); verified on Express with `jsonwebtoken` (`apps/api-astrum/src/middlewares/authenticateToken.ts`); Next verifies with `jose` for middleware and RSC (`apps/customer/src/common/helpers/session.ts`).

---

*Architecture analysis: 2026-04-05*
