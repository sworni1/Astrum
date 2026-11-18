# 0028. Guest cart, wishlist and recommendations

**Date**: 2026-11-18
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

A visitor with no account can browse the shop, add lines to the cart and to the wishlist, and keep them across a reload, a second tab and a later visit. The gateway recognises that visitor by a cookie it issues and signs itself, and the two existing tables carry that identity in a column beside the account id. Signing in or registering moves those lines into the account under one stated quantity rule, so nothing the visitor picked is lost, and the account becomes a requirement only at `/checkout`, the way Ozon does it. Catalogue reads open to everyone, and the marks (the filled heart and the counter in the cart) come from the visitor's own rows.

## Requirements

**User stories**:

- As a visitor with no account, I want to look at the shop and keep a cart and a wishlist, so that I can decide what to buy before I hand over my address.
- As a visitor with no account, I want the cart and the wishlist to still be there after a reload, a second tab and a later visit, so that I trust the shop with a longer decision.
- As a visitor with no account, I want to reach the checkout by signing in once and keep everything I picked, so that the account step costs me nothing.
- As a customer with an account, I want a cart picked before signing in to join the one I already have, so that no line is lost and none is doubled.
- As the shop, I want a guest identity that no other visitor can read, so that one person's picks never appear on another person's screen.

**Acceptance criteria** (the contract):

