# Codebase Structure

**Analysis Date:** 2026-04-04

## Monorepo Overview

Managed by **Turborepo** + **pnpm workspaces**. Three apps and one shared package.

```
E:\Astrum\Astrum/
├── apps/                        # Application packages
│   ├── api-astrum/              # @astrum/api -- Express API gateway (port 3580)
│   ├── auth-astrum/             # @astrum/auth -- NestJS auth service (port 4580)
│   └── customer/                # @astrum/customer -- Next.js 15 storefront (port 3000)
├── packages/
│   └── Astrum-db/               # @astrum/db -- Prisma schema, migrations, client
├── docs/                        # Project documentation
├── postman/                     # Postman collections for API testing
├── scripts/                     # Utility scripts
├── plugins/                     # Plugin system
├── package.json                 # Root workspace config, shared scripts
├── pnpm-workspace.yaml          # Workspace definition
├── turbo.json                   # Turborepo pipeline config
└── docker-compose.yml           # All services orchestration
```

## Directory Purposes

### `apps/api-astrum/`

Express API Gateway -- the primary backend handling all business-domain CRUD operations.

```
apps/api-astrum/
├── src/
│   ├── server.ts              # Entry point -- starts Express on port 3580
│   ├── app.ts                 # Express app: middleware stack + route registration
│   ├── middlewares/
│   │   ├── authenticateToken.ts  # JWT verification from cookie, attaches req.userId
│   │   ├── corsOptions.ts        # CORS configuration for localhost:3000
│   │   └── validateDto.ts        # Request body validation middleware
│   ├── modules/
│   │   ├── cart/               # Cart CRUD operations
│   │   │   ├── cart.controller.ts
│   │   │   ├── cart.routes.ts
│   │   │   ├── cart.service.ts
│   │   │   └── dto/
│   │   ├── order/              # Order creation and queries
│   │   │   ├── order.controller.ts
│   │   │   ├── order.routes.ts
│   │   │   ├── order.service.ts
│   │   │   └── dto/
│   │   ├── product/            # Product queries and creation
│   │   │   ├── product.controller.ts
│   │   │   ├── product.routes.ts
│   │   │   ├── product.service.ts
│   │   │   └── dto/
│   │   ├── user/               # User profile management
│   │   │   ├── user.controller.ts
│   │   │   ├── user.routes.ts
│   │   │   ├── user.service.ts
│   │   │   └── dto/
│   │   └── wishlist/           # Wishlist CRUD operations
│   │       ├── wishlist.controller.ts
│   │       ├── wishlist.routes.ts
│   │       ├── wishlist.service.ts
│   │       └── dto/
│   └── common/
│       ├── helpers/
│       │   ├── errorHandler.ts       # Standardized error response handler
│       │   ├── getWishlistAndCart.ts # Shared Prisma queries for wishlist/cart lookups
│       │   ├── productCategoryMap.ts # String-to-enum mapping for URL categories
│       │   └── proxyOptions.ts       # http-proxy-middleware factory for auth proxy
│       ├── prisma-selects/
│       │   └── product.select.ts     # Reusable Prisma select objects
│       └── types/
│           └── jwt.payload.ts        # JWT payload type { userId: string }
├── generated/prisma/            # Generated Prisma client types (build output)
├── prisma/                      # Prisma config mirror
├── dist/                        # Compiled JS (build output)
└── .env                         # Environment variables (not committed)
```

### `apps/auth-astrum/`

NestJS Authentication -- independent service handling registration, sign-in, JWT issuance.

```
apps/auth-astrum/
├── src/
│   ├── main.ts                # NestJS bootstrap (port 4580, Swagger, ValidationPipe)
│   ├── app.module.ts          # Root module: ConfigModule + AuthModule + PrismaModule
│   ├── auth/
│   │   ├── auth.controller.ts     # POST /auth/register, POST /auth/signin
│   │   ├── auth.service.ts        # signToken(), register(), signin()
│   │   ├── auth.module.ts         # Auth module definition
│   │   ├── dto/
│   │   │   ├── dto.user.ts        # RegisterUserDto, SignInUserDto with class-validator
│   │   │   └── index.ts           # Barrel export
│   │   ├── guard/
│   │   │   ├── jwt.guard.ts       # AuthGuard('jwt') wrapper
│   │   │   └── index.ts
│   │   ├── strategy/
│   │   │   ├── jwt.strategy.ts    # passport-jwt: Bearer token extraction, user lookup
│   │   │   └── index.ts
│   │   └── decorator/
│   │       ├── user.decorator.ts  # @GetUser() param decorator
│   │       └── index.ts
│   └── prisma/
│       ├── prisma.service.ts      # PrismaClient wrapper service
│       ├── prisma.module.ts       # Prisma module
│       └── prisma.service.spec.ts
├── generated/prisma/            # Generated Prisma client types
├── prisma/                      # Prisma config mirror
├── test/                        # Jest test files
├── dist/                        # Compiled output
└── .env                         # Environment variables (JWT_SECRET, DATABASE_URL)
```

