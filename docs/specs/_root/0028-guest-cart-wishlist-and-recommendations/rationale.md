# 0028. Guest cart, wishlist and recommendations, decision record

The build spec is [index.md](index.md); the verification steps are [verify.md](verify.md).

## Context

The shop asks for an account before anything else. `apps/customer/src/proxy.ts` sends every route that is not one of the three auth pages to `/auth/signin`, and the gateway mounts `/api/products`, `/api/wishlist` and `/api/cart` behind `authenticateToken` (`apps/api-astrum/src/app.ts:81`), so a visitor with no cookie reads `401` everywhere and sees no page at all. There is nothing to hang a guest cart on either: `CartItem` and `WishlistItem` are keyed by `userId` alone (`packages/Astrum-db/prisma/schema.prisma:53`, `:64`), with no relation to `User` and no nullable owner.

Three forces shape the decision. The first is the market habit the scope row names: a shop that demands an account before showing a cart loses the visitor who is still deciding, and Ozon, which the row cites, lets a visitor fill a cart and asks for the account only at checkout. The second is the identity that already exists: the `__auth` cookie is a signed token pointing at a `session:<sid>` record in Redis, and only a sign in writes one, so a guest identity cannot be a session and must not be confused with one. The third is that the catalogue read is already shared: the recommendations page comes from the cache of spec 0022 and the caller's own marks are merged after the cached payload is read, so a guest needs a guest shaped owner rather than a second query.

Not deciding leaves the shop closed to anyone who has not registered, which is the state today, and leaves every row of Slice 11 unbuilt.

## Measured state before the decision (2026-11-18)

- `/api/products`, `/api/wishlist`, `/api/cart`, `/api/orders`, `/api/users`, `/api/reviews` and one shared `/api` mount (seller, shipping, pickup, staff) all sit behind `authenticateToken` (`apps/api-astrum/src/app.ts:80` to `:94`).
- `proxy.ts` holds a single public list, `["/auth/signin", "/auth/register", "/auth/confirm-email"]`, and redirects everything else.
- `(content)/layout.tsx` returns `null` when `verifySession()` finds no session, so the shell itself is unavailable to a guest, not just the pages.
- `readPageMarks(userId, productIds)` already answers a page of marks in two queries and is called by `getRecommendations` after the cached payload is read (`apps/api-astrum/src/modules/product/product.service.ts:120`); `getProduct` still calls `getWishlistAndCartItem` for one product.
- `CartService` and `WishlistService` carry `userId` in every signature, `getCart` loops `getWishlistAndCartItem` per line, and `addProductToCart` / `addProductToWishlist` use a plain `create`, which is why a repeated add answers `500` today.
- No suite covers cart or wishlist on either side: `find apps/api-astrum/src/modules/cart apps/api-astrum/src/modules/wishlist apps/customer/src/hooks/product -name '*.spec.ts' -o -name '*.test.ts*'` returns nothing.
- The gateway has two background passes already, both shaped the same way: `setInterval` started from `server.ts`, a transaction scoped `pg_try_advisory_xact_lock` so one replica sweeps (`apps/api-astrum/src/modules/payment/payment.sweep.ts:150`), and a `*.sweep.crashed` line on failure.
- The seed's only `TRUNCATE` names `"ProductProperty"` and `"Product"`, so the schema change needs no seed edit.
- Schema files under `docs/specs/_root/` are LF (measured: `0021` index, rationale and verify carry 0 CRLF), and `docs/scope/_root/scope.md` is LF too.

## Options considered

### Option 1: a signed guest cookie and nullable owner columns on the two existing tables

The gateway mints a random id, signs it into an `HttpOnly` cookie, and writes guest lines into `CartItem` and `WishlistItem` with `userId` null and `guestId` set. The catalogue mounts switch to optional authentication, the two writes keep a session guard of their own, and one endpoint moves the lines into the account inside a transaction.

