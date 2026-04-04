# Architecture

**Analysis Date:** 2026-04-04

## Pattern Overview

**Overall:** Microservices with API Gateway pattern (service-oriented monolith)

The project is a monorepo with three independent servers sharing a single PostgreSQL database through a shared Prisma package. Services communicate synchronously -- the API Gateway acts as a reverse proxy for the auth service and handles all business-domain REST endpoints.

**Key Characteristics:**
- Two independent backend services (Express API Gateway + NestJS Auth)
- Shared database with Prisma ORM in a dedicated workspace package
- Token-based authentication via HTTP cookies
- Next.js 15 App Router frontend consuming both services through a fetcher hook

## Services

| Service | Name | Stack | Port | Role |
|---------|------|-------|------|------|
| API Gateway | `@astrum/api` | Express + TypeScript | `3580` | Business logic, product/cart/order/wishlist/user CRUD |
| Auth Service | `@astrum/auth` | NestJS + TypeScript | `4580` | Registration, sign-in, JWT issuance |
| Frontend | `@astrum/customer` | Next.js 15 + React 19 | `3000` | Customer-facing storefront |
| Database Package | `@astrum/db` | Prisma 7.5 | -- | Schema, migrations, Prisma client |

## Layers

### API Gateway (`apps/api-astrum/src`)

**Entry points:**
- `apps/api-astrum/src/server.ts` -- starts Express server on port 3580
- `apps/api-astrum/src/app.ts` -- Express app configuration, middleware stack, route registration

**Layers:**
1. **Presentation** -- Controller classes (`*.controller.ts`) in each module, receive Express Request/Response
2. **Routing** -- Express Router instances (`*.routes.ts`) map endpoints to controller methods
3. **Business Logic** -- Service classes (`*.service.ts`) in each module, handle domain logic and Prisma calls
4. **Data Access** -- Prisma client (`packages/Astrum-db/lib/prisma.ts`) shared across services
5. **Middleware** -- Cross-cutting concerns: `authenticateToken.ts`, `corsOptions.ts`, `validateDto.ts`

**Middleware stack (applied in order in `app.ts`):**

1. `helmet` -- security headers (cross-origin resource policy)
2. `morgan` -- HTTP request logging (dev mode)
3. `cors(corsOptions)` -- restricts to `http://localhost:3000`, credentials enabled
4. HTTP proxy for `/api/auth` -> `AUTH_SERVICE_URL` via `http-proxy-middleware`
5. `express.json` / `express.urlencoded` / `cookie-parser`
6. Route handlers with `authenticateToken` middleware for protected routes

### Auth Service (`apps/auth-astrum/src`)

**Entry point:**
- `apps/auth-astrum/src/main.ts` -- NestJS bootstrap, port 4580, Swagger UI at `/swagger`

**NestJS module structure:**
```
app.module.ts
  |-- ConfigModule (global)
  |-- AuthModule
  |     |-- AuthController (POST /auth/register, POST /auth/signin)
  |     |-- AuthService (signToken, register, signin)
  |     |-- JwtStrategy (passport-jwt, Bearer token extraction)
  |     |-- JwtGuard
  |     |-- GetUser decorator
  |-- PrismaModule
        |-- PrismaService
```

**Endpoints:**
- `POST /api/auth/register` -- Create user, return JWT (1d expiry)
- `POST /api/auth/signin` -- Verify credentials, return JWT (1d expiry)

### Frontend (`apps/customer/src`)

**Entry point:**
- `apps/customer/src/app/layout.tsx` -- Root layout with ThemeProvider, ProgressBarProvider, Toaster

**Route groups:**
- `(auth)` -- `/auth/signin`, `/auth/register` -- authentication pages
- `(content)` -- all other pages (home, catalog, product, cart, profile, orders, wishlist)

**Layers:**
1. **Pages** -- Next.js App Router route segments (`src/app/(content)/.../page.tsx`)
2. **Features** -- Feature-specific components organized by domain (`src/features/...`)
3. **Hooks** -- Data-fetching hooks using SWR + SWR Mutations (`src/hooks/...`)
4. **Shared API** -- Service clients (`src/shared/api/`)
5. **Components** -- Reusable UI (`components/ui/`), skeletons, providers, system
6. **Common** -- Types, helpers, constants, validation schemas (Zod), regexps

## Data Flow

### Authentication Flow

```
Customer Frontend                    Auth Service (NestJS)
-----------------                    ----------------------
POST /api/auth/register  ----------> POST /auth/register
  (via proxy)                          1. Validate RegisterUserDto
                                        2. Hash password (argon2)
  <-- { token, expiresIn }              3. Create User in Prisma
                                         4. Sign JWT (1d expiry)
                                         5. Return { token, expiresIn }

createSession(res.data.token)
  stores token in localStorage.__auth

Every subsequent request:
  authenticateToken middleware reads
  cookies.__auth, verifies JWT,
  attaches req.userId
```

**Frontend auth flow detail:**
1. User submits credentials via `useAuth()` hook (`apps/customer/src/hooks/auth/useAuth.ts`)
2. `useFetcher` (axios instance) posts to `/auth/register` or `/auth/signin`
3. On success, `createSession()` stores token in `localStorage.__auth`
4. `verifySession()` in server components reads the token to check auth state
5. All API requests include `withCredentials: true` on the axios instance
6. API Gateway's `authenticateToken` middleware extracts token from `req.cookies.__auth`, verifies with `jsonwebtoken`, attaches `req.userId`

### Product/Order Data Flow