- **AC-1**: `CartItem` and `WishlistItem` carry `userId String?`, `guestId String?`, `updatedAt DateTime @default(now()) @updatedAt`, `@@unique([guestId, productId])` and `@@index([guestId])` beside the existing `@@unique([userId, productId])` and `@@index([userId])`. The default is part of the criterion, not a style choice: `@updatedAt` alone emits no database default, and both tables already hold rows (measured 2026-11-18: 14 `CartItem`, 11 `WishlistItem`), so a `NOT NULL` column added without one fails on the shared volume. The four schema copies stay byte identical: `for f in apps/*/prisma/schema.prisma; do diff -q packages/Astrum-db/prisma/schema.prisma "$f"; done` prints nothing. One migration `packages/Astrum-db/prisma/migrations/20261118120000_guest_owner/migration.sql` adds the two columns to both tables, drops `NOT NULL` from `userId`, creates `"CartItem_guestId_productId_key"` and `"WishlistItem_guestId_productId_key"`, and adds `CHECK ((("userId" IS NOT NULL) <> ("guestId" IS NOT NULL)))` to both tables, so a row with two owners or no owner cannot be written. `cd packages/Astrum-db && npx prisma migrate status` answers `Database schema is up to date!`, `\d "CartItem"` in `astrum-db` lists the check constraint, and `pnpm db:generate` ran. The seed needs no change: its only `TRUNCATE` names `"ProductProperty"` and `"Product"` (measured 2026-11-18).
- **AC-2**: The first write without cookies issues the guest identity. `POST /api/cart` with no `__auth` and no `__guest` answers `200`, writes one row with `userId` null and `guestId` equal to the id inside the cookie it sets, and the answer carries `Set-Cookie: __guest=<value>; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax` (with `Secure` added when `NODE_ENV` is `production`). `POST /api/wishlist` behaves the same way. A read issues nothing: `GET /api/cart`, `GET /api/wishlist` and every `/api/products` route with no cookies answer their empty or shared shape and carry no `__guest` in `Set-Cookie`.
- **AC-3**: A token that is forged, expired or signed with another secret is not an error. `__guest` with one character of its value changed, one signed with a different secret, and one whose `exp` has passed are each treated exactly like no cookie: reads answer `[]` with `200`, and a write writes a fresh identity and sets a new cookie. The guest cookie alone never produces a `4xx`, and the gateway writes one `guest.token.refused` log line per refused value, naming the route and the reason and never the token.
- **AC-4**: One guest never reads another. Two browsers carrying distinct `__guest` values read disjoint carts and wishlists, and each write lands on the id from its own token. The id travels in the token only: `grep -rn "guestId" apps/api-astrum/src/modules/cart apps/api-astrum/src/modules/wishlist apps/api-astrum/src/modules/guest` shows no read of a body field, a query parameter or a path segment, only the resolved owner. A `POST /api/cart` whose body carries `guestId` of another guest writes under the caller's own id.
- **AC-5**: One token kind never stands in for the other. A `__guest` value copied into `__auth` answers `401` on a guarded route, with one of the session guard's own codes (`SESSION_MISSING`, `TOKEN_INVALID` or `SESSION_REVOKED`), and never resolves to a cart. An `__auth` value copied into `__guest` is refused as a guest token (it carries no `typ` of `guest`), so the request reads as a visitor with no cart. Guest tokens carry `typ: "guest"` and no `sid` (measured on the issued value with `node -e` and the same `JWT_SECRET`).
- **AC-6**: Catalogue reads answer without a session. `GET /api/products/recommendations`, `GET /api/products/categories/:category` and `GET /api/products/:productId` answer `200` with no cookies. `isWishlisted` and `quantityInCart` come from the reader's own rows through `readPageMarks` (`apps/api-astrum/src/common/helpers/getWishlistAndCart.ts`) widened to an owner, in exactly two queries per page for a guest as for an account, and the shared payload still comes from the catalogue cache of spec 0022 with no mark inside it. The two reads that carry a caller's own state today answer a guest without inventing one: `readReviewState` (`apps/api-astrum/src/modules/product/product.service.ts:76`) answers `{ status: "NOT_PURCHASED", orderItemId: null }` with no session rather than filtering on an undefined id, and `getLikedReviewIds` (`apps/api-astrum/src/modules/reviews/reviews.service.ts`) answers an empty set, so `GET /api/products/:productId/review-likes` answers `[]` and `GET /api/products/:productId/reviews` answers `200`. The write routes stay closed: `POST /api/products` and `POST /api/products/:productId/reviews` with no `__auth` answer `401 SESSION_MISSING`, because `requireSession` runs on both. Today the mount guard answers that; without it the seller lookup would answer `500` and `requireActiveAccount` would answer `503` on an undefined id, which is why the guard is named per route and not left to the mount. One suite enumerates the `productRoutes` router and asserts every non `GET` route carries `requireSession`, so a route added later cannot ride the public mount by accident.
- **AC-7**: Everything else stays behind the session. `GET /api/users/me`, every `/api/orders` route, `/api/shipping`, `/api/pickup`, `/api/staff`, `/api/seller` and `GET /api/reviews/:reviewId` answer `401 SESSION_MISSING` with no cookies. Shipping and pickup stay inside the shared guarded mount in `apps/api-astrum/src/app.ts`, so a guest never reads delivery methods.
- **AC-8**: A guest reads its own cart and wishlist. `GET /api/cart` for a guest answers the same array shape the account read answers (`id`, `quantity` (the stock of the product), `price`, `previewImage`, `name`, `isWishlisted`, `quantityInCart`), with `quantityInCart` from the guest line and `isWishlisted` from the guest wishlist. `GET /api/wishlist` answers the shape it answers today with `quantityInCart` from the guest cart. Two consecutive reads with nothing in between answer the same set of product ids with the same `quantityInCart` values, in the order the read answers today: no `orderBy` is added, because both reads have always answered in table order and imposing one here would move the account's lines too. `DELETE /api/cart/:productId` answers the real wishlist mark: the method reads `getWishlistItem` without `await` today (`apps/api-astrum/src/modules/cart/cart.service.ts:124`), so `isWishlisted` comes back `true` for every delete, and the fix lands with the signature change.
- **AC-9**: A line whose product is gone reaches no screen. A line whose product is `isDeleted`, not `Public` or not `Published` is absent from both reads, because the `where` filter already sits in `cart.service.ts` and `wishlist.service.ts`, and the merge skips it. The guest row of such a line is still deleted with the rest of the guest rows, so a gone product is dropped rather than carried into the account. The row may therefore stay in the table until the sweep takes it when nobody signs in: the read path stays free of writes on purpose, and the record of this cost is in Consequences.
- **AC-10**: Adding twice raises the quantity instead of failing. `POST /api/cart` twice with the same product answers `200` twice, the row holds `2`, and no path answers `500` for a repeated add, for a guest and for an account (today the second add answers `500 Internal Server Error`, open in `docs/scope/_root/scope.md` under Deferred). The cap is `Product.quantity` at every write, so a product with stock `1` holds `1` after two adds. A second `POST /api/wishlist` for the same product answers `200` and leaves one row, where today it answers `500`.
- **AC-11**: Signing in or registering moves the lines in one transaction. `POST /api/cart/merge` with `__auth` and `__guest` runs one transaction: each guest cart line becomes `min(account + guest, Product.quantity)` on the account line, a product whose stock is `0` leaves the account line as it was, and a product whose account line does not exist is created with the guest quantity capped the same way. Each guest wishlist line becomes an account line unless one exists. Every guest row of both tables for that id is deleted, a line whose product is gone included. `cartLines` and `wishlistLines` count the lines the merge wrote, so a skipped duplicate or a skipped gone product is not counted. The answer is `200 {"cartLines": n, "wishlistLines": m}` with `Set-Cookie: __guest=; Max-Age=0; Path=/`. A merge that throws leaves both tables and the cookie untouched, so a retry works. With no `__guest`, or a broken one, the answer is `200 {"cartLines": 0, "wishlistLines": 0}`. Without `__auth`, `401 SESSION_MISSING`. A second call moves nothing.
- **AC-12**: An account's own lines always win on read. With a valid `__auth` and a stale `__guest` in the same request, `GET /api/cart` and `GET /api/wishlist` answer the account's lines only and touch no guest row, and the resolver adds no scan of the guest tables when a session exists: the `pg_stat_user_tables` scan totals for `CartItem` and `WishlistItem` around one read move by the same number as before this change, because `pg_stat_statements` is not installed on the dev container (`select * from pg_extension` lists `plpgsql` alone).
- **AC-13**: The storefront renders for a guest. In `apps/customer/src/proxy.ts` a request with no valid `__auth` renders `/`, `/categories/*`, `/products/*`, `/cart`, `/wishlist` and `/auth/*` with no redirect, and every other matched path redirects to `/auth/signin?next=<path>` with the path taken from `req.nextUrl.pathname`. `apps/customer/src/app/(content)/layout.tsx` renders `Navbar`, the page and `Footer` for a guest instead of returning `null`, which it does today. A guest mounts no account read: the shell mounts neither `useUser` nor `useGetOrders` for a guest, and `SESSION_MISSING` leaves `SESSION_GONE_CODES` in `apps/customer/src/hooks/useFetcher.ts:31`, because `endSessionHere` on that code sends the browser to `/auth/signin` and a guest screen would bounce on its first render. `SESSION_REVOKED` and `TOKEN_INVALID` keep their redirect, which is the real end of a session, and a cookie that never existed is caught by the route guard on the next navigation. One suite asserts the two path lists, the redirect target and the refusal set.
- **AC-14**: The guest screens hold. The `Navbar` for a guest shows the cart icon with the guest line count, the wishlist link and the `Sign in` and `Register` buttons in place of the avatar. `/cart` shows one notice band above the lines with the sign in link, and its checkout button sends the visitor to `/auth/signin?next=/checkout`. `/wishlist` renders the guest lines with the same card the account wishlist uses. The heart on a product card fills for a guest on the first press. Both screens hold at 390 and 1280 wide with no horizontal scroll, and no opened screen assumes a session: the build reads each of the six paths of AC-13 for a session read that would throw.
- **AC-15**: The return path is closed and the merge runs once. The sign in page reads `next`, accepts only `/checkout` and `/cart` through one shared helper (`grep -rn "acceptedReturnPath" apps/customer/src` shows one definition and two callers), calls `POST /api/cart/merge` once after `createSession` (`apps/customer/src/hooks/auth/useAuth.ts`) in both `handleSignIn` and `handleRegister`, before any navigation. Sign in then routes to the accepted path; registration keeps its step to `/auth/confirm-email` as it does today, and `next` is honoured at the sign in that follows. Any other value, `https://evil.example` included, routes to `/`. In the browser, a guest holding two cart lines who signs in from `/checkout` lands on `/checkout` with both lines in the account cart.
- **AC-16**: Copy, retention and gates. The new copy lives in `apps/customer/messages/en.json` and `ru.json` under the existing `nav` and `cart` namespaces, and `node <skill dir>/scripts/catalog-parity.mjs nav` and `… cart` print no difference. The cookie lives 30 days, and a sweep deletes guest rows whose `updatedAt` is older than 30 days, with one pass at boot and then every 24 hours, behind `pg_try_advisory_xact_lock`, writing one `guest.sweep.done` line with both counts. The boot pass is this sweep's own addition: `startPaymentSweep` only starts a timer (`apps/api-astrum/src/modules/payment/payment.sweep.ts:182`), so it is not copied as a whole; a suite proves a 31 day row is deleted and a 29 day row survives. `pnpm check-types`, `pnpm --filter @astrum/api test`, `pnpm --filter @astrum/customer test` and `pnpm --filter @astrum/customer lint` are green.