**Pros**:
- One code path: reads, caps, filters and the merge read the same two tables, so a rule cannot drift between a guest and an account.
- The merge is an `UPDATE` and a `DELETE` in one transaction, not a copy across two shapes, so no line is doubled and none is lost by construction.
- The identity is self contained: no Redis record, no new table, and a flushed cache cannot orphan a cart.

**Cons**:
- `userId` becomes nullable and the "every line has an owner" guarantee moves to a `CHECK` constraint.
- Every service signature in the cart and wishlist modules changes from `userId` to an owner.

### Option 2: separate guest tables

`GuestCartItem` and `GuestWishlistItem` hold the guest lines and the merge writes into the account tables.

**Pros**:
- The account path is untouched, so nothing that already works can regress.
- Deleting guest data later is a `DROP TABLE`.

**Cons**:
- Four service methods and the merge are duplicated, so every future cap or filter has two homes, and the two homes drift: this repository already carries that class of defect in the `Product.stars` columns.
- Two shapes mean the client reads two payloads or the server maps two into one.

### Option 3: the guest cart in Redis

A hash under `guest:<id>` with the lines, expiring with the key.

**Pros**:
- No schema change and no sweep.
- Very fast writes.

**Cons**:
- The prod Redis runs with `--save "" --appendonly no`, so a restart wipes every guest cart in the shop.
- Product names, prices and images still have to be read from Postgres on every render, so the cache only holds ids and quantities.
- A second store for cart data means the merge reads two places and a partial failure has no transaction to fall back on.

### Option 4: keep the account wall

Leave the shop as it is and drop the scope row.

**Pros**:
- Zero work, zero risk.

**Cons**:
- The row is the only thing that lets a visitor see a cart before registering, which is what the scope calls for.
- The `proxy.ts` redirect and the `authenticateToken` mounts are the first thing every new visitor meets.

## Rationale

Option 1 wins on the force that matters most here: this shop already has five read paths over the same two tables, and the defect the tree keeps producing is a second source of the same fact (`Product.stars` beside the review aggregate, two `CartService` add paths, a cart currency the read never sends). Option 2 buys isolation for the account path at the price of a fourth copy of a rule that already has three. Option 3 fails the durability test outright: the prod Redis keeps nothing across a restart, and a visitor's cart is exactly the data a restart would eat. Option 4 contradicts the scope row and the market habit it names.

The nullable owner is the honest shape of the fact: a line belongs to somebody, and that somebody is either an account or an anonymous id. Postgres cannot point one column at two tables, and two tables with a shared parent is the same model with an extra join, so the two nullable columns plus one `CHECK` express exactly what the domain says.

Optional authentication on the catalogue mounts is the narrow change: the two write routes that live under `/api/products` (`POST /` and the nested review write) keep a session, and the guard moves from the mount to the route. The rest of the tree keeps `authenticateToken`, so every order, staff, seller and shipping route answers exactly what it answers today.

The merge is explicit rather than lazy because a write hidden inside another request is the shape this repository has already paid for: an order list that read every item, a per card query inside a page read. One endpoint the storefront calls once at sign in can be driven by a test, a log line and a verify step; a lazy merge on the first authenticated request cannot be observed without guessing which request it was.

The sweep exists because a guest identity is cheap to mint and a script can mint many. Bounding its life rather than its count is the smaller mechanism, and it reuses a pattern the gateway already runs twice.

## Decisions taken while writing this spec