```
Customer Frontend                    API Gateway (Express)                  Prisma / PostgreSQL
-----------------                    ---------------------                  --------------------
useGetRecommendations()
  GET /recommendations  ----------->  GET /api/products/recommendations
  (via fetcher)                            authenticateToken middleware
                                            ProductController.getRecommendations
                                              ProductService.getRecommendations
                                                prisma.product.findMany (cursor pagination)
  <-- { products, nextCursor,              prisma.cartItem, prisma.wishlistItem
       hasNextPage }                        lookups per product
```

**Key pattern:** The frontend uses SWR hooks (`useSWR`, `useSWRInfinite`, `useSWRMutation`) that call `useFetcher` (axios-based). Each domain has its own hook family:
- `useProducts/*` -- product queries (recommendations, categories, single product)
- `useCart/*` -- cart mutations and queries
- `useWishlist/*` -- wishlist mutations and queries
- `useUser` -- profile SWR with optimized dedupe configuration
- `useOrder/*` -- order creation and queries
- `useAuth` -- registration and sign-in

### Cart/Order Data Flow

```
POST /api/orders  -----> authenticateToken middleware
                          OrderController.createOrder
                            OrderService.createOrder
                              prisma.order.create (with nested OrderItem.create)
  <-- Order
```

The frontend `useCreateOrder` hook (`apps/customer/src/hooks/order/useCreateOrder.ts`) uses `useSWRMutation` with an `onSuccess` callback that calls `mutate("/cart")` and `mutate("/orders")` to invalidate cache.

## API Patterns

### API Gateway Route Registry (`apps/api-astrum/src/app.ts`)

| Route Prefix | Middleware | Module |
|-------------|-----------|--------|
| `/api/auth` | Proxy to auth service (no auth required) | Auth Service |
| `/api/users` | `authenticateToken` required | User |
| `/api/products` | `authenticateToken` required | Product |
| `/api/wishlist` | `authenticateToken` required | Wishlist |
| `/api/cart` | `authenticateToken` required | Cart |
| `/api/orders` | `authenticateToken` required | Order |

### Error Handling

**API Gateway:**
- `handleErrors(res, err)` -- `apps/api-astrum/src/common/helpers/errorHandler.ts`
- Maps `Error` instances to 400 BAD_REQUEST with message
- Maps unknown errors to 500 INTERNAL_SERVER_ERROR
- Each controller wraps endpoints in try/catch calling `handleErrors`

**Auth Service (NestJS):**
- `ValidationPipe` with `whitelist: true` strips unknown DTO fields
- `ForbiddenException` for auth failures (duplicate email, wrong password)
- Swagger/OpenAPI documentation auto-generated

### Pagination Pattern

Products use cursor-based pagination:
- `take: limit` (default 8)
- `cursor: { id: cursor }` for next page
- `skip: cursor ? 1 : 0`
- `nextCursor` = last item ID if result set equals limit
- Frontend uses `useSWRInfinite` to handle multi-page loading

### Auth Token Pattern

- Token stored in `localStorage.__auth` by the frontend
- Read from `req.cookies.__auth` by the `authenticateToken` middleware
- JWT payload: `{ userId: string }` (`apps/api-astrum/src/common/types/jwt.payload.ts`)
- 1-day expiration
- Same secret (`JWT_SECRET`) shared between auth service and API gateway via environment variable

## State Management

**Frontend:**
- Server state: **SWR** (`useSWR`, `useSWRInfinite`, `useSWRMutation`) with custom `useFetcher` axios instance
- Client state: minimal, derived from SWR data with `useMemo`
- Form state: **React Hook Form** with Zod validation
- Session: `localStorage.__auth` for the JWT token

**Backend:**
- Stateless -- no in-memory state
- All persistence via PostgreSQL through shared Prisma client

## Key Abstractions

### Product Selection Patterns
- `productPublicSelect` -- full product detail select (for single product view)
- `productPreviewPublicSelect` -- lightweight product preview select (for listings)
- `cartPublicSelect` / `cartActionsPublicSelect` -- cart-specific field selections
- Located in `apps/api-astrum/src/common/prisma-selects/product.select.ts`

### Prisma Client Export
- `packages/Astrum-db/lib/prisma.ts` -- creates and exports singleton `prisma` instance
- `packages/Astrum-db/lib/index.ts` -- re-exports for consumption by services
- Generated types at `apps/api-astrum/generated/prisma/` and `apps/auth-astrum/generated/prisma/`

## Database Architecture

**Single database, shared schema:** All three services connect to the same PostgreSQL instance via `DATABASE_URL`.

**Prisma ownership:** `packages/Astrum-db/` owns the schema (`prisma/schema.prisma`), runs migrations, and generates client.

**Entities:**
- `User` -- with `LastViewedProduct` relation
- `Product` -- with `Impression[]`, `ProductProperty[]`
- `WishlistItem` -- unique composite (userId, productId)
- `CartItem` -- unique composite (userId, productId), with quantity
- `Order` -- with `OrderItem[]`, `ShippingMethod` relation
- 14 enums (PaymentMethod, PaymentStatus, OrderStatus, ProductCategory, ProductVisibility, etc.)

## Cross-Cutting Concerns

**CORS:** Both services restrict origin to `http://localhost:3000`, credentials enabled.

**Logging:** `morgan` (Express, dev mode) for HTTP access logs; `console.log` in NestJS bootstrap.

**Validation:** Zod schemas (`apps/customer/src/common/zodSchemes/`) for frontend; NestJS DTO classes with class-validator for auth service; no request body validation in Express API gateway (relies on Prisma constraints).

**Security:** `helmet` on API gateway, argon2 for password hashing, JWT for auth tokens, `authenticateToken` middleware on all protected routes.

---

*Architecture analysis: 2026-04-04*