### `apps/customer/`

Next.js 15 App Router storefront -- customer-facing frontend.

```
apps/customer/
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout: ThemeProvider, ProgressBarProvider, Toaster
│   │   ├── index.css                # Global styles
│   │   ├── not-found.tsx            # 404 page
│   │   ├── (auth)/                  # Route group: authentication pages (no Navbar/Footer)
│   │   │   └── auth/
│   │   │       ├── layout.tsx           # Centered auth layout
│   │   │       ├── signin/page.tsx      # Sign-in page
│   │   │       └── register/page.tsx    # Registration page
│   │   └── (content)/             # Route group: main storefront
│   │       ├── layout.tsx             # Navbar + children + Footer, verifySession guard
│   │       ├── page.tsx               # Home page
│   │       ├── cart/page.tsx          # Shopping cart
│   │       ├── wishlist/page.tsx      # Wishlist
│   │       ├── profile/page.tsx       # User profile management
│   │       ├── orders/page.tsx        # Orders list
│   │       ├── orders/[orderId]/page.tsx  # Single order detail
│   │       ├── products/[productId]/page.tsx  # Single product detail
│   │       ├── categories/page.tsx    # All categories overview
│   │       └── categories/[category]/page.tsx  # Category detail
│   ├── common/                     # Shared types, helpers, validation
│   │   ├── types/
│   │   │   ├── auth.types.ts        # SignUpCredentials, SignInCredentials, Gender
│   │   │   ├── product.types.ts     # Product-related types
│   │   │   ├── order.types.ts       # Order-related types
│   │   │   ├── user.types.ts        # User profile types
│   │   │   └── index.ts             # Barrel export
│   │   ├── helpers/
│   │   │   ├── session.ts           # createSession(), verifySession(), deleteSession()
│   │   │   ├── getCurrencyEmoji.ts
│   │   │   ├── getKeyProductsByCategory.ts
│   │   │   ├── getKeyRecommendations.ts
│   │   │   ├── showToast.tsx
│   │   │   ├── isCategoryExists.ts
│   │   │   └── index.ts
│   │   ├── constants/
│   │   │   ├── category.list.ts     # Product category definitions
│   │   │   ├── swr.ts               # SWR config constants (SWR_INFINITE_CONFIG)
│   │   │   └── index.ts
│   │   ├── regexp/
│   │   │   ├── email.regexp.ts
│   │   │   └── index.ts
│   │   ├── zodSchemes/
│   │   │   ├── auth.scheme.ts       # Zod auth validation schemas
│   │   │   ├── checkout.scheme.ts   # Checkout form schema
│   │   │   ├── edit-password.scheme.ts
│   │   │   ├── edit-profile.scheme.ts
│   │   │   └── index.ts
│   │   └── dto/
│   │       └── update-user.dto.ts
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                       # shadcn/ui components (button, card, dialog, etc.)
│   │   ├── providers/                # Context providers (Theme, ProgressBar)
│   │   ├── skeletons/                # Loading skeleton components
│   │   ├── system/                   # System components (NotFound)
│   │   ├── OptimizedImage.tsx        # Image optimization component
│   │   ├── ThemeSwitcher.tsx         # Theme toggle
│   │   └── index.ts                  # Barrel export
│   ├── features/                     # Feature components (organized by domain)
│   │   ├── auth/
│   │   │   ├── SignIn/index.tsx      # Sign-in form
│   │   │   ├── Register/index.tsx    # Registration form
│   │   │   └── index.ts
│   │   ├── general/
│   │   │   ├── AcmeLogo/index.tsx
│   │   │   ├── ProductCard/          # Reusable product card with actions
│   │   │   │   ├── index.tsx
│   │   │   │   └── actions/
│   │   │   │       ├── AddToCartWithQuantity/
│   │   │   │       └── ToggleWishlistItemButton/
│   │   │   └── index.ts
│   │   ├── layout/
│   │   │   ├── Navbar/               # Main navigation bar
│   │   │   │   ├── index.tsx
│   │   │   │   ├── MobileMenuSheet/
│   │   │   │   ├── NavItem/
│   │   │   │   └── Searchbar/
│   │   │   ├── Footer/index.tsx
│   │   │   └── index.ts
│   │   └── pages/                    # Page-level feature components
│   │       ├── Home/                 # Home page sections
│   │       │   ├── components/
│   │       │   │   ├── HeroSection/
│   │       │   │   ├── Recommendations/
│   │       │   │   └── PromoSection/
│   │       │   └── index.tsx
│   │       ├── Cart/                 # Cart page with CheckoutForm
│   │       │   ├── components/
│   │       │   │   ├── CartCard/
│   │       │   │   └── CheckoutForm/
│   │       │   └── index.tsx
│   │       ├── Categories/
│   │       │   └── CategoryPage/
│   │       ├── ProductOverview/
│   │       │   ├── index.tsx
│   │       │   └── ProductGallery/
│   │       ├── Profile/
│   │       │   ├── index.tsx
│   │       │   └── actions/
│   │       │       ├── EditProfileForm/
│   │       │       ├── ChangePasswordForm/
│   │       │       ├── DeleteAccountForm/
│   │       │       └── LogOutForm/
│   │       ├── Orders/
│   │       │   ├── index.tsx
│   │       │   └── OrderCard/
│   │       │   └── OrderPage/
│   │       └── WishList/index.tsx
│   ├── shared/                       # Truly shared logic (cross-cutting)
│   │   └── api/
│   │       ├── order.service.ts
│   │       └── types/
│   │           └── order.types.ts
│   └── hooks/                        # Custom React hooks (domain-organized)
│       ├── useFetcher.ts             # Axios-based fetcher for SWR
│       ├── useInfiniteScroll.ts      # Infinite scroll hook
│       ├── useLogOut.ts              # Logout logic
│       ├── auth/
│       │   ├── useAuth.ts            # Registration + sign-in logic
│       │   └── index.ts
│       ├── user/
│       │   ├── useUser.ts            # Profile SWR (query, update, delete)
│       │   └── index.ts
│       ├── order/
│       │   ├── useCreateOrder.ts     # Order creation (SWR mutation)
│       │   ├── useGetOrderById.ts    # Single order query
│       │   ├── useGetOrders.ts       # Orders list query
│       │   ├── useGetShippingMethods.ts
│       │   ├── useUpdateOrderStatus.ts
│       │   ├── useUpdateOrderItemStatus.ts
│       │   └── index.ts
│       └── product/
│           ├── useProducts/          # Product queries
│           │   ├── useGetRecommendations.ts  (useSWRInfinite)
│           │   ├── useGetCategoryProducts.ts (useSWRInfinite)
│           │   ├── useGetProduct.ts       (useSWR)
│           │   └── index.ts
│           ├── useCart/              # Cart mutations
│           │   ├── useAddProductToCart.ts  (useSWRMutation)
│           │   ├── useChangeProductCartQuantity.ts
│           │   ├── useDeleteProductFromCart.ts
│           │   ├── useGetCart.ts    (useSWR)
│           │   └── index.ts
│           └── useWishlist/         # Wishlist mutations
│               ├── useAddProductToWishlist.ts
│               ├── useDeleteProductFromWishlist.ts
│               ├── useGetWishlist.ts
│               └── index.ts
├── public/                          # Static assets
│   └── images/                      # Product/brand images
├── .next/                           # Next.js build (generated)
└── components.json                  # shadcn/ui configuration
```