- **Guest token shape**: a JWT signed with the existing `JWT_SECRET`, payload `{ gid, typ: "guest" }`, `expiresIn: "30d"`. Runner up: an HMAC over a raw id in a `<id>.<signature>` value. The JWT path reuses the library already installed and gives expiry and signature verification in one call, and `typ` is what keeps a guest value out of `__auth`.
- **Marks helper**: widen `readPageMarks` to an owner union rather than adding a second helper. Runner up: a sibling `readGuestPageMarks`. One helper keeps the two queries per page in one place, which is the guarantee spec 0022 wrote down.
- **Sweep placement**: inside the gateway, shaped exactly like `payment.sweep.ts`, one pass at boot and a 24 hour timer behind `pg_try_advisory_xact_lock`. Runner up: a job in `apps/worker`. The worker owns mail delivery, and moving a cleanup there would need its own start and its own proof.
- **Owner resolution**: one middleware that attaches the resolved owner to the request, not an extra parameter per controller. Runner up: each service resolving its own owner. One place means the guest id can only come from the token, which is AC-4.
- **No feature flag**: the scope tag is GA and the project removed its last flag on the owner's call (`SELLER_ORDER_WORKFLOW_ENABLED`, removed 2026-11-13). Runner up: `GUEST_CHECKOUT_ENABLED`, which would double every route's behaviour for one release.
- **Guest id minted in the gateway**: a `uuid()` v4 generated in the same request that writes the first row, not a database default, so the cookie and the row carry one id without a second read.
- **Guest flag on the storefront**: taken from the server layout that already verifies the session, not from a new read route. Runner up: `GET /api/guest/state`, which would add a request to every render.
- **Repeated heart press fixed here**: `POST /api/wishlist` uses a plain `create` and answers `500` on a duplicate, the same defect class as the cart add, and a guest presses the heart twice far more often than an account does. Runner up: leave it and record a follow up.

## Deviations from the interview answers

- **The delivery route stays behind the session.** Round 2 answered "the catalogue plus the delivery route", and the reading of `app.ts` showed shipping and pickup share one guarded mount with the seller and staff routers. No screen a guest can open reads delivery methods, because `/checkout` is the only consumer and it stays guarded, so opening them would widen the public surface with nothing behind it. The owner confirmed keeping them closed; the spec records the narrowing, and the shared mount stays untouched.
- **A line whose product is gone is not deleted on read.** The data model round chose "it disappears from the read and is deleted on the first read". The read already filters it out, but the delete would put a write inside a `GET`, an extra statement on a read path that runs on every cart render. The owner confirmed moving the delete to the two places that already write: the merge skips such a line, and the sweep removes the row when its retention bound passes. The cost is named in the spec's Consequences: a row may sit in the table that no screen shows.
- **The merge answer shape.** The interview answered `200 { merged: 0 }`. The spec names the two counts instead, `{ "cartLines": n, "wishlistLines": m }`, because a single number cannot tell a three line cart from a three line wishlist, and the zero case reads as zero of both.

## What the fresh read corrected

One read of this spec against the tree found eight things the first draft got wrong, each measured here before the edit:

- `@updatedAt` emits no database default, so the two new `NOT NULL` columns would fail on the shared volume. The schema takes `@default(now()) @updatedAt` and AC-1 names the default as part of the criterion.
- `apps/customer/src/hooks/useFetcher.ts:31` treats `SESSION_MISSING` as the end of a session and sends the browser to `/auth/signin`. A guest would bounce on its own shell, so the code leaves the refusal set and the shell mounts no account read for a guest.
- `getProduct` reads `reviewState` through `readReviewState(userId, productId)` (`product.service.ts:76`), and `getLikedReviewIds` filters on `userId`; both needed an owner with a guest answer, and both are now in AC-6 and the value sourcing table.
- The first draft claimed `requireActiveAccount` guards `POST /api/products`. It does not (`product.routes.ts:19`), so the wording now says what fails without `requireSession`: a `500` from the seller lookup, and a `503` only on the review write.
- `startPaymentSweep` starts a timer and nothing else, so the boot pass is named as this sweep's own addition instead of being implied by "shaped like".
- `pg_stat_statements` is not installed on the dev container, so AC-12 measures with the `pg_stat_user_tables` scan totals the repository reference already uses.
- `DELETE /api/cart/:productId` reads `getWishlistItem` without `await` (`cart.service.ts:124`), so `isWishlisted` is always `true`; the fix rides the signature change and AC-8 says so.
- The reads carry no `orderBy`, so AC-8 no longer promises byte identical bodies; it promises the same set in the order the read has always answered.

References: none. The decision rests on the repository's own files (`app.ts`, `proxy.ts`, both cart services, `payment.sweep.ts`, both `AGENTS.md` files) and on the scope row of Slice 11.
