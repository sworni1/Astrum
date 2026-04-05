# External Integrations — Astrum

## Database Layer

### PostgreSQL 13

- **Connection**: `DATABASE_URL` environment variable (single global env in `turbo.json`)
- **Driver**: `pg` 8.20.0 (native PostgreSQL node driver)
- **Prisma Adapter**: `@prisma/adapter-pg` 7.5.0 — uses the pg driver wrapped in Prisma's driver adapter pattern
- **Network**: Port `5432` exposed via Docker, shared `astrumnetwork` network
- **Container**: `astrum-db` (postgres:13 image)
- **Environment file**: `packages/Astrum-db/.env`

### Prisma ORM 7.5.0

- **Schema location**: `packages/Astrum-db/prisma/schema.prisma`
- **Client output**: `generated/prisma/` within the package
- **Shared across**: All three apps (api, auth, customer) depend on `@astrum/db` for Prisma types and client
- **Migrations**: `prisma migrate dev` / `prisma migrate deploy` scripts in root
- **Studio**: `pnpm prisma:studio` for database browser UI
- **Seeding**: Excel-based seeding via `tsx prisma/seedFromExcel.ts` using `xlsx` library

### Database Connection Pattern

```
@astrum/db → @prisma/client + @prisma/adapter-pg → pg driver → PostgreSQL 13
```

The `@astrum/db` package re-exports both the full `@prisma/client` and a singleton `PrismaClient` instance with the pg adapter. The singleton uses `globalThis` guard to prevent multiple connections in dev/watch mode.

## Internal Service Communication

### API Gateway Pattern

- **API service** (`@astrum/api`): Port `3580`
  - Has `http-proxy-middleware` suggesting it proxies certain routes
  - Likely proxies auth-related endpoints to the auth service
- **Auth service** (`@astrum/auth`): Port `4580`
  - Separate NestJS service handling authentication
  - Has `@nestjs/swagger` for OpenAPI documentation
- **Customer frontend** (`@astrum/customer`): Port `3000`
  - `NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:3580/api` — calls API through gateway URL
  - Has both Apollo Client (GraphQL) and axios (REST) — suggesting dual API exposure patterns
  - Uses `swr` for additional data fetching scenarios

### Inter-service network

All services share the Docker network `astrumnetwork` (declared as `external: true`, must exist before `docker compose up`).

## Authentication & Authorization

### JWT-based auth flow

- **Secret**: `JWT_SECRET` in environment (`.env` files) — same secret shared across api and customer
- **Password hashing**: `argon2` used in both api and auth services
- **Auth service**: Full NestJS + Passport + JWT strategy
  - `JwtStrategy` extracts Bearer tokens from `Authorization` header
  - Validates JWT payload against DB via Prisma
  - Removes `passwordhash` from returned user object
- **API service**: `jsonwebtoken` for verification, custom middleware
- **Customer**: `jose` (browser-safe JWT), `jwt-decode` for client-side decoding, `jsonwebtoken` for server-side Next.js operations

## External Image Sources (Customer Frontend)

Next.js `remotePatterns` configuration allows images from:

| Source | Pattern | Purpose |
|--------|---------|---------|
| Flowbite | `flowbite.s3.amazonaws.com` | UI component gallery images |
| BundUI | `bundui-images.netlify.app` | UI component images |
| Unsplash | `images.unsplash.com` | Stock photos |
| Magazilla | `magazilla.ru` / `mzimg.com` | Product images (likely scraped or affiliate) |

## Third-Party Payment References (Schema Level)

Prisma enum `PaymentMethod` includes:

- `CASH`
- `CARD_ON_DELIVERY`
- `ONLINE_CARD`
- `PAYPAL` — referenced but no PayPal SDK integration found
- `STRIPE` — referenced but no Stripe SDK integration found

These appear to be schema-ready but not yet wired to actual payment provider SDKs.

## DevOps & Infrastructure

### Docker Compose

4 services orchestrated via `docker-compose.yml`:

| Service | Container | Port | Base Image | Env File |
|---------|-----------|------|------------|----------|
| PostgreSQL | `astrum-db` | 5432 | postgres:13 | `packages/Astrum-db/.env` |
| API | `astrum-backend` | 3580 | node:18-alpine | `apps/api-astrum/.env.prod` |
| Auth | `auth-service` | 4580 | node:18-alpine | `apps/auth-astrum/.env.prod` |
| Customer | `frontend-astrum-customer` | 3000 | node:20-alpine | `apps/customer/.env.production` |

### Git Hooks (Husky)

- **Pre-commit**: JSON validation on `*.json` files via `lint-staged`
- **prepare**: `husky` install runs on `pnpm install`

### Health Check Script

`pnpm mcp:check` runs `./scripts/mcp-health-check.ps1` — PowerShell script for verifying MCP server connectivity.

## Development Tooling

| Tool | Purpose |
|------|---------|
| ESLint 8 (api/auth) / ESLint 9 (customer) | Code linting |
| Prettier 3.2–3.4 | Code formatting |
| Jest 29 (auth service) | Unit/integration tests |
| TypeScript 5.9.3 | Type checking across all packages |
| tsx 4.21.0 | Fast TS/JS execution (dev + seed scripts) |

## Missing / Not Yet Integrated

- **No GraphQL server** — Apollo Client is installed on the customer frontend, but no GraphQL server schema or resolver was found in the backend packages. This may be planned for future development.
- **No Stripe SDK** — Payment enum references `STRIPE` but `stripe` npm package is not installed.
- **No PayPal SDK** — Payment enum references `PAYPAL` but no PayPal integration exists.
- **No email service** — No nodemailer, SendGrid, Resend, or similar email sending library.
- **No Redis/caching** — No Redis client installed; caching may need to be added.
- **No file storage SDK** — Image references suggest S3 usage (Flowbite gallery), but no AWS SDK is installed for product image uploads.
- **No E2E testing** — Playwright listed in rules but not in dependencies.
- **No API testing framework** — For the Express api service (auth service has Jest + Supertest).

## Environment Variables Summary

| Variable | Required By | Purpose |
|----------|-------------|---------|
| `DATABASE_URL` | All packages via Prisma | PostgreSQL connection string |
| `JWT_SECRET` | api + customer | JWT token signing/verification |
| `NEXT_PUBLIC_API_GATEWAY_URL` | customer frontend | Backend API URL |
| `NODE_ENV` | All packages | Environment mode |
