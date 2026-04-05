# Technology Stack — Astrum

## Monorepo Infrastructure

| Tool | Version | Purpose |
|------|---------|---------|
| pnpm | 10.4.0 | Package manager with workspace catalogs |
| Turborepo | 2.8.18 | Build orchestration, task caching, dependency pipelines |
| Husky | 9.1.7 | Git pre-commit hooks |
| lint-staged | 16.4.0 | Run linters on staged files only |

**Build pipeline ordering** (from `turbo.json`):
- `build` depends on `^build` (dependent packages built first) and `^db:generate` (Prisma client generation before build)
- `dev` depends on `^db:generate` — Prisma client must exist before any app starts
- `lint` depends on `^build` — type-check against compiled artifacts

## Language & Compiler

- **TypeScript 5.9.3** — across all four packages
- **Target**: ES2016 (api), ES2021 (auth), ES2017 (customer)
- **Strict mode**: enabled globally for api and customer; auth has `strictNullChecks: false`, `noImplicitAny: false`
- **Module systems**:
  - api-astrum: CommonJS (`tsc` compilation)
  - auth-astrum: CommonJS (NestJS CLI)
  - customer: ESNext (Next.js bundler)
  - Astrum-db: ESM (`"type": "module"`)

## Applications

### 1. API Service (`apps/api-astrum`) — `@astrum/api`

Plain Express server, no framework wrapper.

| Layer | Library | Version | Purpose |
|-------|---------|---------|---------|
| Runtime | Express | 4.21.2 | HTTP routing |
| Runtime | tsx | 4.21.0 | Development-time TS execution |
| Security | Helmet | 8.0.0 | HTTP security headers |
| Security | cors | 2.8.5 | CORS middleware |
| Auth | jsonwebtoken | 9.0.2 | JWT creation/verification |
| Auth | argon2 | 0.41.1 | Password hashing |
| Validation | class-validator | 0.14.1 | DTO validation decorators |
| Validation | class-transformer | 0.5.1 | DTO transformation |
| Logging | morgan | 1.10.0 | HTTP request logging |
| Utility | cookie-parser | 1.4.7 | Cookie parsing |
| Utility | http-proxy-middleware | 3.0.3 | Proxy requests (likely to auth service) |
| Utility | http-status-codes | 2.3.0 | HTTP status code constants |

### 2. Auth Service (`apps/auth-astrum`) — `@astrum/auth`

NestJS framework with modular architecture.

| Layer | Library | Version | Purpose |
|-------|---------|---------|---------|
| Framework | NestJS (core/common/platform-express) | 10.3.x | Dependency injection, decorators, HTTP |
| Auth | @nestjs/jwt | 10.2.0 | JWT handling integration |
| Auth | @nestjs/passport | 10.0.3 | Passport.js integration |
| Auth | passport | 0.7.0 | Authentication middleware |
| Auth | passport-jwt | 4.0.1 | JWT authentication strategy |
| Auth | argon2 | 0.40.3 | Password hashing |
| Validation | class-validator | 0.14.1 | Request validation |
| Validation | class-transformer | 0.5.1 | DTO transformation |
| API docs | @nestjs/swagger | 7.3.0 | OpenAPI/Swagger documentation |
| Utility | compression | 1.7.4 | Response compression |
| Testing | Jest | 29.7.0 | Unit/integration testing |
| Testing | supertest | 6.3.4 | HTTP endpoint testing |

### 3. Customer Frontend (`apps/customer`) — `@astrum/customer`

Next.js 15 App Router with shadcn/ui component system.