## Decision

**Chosen option**: Option 1: one signed guest cookie, nullable owner columns on the two existing tables, an explicit merge endpoint, optional authentication on the catalogue mounts.

A visitor is recognised by an `HttpOnly` cookie the gateway signs and reads itself, guest lines live in `CartItem` and `WishlistItem` beside the account lines, and one endpoint moves them into the account when the visitor signs in. The catalogue mounts switch from `authenticateToken` to `optionalAuth`, every write keeps its own session guard, and a daily sweep removes what nobody claimed.

**Implementation skills**: none installed in this repository (there is no `.claude/skills/` or `.agents/skills/`); the conventions come from the root `AGENTS.md` and `apps/customer/AGENTS.md` (storefront rules S1 to S5) and `apps/api-astrum/AGENTS.md`.

## Feature design

**Data model sketch**:

| Table | Field | Type | Rule |
|---|---|---|---|
| `CartItem` | `userId` | `String?` | the account owner, null on a guest line |
| `CartItem` | `guestId` | `String?` | the guest id from the verified cookie, null on an account line |
| `CartItem` | `quantity` | `Int @default(1)` | unchanged, capped at `Product.quantity` |
| `CartItem` | `updatedAt` | `DateTime @default(now()) @updatedAt` | the retention clock the sweep reads, and the default backfills the rows that exist |
| `CartItem` | `@@unique([userId, productId])` | kept | the add becomes an upsert on it, and on the guest key |
| `CartItem` | `@@unique([guestId, productId])` | new | Postgres lets many nulls through, so account rows do not collide |
| `WishlistItem` | the same four changes | | `userId String?`, `guestId String?`, `updatedAt DateTime @default(now()) @updatedAt`, `@@unique([guestId, productId])` |