### `packages/Astrum-db/`

Prisma package -- database schema, migrations, client generation.

```
packages/Astrum-db/
├── prisma/
│   ├── schema.prisma               # Database schema (models, enums, relations)
│   ├── migrations/                 # Prisma migration history
│   │   ├── 20260309193510_init/
│   │   │   └── migration.sql
│   │   ├── 20260310122948_add_subcategory_office_extend_props/
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   ├── productSeeds.js             # Product seeding script
│   ├── prisma_seed_products.js     # Seed helper
│   └── seedFromExcel.ts            # Excel import script for product data
├── lib/
│   ├── prisma.ts                   # PrismaClient singleton export
│   └── index.ts                    # Barrel export
├── generated/prisma/               # Generated Prisma types (build output)
├── prisma.config.ts                # Prisma v7 configuration
├── package.json                    # @astrum/db package definition
└── .env                            # DATABASE_URL (not committed)
```

## Naming Conventions

**Files:**
- Controllers: `*.controller.ts` (e.g., `product.controller.ts`)
- Services: `*.service.ts` (e.g., `auth.service.ts`)
- Routes: `*.routes.ts` (e.g., `cart.routes.ts`)
- DTOs: `*.dto.ts` inside `dto/` directories (e.g., `create-product.dto.ts`)
- Helpers: camelCase (e.g., `errorHandler.ts`, `getWishlistAndCart.ts`)
- Next.js pages: `page.tsx`, `layout.tsx` (App Router convention)
- React hooks: `useXxx.ts` or `index.ts` inside `useXxx/` directories
- Components: directories with `index.tsx` (barrel export pattern)
- UI components: kebab-case filenames in `components/ui/` (shadcn convention: `button.tsx`)

