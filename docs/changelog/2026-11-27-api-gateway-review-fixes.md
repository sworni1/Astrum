# 2026-11-27 · API gateway review fixes

A full review of `apps/api-astrum` (two HIGH, seventeen MEDIUM and eight LOW findings, plus items already listed in the scope's Deferred block) was fixed in one pass. The shape-changing decisions are recorded in [ADR 0004](../adr/0004-api-gateway-surface-hardening.md); this entry lists the changes themselves.

## Security

- `PATCH /api/staff/courier/orders/:orderId/handover` now mounts `requireCourier` between the account gate and the controller, like every other courier write. A revoked courier can no longer hand over parcels it had claimed.
- Courier handover and release check `courierUserId === caller` before reading `handedOverAt`, so a foreign parcel answers `404 ORDER_NOT_FOUND` instead of leaking that it was handed over.
- `helmet` runs its default set with CSP disabled and `Cross-Origin-Resource-Policy: cross-origin`, instead of the single CORP middleware.
- A fixed-window in-process limiter guards the gateway (`600/min` per address) and the auth proxy (`30/min`); `RATE_LIMIT_ENABLED=false` disables it, and it is off under `NODE_ENV=test`.
- `jsonwebtoken` verification pins `algorithms: ["HS256"]` for both session and guest tokens; `JWT_SECRET` and `DATABASE_URL` are required at boot in `server.ts`.
- CORS origins come from `CORS_ALLOWED_ORIGINS` (comma separated) with the localhost pair as fallback; morgan uses `combined` in production.
- `ownerForWrite` refuses with `503 SESSION_STORE_UNAVAILABLE` when `optionalAuth` saw a session-store failure, instead of minting a throwaway guest identity and losing the write.
- Order JSON no longer carries `userId` or per-line `userId`.

## Correctness

- Stripe webhook: a failed apply deletes the deduplication row so the provider retry is not answered as a replay (`payment.webhook.service.ts`). Covered by a new test.
- Payment sweep closes an overdue online-card order that has no payment attempt at all, instead of logging `no_attempt` forever.
- Cancellation expires the provider session after the transaction commits, in the customer, point-worker and courier cancel paths, so a refused cancel no longer kills a live payment link.
- Password change answers `401 INVALID_OLD_PASSWORD` for a wrong old password instead of `500`; the session is revoked after the update, not before.
- Account deletion maps `P2025` to `404 USER_NOT_FOUND` and `P2003` to `409 USER_DELETE_RESTRICTED` instead of reporting every failure as “User not found”.
- `GET /api/orders` accepts `page`/`limit` (validated by `parsePagination`) and returns `page`, `limit`, `total`, `totalPages`; the query is bounded.
- Product catalogue cursor pagination is deterministic (`createdAt desc, id desc`), reads `limit + 1` for `hasNextPage`, validates the cursor against the public catalogue (`400 PRODUCT_INVALID_CURSOR`), and no longer asks for an extra empty page when the last page is exactly full.
- Unknown category slugs answer `400 UNKNOWN_CATEGORY`; `all` keeps meaning “no category”, and the catalogue cache key now always includes the category slot and the search query, so a menu search can no longer fill the recommendations key.
- `origin`, `search_query` and `cursor` query parameters are validated as single strings; arrays answer `400 PRODUCT_INVALID_QUERY` instead of reaching Prisma.
- Order shipping and delivery lock the order row (`lockOrder`) before moving lines.

## HTTP surface

- Terminal error middleware (`expressErrorHandler`) answers `400 INVALID_JSON` and `413 PAYLOAD_TOO_LARGE`; a JSON 404 handler answers `ROUTE_NOT_FOUND` for unmatched routes.
- Guest review reads: `/api/reviews` mounts `optionalAuth`; like, unlike, comment create and comment delete keep `requireSession` + `requireActiveAccount`. Comment serialization accepts a nullable viewer.
- `GET /api/reviews/:reviewId` returns an `APPROVED` review through `serializeReview`, not the raw row.
- Review cache key encodes an absent cursor as `-`, so `after=undefined` no longer serves the first page with `200` instead of `400 REVIEW_INVALID_CURSOR`.

## Cart and wishlist

- `quantityLimit` is a `409 CART_QUANTITY_LIMIT`; a missing cart line maps to `404 CART_ITEM_NOT_FOUND`; blanket `catch` blocks that turned every failure into `500` are gone.
- `DELETE /api/cart/:productId` and `DELETE /api/wishlist/:productId` use `deleteMany` and are idempotent.
- `POST /api/wishlist` validates that the product exists and is public, mirroring the cart.
- `GET /api/cart` and `GET /api/wishlist` read products, cart quantities and wishlist marks in three batched queries instead of two per line.
- Helper functions in `getWishlistAndCart.ts` no longer swallow the original error.

## Data and events

- `CreateProductDto.quantity` requires an integer in `[1, INT32_MAX]`; `name` and `description` are trimmed; `discount` is non-negative. Product creation now also requires an active account.
- The confirmation publisher retries three times with a short backoff before logging the failure.

## Tests

- New: `rateLimit.spec.ts` (4), `expressErrorHandler.spec.ts` (4), a webhook release test, a sweep close-without-attempt test, product cursor and ordering tests, a guest-write refusal test, and a public-serializer review test.
- Updated: cart/wishlist owner suites for the batched reads and idempotent deletes; order service and controller suites for pagination; point-order suite for expiry-after-commit; staff route suite asserts the courier write chains; staff integration fixtures now use `DELIVERED → ISSUED`.
- `pnpm check-types` clean; `pnpm test` — 59 suites, 510 passed, 20 skipped (the five `ORDER_DB_TESTS=1` integration suites), run twice.

## Open

- The five database-backed integration suites were not executed: no Postgres was available here. Their fixtures were updated to the current status machine.
- The rate limit is per replica; a Redis-backed counter is owed.
- The webhook still has a crash window between the deduplication insert and the apply; a reconciliation pass over `PaymentEvent.applied = false` is owed.
- Product decisions left untouched: who may grant a staff role, review moderation, log-out-everywhere, the payment row for cash at the door, and the dead `Product.stars/reviewCount/averageRating` columns.
