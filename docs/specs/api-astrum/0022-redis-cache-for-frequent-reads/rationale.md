# 0022. Rationale: Redis cache for frequent reads

## Context

The gateway reads the same catalogue rows on every visit. The measured state before this decision, taken from the code and from the dev database on 2026-11-16:

| Read | Queries per request | Notes |
|---|---|---|
| `GET /api/products/recommendations` | 18 for a page of 8 | one `product.findMany`, one `review.groupBy` for the page ratings, then two queries per card for the caller's cart and wishlist marks |
| `GET /api/products/categories/:category` | 18 | the same method, `getCategoryProducts = this.getRecommendations` |
| `GET /api/products/:productId` | 5 | two mark reads, the product row, then up to two for `reviewState` |
| `GET /api/products/:productId/reviews` | 4 or 5 | cursor check when `after` is present, then page, count, average and distribution in one `Promise.all` |
| `GET /api/shipping-methods` | 1 | four active rows |

The catalogue holds 4752 products with an average row width of 706 bytes, 6 reviews, 4 shipping methods, 8 cart lines and 12 wishlist lines. Nothing in the gateway caches a read today: the only Redis key kind is `session:<sid>`, written by `apps/api-astrum/src/session/sessionStore.ts` with `commandTimeout: 1000`, `enableOfflineQueue: false` and `maxRetriesPerRequest: 1`, and mirrored by `apps/auth-astrum/src/redis/`. There is no cache module, no `Cache-Control` header and no response caching anywhere in the tree.

Two forces shape the design. First, the per caller marks live inside the shared payload: `getProduct` and `getRecommendations` merge `isWishlisted`, `quantityInCart` and `reviewState` into a row that is otherwise identical for every account, so caching a whole response would leak one account's cart into another's screen. Second, the writes that change those rows are spread across four modules: product creation in `product.service.ts`, stock movement in `order.service.ts`, `order-status.helpers.ts` and `payment.apply.ts`, and review aggregates and counters in `reviews.service.ts`.

Two premises measured against the code and corrected before they could become criteria:

1. The scope row names "a product change" as a write that must invalidate. No route updates or deletes a product: `product.routes.ts` carries `GET /recommendations`, `GET /categories/:category`, `POST /`, `GET /:productId` and the two nested review mounts. The only product writer is `createProduct`, and stock moves through the order and payment paths. The matrix in this spec therefore names the writers that exist.
2. The scope row promises that a Redis that is down never fails a read. Every catalogue route sits behind `authenticateToken`, which reads `session:<sid>` from the same Redis and answers `401 SESSION_STORE_UNAVAILABLE` when that read throws (`apps/api-astrum/src/middlewares/authenticateToken.ts`). A dead Redis already fails every authenticated request through the guard, so the criterion this spec can hold is the one it writes: a failing or slow cache operation falls back to Postgres, which is why the cache takes its own URL.

## Options considered

### Option 1: batch the marks, no cache

Keep every read on Postgres and replace the two per card mark queries with two per page.

**Pros**:
- Removes the worst of the cost (18 queries down to 4) with one small change and no new infrastructure.
- Nothing to invalidate, nothing to go stale.

**Cons**:
- Every repeat visit still reads the same rows from Postgres, which is the complaint the scope row records.
- The reviews page and the shipping read keep their queries with no gain.

### Option 2: cache the whole response per account

Key every response by route and account id.

**Pros**:
- A cache hit serves everything, marks included, with no second read.

**Cons**:
- One key per account per page, and a cart write by one account invalidates only that account's keys, so the store grows with the number of visitors instead of with the catalogue.
- The marks go stale exactly where they matter most, since a cart change is the most frequent write a customer makes.
- A cached body carries account data, which turns a cache bug into a data leak.

### Option 3: cache the shared part, version every key, keep the marks live and batched

Cache the shared payload under a key that carries a version or an epoch, merge the caller's marks after the parse from two batched queries, and bump the version from every writer that changes the payload.

**Pros**:
- The cache holds only catalogue data, so no account can read another's state through it and the key space follows the catalogue, not the traffic.
- Invalidation never has to find a key: an `INCR` makes the old key unreachable, so the classic race (a reader writing an old row back after a delete) cannot happen.
- Every key has a bounded lifetime, so even a lost invalidation has a named end.
- The mark batching alone pays for itself on the list routes.

**Cons**:
- Two code paths per route (hit and miss) and a version read before the payload read on the detail route, so the detail read costs two Redis round trips.
- The marks remain Postgres reads, so a hit is not a database free read.
- An epoch that is bumped by every order makes the whole list family cold after each write.

### Option 4: lifetime only, no invalidation

Write every key with a short lifetime and never bump anything.

**Pros**:
- The smallest possible amount of code, and the smallest number of places that can be wrong.

**Cons**:
- Contradicts the scope's own requirement that a write makes the next read show the new value: the read after a stock move answers the old stock until the lifetime ends.
- With a lifetime short enough to hide that, the hit rate collapses.

## Rationale

Option 3 wins because the two forces in Context point the same way. The payload is shared and the marks are not, so the split is not a compromise but the shape of the data. Versioned keys then make invalidation a counter instead of a search: without a key index, an epoch is the only way to invalidate a family whose keys are built from arbitrary cursors and search strings, and it is also the only scheme that closes the read after write race by construction.

Option 1 was the strongest runner up, and its best part is inside the chosen option: batching the marks is a prerequisite rather than an addition, because a cached list page that still runs two mark queries per card would answer a hit with sixteen queries and buy almost nothing. Option 2 was rejected on the leak, not the cost. Option 4 was rejected because it fails the requirement the scope row opens with.

The rework of the three clauses of the `Done when:` line was accepted with this decision, and the corrected line lands in the scope row at the moment the spec is accepted: until then the row still carries the seed text it was written with.

## Evidence: writes that touch a cached answer

| Writer | File | What it changes |
|---|---|---|
| `createProduct` | `apps/api-astrum/src/modules/product/product.service.ts` | a new product row |
| stock decrement | `apps/api-astrum/src/modules/order/order.service.ts` | `Product.quantity`, `Product.isOutOfStock` |
| stock return, every path | `apps/api-astrum/src/modules/order/order-status.helpers.ts` (`returnOrderStock`, called by `closeOrder` and by `cancelOrderLines` in `apps/api-astrum/src/modules/staff/staff-order.helpers.ts`) | `Product.quantity`, `Product.isOutOfStock` |
| the four entry points of that return | `PATCH /api/orders/:orderId/status`, `PATCH /api/staff/point/orders/:orderId/cancel`, `PATCH /api/staff/courier/orders/:orderId/cancel`, and the expiry cancel of the payment layer (`payment.apply.ts`, `payment.service.ts`) | they all reach the same helper, so one bump placed there covers every writer |
| `createReview` | `apps/api-astrum/src/modules/reviews/reviews.service.ts` | a `Review` row, so the page rating aggregate |
| `likeReview`, `unlikeReview` | the same file | `Review.likeCount`, carried with a review id only, so the guard has to return `productId` |
| `createReviewComment`, `deleteReviewComment` | the same file | `Review.commentCount`, the same limitation |
| shipping methods | no route | seeded and edited in the database only |

References: none. The stack is settled, so nothing here needs a citation: the sources that shaped the decision are the gateway's own code and its `AGENTS.md`, spec 0004 for the Redis client shape the cache copies, and spec 0012 and spec 0021 for the review reads and the card rating the invalidation matrix has to keep fresh.