**Directories:**
- Feature directories in frontend use PascalCase when domain-matching (`ProductCard`, `CheckoutForm`)
- Domain directories in backend use snake_case (`cart/`, `wishlist/`, `order/`)
- Shared utilities use singular nouns (`helpers/`, `types/`, `prisma-selects/`)

## Module Boundaries

**Auth Service** (`@astrum/auth`):
- Owns: user registration, authentication, JWT issuance
- Directly writes to: `User` table via Prisma
- Returns: `{ token, expiresIn }` objects

**API Gateway** (`@astrum/api`):
- Owns: all business domain operations (products, cart, wishlist, orders, user profile)
- Reads JWT from cookie, extracts `userId`
- Does NOT handle authentication logic (proxies to auth service)
- Each module (`cart/`, `order/`, etc.) is self-contained with controller + routes + service + DTOs

**Frontend** (`@astrum/customer`):
- Owns: all UI, client-side state management, form validation
- Communicates with both services through `useFetcher` (axios instance at `process.env.NEXT_PUBLIC_API_GATEWAY_URL`)
- Auth service endpoints are proxied through API Gateway at `/api/auth`
- Session stored in `localStorage.__auth`

**Database** (`@astrum/db`):
- Owns: schema definition, migration history, Prisma client generation
- Exported via package exports: `"."` (full client), `"./prisma"` (prisma.ts)

## Where to Add New Code

**New API Endpoint:**
1. Create module directory: `apps/api-astrum/src/modules/{module}/`
2. Add `{module}.controller.ts`, `{module}.routes.ts`, `{module}.service.ts`
3. Add DTOs in `{module}/dto/`
4. Register route in `apps/api-astrum/src/app.ts`
5. Add Prisma select to `apps/api-astrum/src/common/prisma-selects/product.select.ts` if needed

**New Auth Endpoint:**
1. Add method to `apps/auth-astrum/src/auth/auth.service.ts`
2. Add route handler in `apps/auth-astrum/src/auth/auth.controller.ts`
3. Add DTO in `apps/auth-astrum/src/auth/dto/`

**New Frontend Page:**
1. Create route in `apps/customer/src/app/(content)/{route}/page.tsx`
2. Create feature component in `apps/customer/src/features/pages/{PageName}/index.tsx`
3. Create hooks in `apps/customer/src/hooks/{domain}/use{Name}.ts`
4. Add types to `apps/customer/src/common/types/`

**New Database Model:**
1. Add model to `packages/Astrum-db/prisma/schema.prisma`
2. Run `pnpm db:generate` + `pnpm prisma:migrate:dev`
3. Regenerate types in all apps: `pnpm prisma:generate`

**New Shared Package:**
1. Add to `packages/{name}/`
2. Reference in `pnpm-workspace.yaml`
3. Add to consuming apps' `package.json` as `@astrum/{name}`

## Special Directories

**`generated/prisma/`** (in `api-astrum/`, `auth-astrum/`, `Astrum-db/`):
- Auto-generated by `prisma generate`
- Contains TypeScript types for all database models
- DO NOT edit manually
- Must be regenerated after any schema change

**`.next/`** (in `customer/`):
- Next.js build cache
- Generated by `next dev` / `next build`
- Safe to delete and regenerate

**`.turbo/`** and **`.codex/`** and **`.omc/`**:
- Build tool caches
- Safe to delete

**`plugins/`**:
- Plugin system directory (structure not populated yet)

**`postman/`**:
- Postman API collections for manual testing

**`docs/`**:
- Project documentation files

---

*Structure analysis: 2026-04-04*