| Layer | Library | Version | Purpose |
|-------|---------|---------|---------|
| Framework | Next.js | 15.4.2 | Full-stack React framework, SSR/SSG |
| UI | React | 19.1.0 | UI component library |
| UI | React DOM | 19.1.0 | DOM rendering |
| Styling | TailwindCSS | 4.1.11 | Utility-first CSS framework |
| Styling | PostCSS | 8.5.6 | CSS processing |
| Components | Radix UI primitives | 1.1–1.2 | Accessible headless components (accordion, dialog, dropdown, select, popover, checkbox, toast, avatar, separator, alert-dialog, aspect-ratio, label, slot) |
| Components | shadcn/ui | 4.1.0 | Pre-built Radix-based component library |
| Components | class-variance-authority | 0.7.1 | Variant-based component styling |
| Components | lucide-react | 0.469.0 | Icon library |
| Components | embla-carousel-react | 8.6.0 | Carousel/slider |
| Components | cmdk | 1.1.1 | Command palette component |
| Components | sonner | 2.0.7 | Toast notifications |
| Components | react-icons | 5.4.0 | Additional icon packs |
| Data fetching | Apollo Client | 3.13.8 | GraphQL client with cache |
| Data fetching | Apollo Client Integration Next.js | 0.12.2 | SSR GraphQL integration for Next.js |
| Data fetching | SWR | 2.2.5 | Alternative data fetching (stale-while-revalidate) |
| Data fetching | axios | 1.7.9 | HTTP client for REST calls |
| Forms | react-hook-form | 7.60.0 | Form state and validation |
| Form validation | @hookform/resolvers | 3.10.0 | Zod resolver for RHF |
| Validation | Zod | 3.25.76 | Schema validation |
| Date handling | date-fns | 3.6.0 | Date formatting/manipulation |
| Date handling | dayjs | 1.11.13 | Lightweight date library |
| Date handling | react-day-picker | 9.9.0 | Calendar component |
| State | next-themes | 0.4.6 | Light/dark theme switching |
| State | jose | 6.0.12 | JWT/JOSE utilities (browser-safe) |
| State | jsonwebtoken | 9.0.2 | Server-side JWT handling |
| State | jwt-decode | 4.0.0 | JWT payload decoding |
| UX | use-debounce | 10.0.4 | Debounced React hooks |
| UX | react-intersection-observer | 9.16.0 | Intersection Observer for scroll-based effects |
| UX | @bprogress/next | 3.2.12 | Navigation progress bar |
| Utility | clsx | 2.1.1 | Conditional class names |
| Utility | tailwind-merge | 2.6.0 | Tailwind class conflict resolution |
| Linting | ESLint 9 + eslint-config-next | 15.4.2 | Linting rules |
| Formatting | Prettier 3.4.2 + sort-imports plugin | 5.2.0 | Code formatting |

### 4. Database Package (`packages/Astrum-db`) — `@astrum/db`

Shared Prisma client and schema. Not a runtime service — a library consumed by all three apps.

| Layer | Library | Version | Purpose |
|-------|---------|---------|---------|
| ORM | Prisma | 7.5.0 | Database schema + query builder |
| ORM | @prisma/client | 7.5.0 | Generated type-safe query client |
| Adapters | @prisma/adapter-pg | 7.5.0 | Pg driver adapter for edge-compatible Prisma |
| Driver | pg | 8.20.0 | PostgreSQL node driver |
| Seeding | xlsx | 0.18.5 | Excel file parsing for bulk seed data |
| Runtime | tsx | 4.21.0 | Seed script execution |

### Shared Domain Models (Prisma Schema)

Single `schema.prisma` copied to api and auth packages. Covers:

- **User** — auth profiles with email/passwordhash, gender, categories of interest, last-viewed products
- **Product** — catalog with properties, impressions, pricing, inventory, visibility, categories
- **Cart/Wishlist** — user product collections
- **Order** — order management with items, shipping methods, payment tracking
- **Impression** — product reviews with stars, comments, photos

10 enums cover: payment methods/statuses, order statuses, product categories, currencies, product states, property labels.

## External Libraries & Utilities

| Category | Library | Version | Used In | Notes |
|----------|---------|---------|---------|-------|
| Password hashing | argon2 | 0.40.3 (auth), 0.41.1 (api) | Both backends | Version drift — should be aligned |
| JWT | jsonwebtoken | 9.0.2 | api + customer | Shared secret validation |
| Environment | dotenv | 17.3.1 | All packages | `.env` file loading |
| Node types | @types/node | 20.19/22.19/25.5 | Per-package | Version drift across packages |
| Excel processing | xlsx | 0.18.5 | Astrum-db (seed) | Excel bulk data seeding from spreadsheet |

## Config Notables

- **next.config.ts**: `output: "standalone"` for Docker-optimized builds, ESLint ignored during builds, remote image patterns from Unsplash, S3, magazilla/mzimg
- **Turborepo**: `DATABASE_URL` passed as global env variable
- **pnpm catalogs**: Prisma pinned via catalog for consistent versions
- **Docker**: api/auth use Node 18-alpine, customer uses Node 20-alpine (version mismatch)
- **Prisma config**: `tsconfig.json` has `noUnusedLocals: true`, `noUnusedParameters: true` for customer; auth has these checks disabled