A line belongs to exactly one owner, and the migration's `CHECK` holds that invariant because Prisma cannot express it. There is no `Guest` table: the identity is the signed token, so nothing has to be created or read before the first write.

**State transitions**:

A line moves once in its life: `guest owned` becomes `account owned` inside the merge transaction, and the guest row is deleted in the same commit. A line may also end without a move, when the sweep deletes a guest row older than the retention bound.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/products/recommendations` | GET | `cursor`, `limit` (opt) | `products[]` with `isWishlisted`, `quantityInCart` | public | 500 |
| `/api/products/categories/:category` | GET | `category` (req) | the same page shape | public | 500 |
| `/api/products/:productId` | GET | `productId` (req) | product with its marks | public | 404, 500 |
| `/api/products/:productId/reviews` | GET | `productId`, paging (opt) | reviews page | public | 404, 500 |
| `/api/products/:productId/review-likes` | GET | `productId` (req) | `[]` for a guest, the liked set for an account | public | 500 |
| `/api/products` | POST | product body (req) | created product | session, seller | 401, 403 |
| `/api/products/:productId/reviews` | POST | `rating`, `text` (req) | created review | session, `ACTIVE` account | 401, 403, 422 |
| `/api/cart` | GET | none | `[]{id, quantity, price, previewImage, name, isWishlisted, quantityInCart}` | session or guest | 500 |
| `/api/cart` | POST | `productId` (req) | the line with its marks | session or guest, guest identity issued when absent | 500 |
| `/api/cart/:productId` | PATCH | `quantity` (req) | the line | session or guest | 422, 500 |
| `/api/cart/:productId` | DELETE | `productId` (req) | `isWishlisted`, `quantityInCart` | session or guest | 500 |
| `/api/wishlist` | GET | none | the wishlist with marks | session or guest | 500 |
| `/api/wishlist` | POST | `productId` (req) | the line | session or guest, identity issued when absent | 500 |
| `/api/wishlist/:productId` | DELETE | `productId` (req) | `isWishlisted`, `quantityInCart` | session or guest | 500 |
| `/api/cart/merge` | POST | none | `{cartLines, wishlistLines}` | session only, `401 SESSION_MISSING` without | 401, 500 |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| any cart or wishlist write | the owner the row is written under | the `__auth` session when it verifies, else the `guestId` from the verified `__guest`, else a new `uuid()` minted in the same request |
| add to cart | the amount after the add | `min(existing + 1, Product.quantity)` read in the same transaction |
| patch quantity | the accepted quantity | the request body, refused above `Product.quantity` |
| merge | the merged quantity | `min(account + guest, Product.quantity)` over both rows in the transaction |
| merge | `cartLines` and `wishlistLines` | the counts the transaction returns |
| catalogue read | `isWishlisted`, `quantityInCart` | `readPageMarks` over the reader's owner, two queries per page |
| the storefront's guest flag | whether the shell renders the guest header | the absence of a verified `__auth`, read on the server in `(content)/layout.tsx` |
| the return path after sign in | where the browser goes | the `next` parameter, accepted only through `acceptedReturnPath` (`/checkout`, `/cart`) |
| the retention bound | when a guest row dies | `GUEST_RETENTION_DAYS = 30` in `apps/api-astrum/src/modules/guest/constants/guest.constants.ts`, matching the cookie's `Max-Age` |
| a catalogue read | `reviewState` | `readReviewState` widened to an owner, `{ status: "NOT_PURCHASED", orderItemId: null }` with no session |
| a catalogue read | the liked review set | `getLikedReviewIds` widened to an owner, an empty set with no session |
| the storefront shell | whether an account read mounts at all | the guest flag passed from `(content)/layout.tsx` into `Navbar` |
| the cart badge count | the number beside the cart icon | the guest or account cart read the `Navbar` already calls |

**Key invariants**:

- Every `CartItem` and `WishlistItem` row has exactly one owner, enforced by the migration's `CHECK`.
- A guest id comes from the verified token and from nowhere else.
- A quantity never exceeds `Product.quantity` at any write, the merge included.
- The merge is atomic and idempotent: after it, the guest holds no row and a second call answers zeros.
- No mark ever enters a cached payload, so the shared part stays identical for every reader.
- A guest value in `__auth` and an account value in `__guest` are both refused.
- A guest mounts no account read, and the client never reads a missing session as an ended one.

**Security model**:

The guest cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production, and signed with the existing `JWT_SECRET`; it grants nothing but its own lines. The guest id is a `uuid()` v4, so the id space cannot be walked, and it is read from the token only, which closes the class where an id arrives from a body. No personal data lands in a guest row: a line holds a product id and a quantity. `/checkout`, `/profile`, `/orders`, the seller area, the staff area and the courier and point areas stay behind the session, both in `proxy.ts` and in the gateway, so a guest identity never reaches an order. There is no rate limit on guest writes: a script can create rows, and the sweep bounds their life rather than their count, which is recorded as an accepted trade rather than an oversight. The catalogue cache stays shared, so a guest read costs the same as an account read. The cookie is host scoped and port blind, so it is sent from the storefront and read back to the gateway through the base URL the fetcher already uses (`NEXT_PUBLIC_API_GATEWAY_URL` with `withCredentials`), which is cross origin by port in dev and same origin behind Caddy in production; no rewrite or proxy rule is added for it.

**Configuration required**:

No new environment variable. The constants live in `apps/api-astrum/src/modules/guest/constants/guest.constants.ts`: `GUEST_COOKIE_NAME = "__guest"`, `GUEST_COOKIE_MAX_AGE_DAYS = 30`, `GUEST_RETENTION_DAYS = 30`, `GUEST_SWEEP_INTERVAL_MS`, `GUEST_SWEEP_LOCK_KEY`.

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: a visitor with no cookies adds two products and presses the heart once, reloads, reads both lists and the same marks on the cards, verifies **AC-2**, **AC-6**, **AC-8**, **AC-10**.
- Happy path on the account side: the same visitor signs in from `/checkout` with one line already in the account cart, and lands on `/checkout` with the sum and the union, verifies **AC-11**, **AC-15**.
- Failure case: a forged, an expired and a foreign secret token each read as an empty cart, and a merge that throws mid transaction leaves both sides and the cookie as they were, verifies **AC-3**, **AC-11**.
- Failure case: a product whose stock is `1` receives two adds and holds `1`, and a product deleted after the add is absent from the read and skipped by the merge, verifies **AC-9**, **AC-10**.
- Auth/permission: a second browser with its own `__guest` reads an empty cart, a `__guest` value in `__auth` answers `401`, and `/api/orders`, `/api/shipping` and `/api/staff` answer `401` without a session, verifies **AC-4**, **AC-5**, **AC-7**.
- Retention: the sweep deletes a row touched 31 days ago and keeps one touched 29 days ago, verifies **AC-16**.
- Storefront failure: a guest opens `/` and `/cart` and no request sends the browser to `/auth/signin`, while a `SESSION_REVOKED` from a real expiry still does, verifies **AC-13**.

## Build plan

The project builds by Tracer Bullet (`AGENTS.md`), so the first slice is one thin thread end to end that proves the identity works: schema, owner resolver, cookie, and a guest product press landing in `/cart`. The rest thickens that thread.

1. Schema, migration, the three identical copies and `pnpm db:generate`: the two columns, the two unique keys, `updatedAt`, the `CHECK`, satisfies **AC-1**. — done: `20261118120000_guest_owner` applied (`migrate status`: Database schema is up to date!), `\d "CartItem"` lists `CartItem_owner_exactly_one`, the four schema copies diff clean, the client regenerated in all four packages
2. The owner resolver and the cookie: `apps/api-astrum/src/middlewares/resolveOwner.ts` (`optionalAuth` plus the guest read, the mint on write, the `guest.token.refused` line), the `Owner` type in `apps/api-astrum/src/common/types/owner.ts`, `requireSession`, and the two mount changes in `app.ts` (`/api/products` becomes `optionalAuth`, the write routes gain `requireSession`, and one suite enumerates that router), satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**. — done: `resolveOwner.ts`, `common/types/owner.ts`, `modules/guest/guest.identity.ts`, the three mounts switched in `app.ts`, `product-routes.guard.spec.ts` enumerating the router
3. Cart and wishlist take an owner: every service method and the three helpers in `getWishlistAndCart.ts` switch from `userId` to the owner, the add becomes an upsert capped at stock, the wishlist add becomes an upsert, and the gone product filter stays where it is, satisfies **AC-8**, **AC-9**, **AC-10**, **AC-12**. — done: `getWishlistAndCart.ts` (`ownerColumns`, `ownerUniqueKey`), both services and both controllers; `cart.owner.spec.ts` and `wishlist.owner.spec.ts` carry the rules
4. Catalogue reads for a guest: `readPageMarks`, `readReviewState` and `getLikedReviewIds` widen to the owner, `getRecommendations` and `getProduct` take it, and the review likes read answers an empty set without a session, satisfies **AC-6**. — done: all four widened to `Owner | null`; live `GET /api/products/recommendations` with no cookie answers 200
5. The merge: `apps/api-astrum/src/modules/guest/guest-merge.service.ts` and the route on the cart router, one transaction, the cap rule, the cookie cleared, satisfies **AC-11**. — done: `guest-merge.service.ts`, `POST /api/cart/merge` behind `requireSession`, cookie cleared after the commit; `guest.merge.spec.ts`
6. The sweep: `apps/api-astrum/src/modules/guest/guest.sweep.ts` shaped like `payment.sweep.ts` (`pg_try_advisory_xact_lock`, the `guest.sweep.done` line, a timer started from `server.ts`) plus the one boot pass that file does not run, satisfies **AC-16**. — done: `guest.sweep.ts` with the boot pass, started and cleared in `server.ts`; `guest.sweep.spec.ts` (31 days deleted, 29 kept, lock skip)
7. The storefront shell: the route policy in `proxy.ts`, `(content)/layout.tsx` rendering for a guest, the `Navbar` guest state without `useUser` and `useGetOrders`, `SESSION_MISSING` out of `SESSION_GONE_CODES` in `useFetcher.ts`, the notice band on `/cart`, and a read of each opened screen for a session assumption, satisfies **AC-13**, **AC-14**. — done: route policy with `next`, the shell reads `readSessionUserId`, `useUser`/`useGetOrders` take `enabled`, `GuestCartNotice` and the guest header, `__tests__/proxy.test.ts`
8. The sign in path: `acceptedReturnPath`, the merge call after `createSession` in both handlers, the redirect on sign in and the unchanged confirmation step on registration, satisfies **AC-15**. — done: `common/helpers/returnPath.ts` called from the sign in page and `useAuth`, `POST /cart/merge` after `createSession` in both handlers; `returnPath.test.ts`
9. Copy and gates: the two catalogs, `catalog-parity`, the gateway suites (`guest.identity.spec.ts`, `guest.merge.spec.ts`, `guest.sweep.spec.ts`, the cart and wishlist owner suites) and the storefront suite for the route policy and `acceptedReturnPath`, satisfies **AC-16**, and checks **AC-2** to **AC-12** again in one pass. — done: `catalog-parity` prints nav 20/20 and cart 82/82 with no difference, all six gateway suites and both storefront suites written, `@astrum/api` 489 tests and `@astrum/customer` 458 tests green, `@astrum/customer lint` 0 errors; the tree wide `pnpm quality-gate` itself belongs to `Verify it`

## Consequences

**Positive**:

- A visitor can shop before owning an account, and keeps the picks through the sign in that checkout requires, which is the shape the scope row describes.
- One code path serves both owners: the reads, the caps and the merge read the same tables, so a change to a cap or a filter cannot drift between the guest and the account.
- The catalogue cache of spec 0022 needs no change, because a mark already rides beside the cached payload rather than inside it.

**Negative / tradeoffs**:

- `userId` becomes nullable, so the database no longer guarantees that every cart line belongs to an account; the `CHECK` carries that guarantee instead, and a future writer that bypasses Prisma must respect it.
- A guest row can outlive its cookie by up to the retention bound when a visitor never returns, and the sweep is a new background pass inside the gateway that three replicas all start.
- The read path deliberately leaves a row whose product is gone in the table until the sweep takes it, so a database count of cart rows is larger than what any screen shows (AC-9).
- There is no rate limit on guest writes, so a script can create rows faster than the sweep removes them.
- The shell now renders for a visitor with no session, so any screen opened by AC-13 that quietly assumed a session breaks at render time rather than at the API.
- The fetcher's refusal set narrows, so a customer whose cookie vanishes without a code is sent to sign in by the route guard at the next navigation instead of by the fetcher on the request.

**Neutral**:

- The cart read still costs two queries per line for both owners; batching it is a separate change.
- A guest identity is issued once and not renewed on later writes, so a visitor active on day 29 loses the cart on day 30.
- `GET /api/reviews/:reviewId` stays behind the session, so the exposure recorded in Deferred is neither widened nor closed here.

## Follow-up

- [ ] Batch the marks inside `getCart` and `getWishlist`: both still call `getWishlistAndCartItem` per line, two queries each, for either owner.
- [ ] Renew the guest cookie on a write while it lives, so an active visitor is not cut off at the 30 day mark.
- [ ] Add `express-rate-limit` and cap guest writes by address and by guest id once abuse is measured, rather than on suspicion.
- [ ] Decide the fate of `GET /api/reviews/:reviewId`, which answers any customer's row with `userId` inside (already open in `docs/scope/_root/scope.md` under Deferred).
- [ ] The cart read carries no currency; the checkout cannot offer only the methods that match the cart (already open, from spec 0009 and spec 0024).

## Rationale

Reasoning and the options weighed: see [rationale.md](rationale.md).
