# 0004: API gateway surface hardening: guest review reads, one error envelope, and a per-process rate limit

- **Status**: Accepted
- **Date**: 2026-11-27
- **Deciders**: project owner, on a full review of `apps/api-astrum`
- **Related**: [spec 0012](../specs/_root/0012-reviews-on-the-product-screen/index.md), [spec 0014](../specs/_root/0014-review-likes-and-comments/index.md), [spec 0015](../specs/_root/0015-payment-through-a-test-provider/index.md), [spec 0028](../specs/_root/0028-guest-cart-wishlist-and-recommendations/index.md), [API scope](../scope/api-astrum/scope.md)

## Context

A review of the gateway found four decisions that change its public shape and were cheaper to settle together than one by one:

- The product page became guest-accessible with spec 0028, but `GET /api/reviews/:reviewId/comments` still sat behind `authenticateToken`. A guest opened the comment thread and always received `401`, while the same page served reviews through `optionalAuth`.
- There was no terminal error middleware and no 404 fallback: a malformed or oversized body answered Express's HTML page, the rest of the API answered `{ code, message }`, and `helmet.crossOriginResourcePolicy(...)` installed one header instead of the helmet default set.
- Nothing limited request rates on the gateway or on the proxied `/api/auth` surface.
- The Stripe webhook recorded the deduplication row before applying the event. When the apply threw, the provider retry hit the unique key and was answered as a replay, so the payment was never applied and no path reconciled it.

## Options considered

1. **Guest review reads**
   - A. Keep `authenticateToken` and hide the thread for guests. Cost: a guest-visible page with a permanently failing control; contradicts spec 0028.
   - B. Mount `/api/reviews` with `optionalAuth`, keep every write behind `requireSession` and `requireActiveAccount`, make the viewer id nullable in the serializer. Chosen.
2. **Error surface**
   - A. Keep per-controller envelopes and accept the HTML fallback for parser errors.
   - B. One terminal error middleware plus a JSON 404 handler. Chosen.
3. **Rate limiting**
   - A. A Redis-backed counter shared by every replica. Cost: a new dependency on Redis for a guard, and a failure mode when Redis is down.
   - B. `express-rate-limit` as a dependency. Cost: a package for a small fixed-window bucket.
   - C. An in-process fixed-window middleware with `RATE_LIMIT_ENABLED`, applied globally (600/min) and on the auth proxy (30/min). Chosen: no new dependency, degrades to per-replica limits that are accepted for now.
4. **Webhook deduplication**
   - A. Keep record-before-apply and add a reconciliation job. Cost: a job that must reconstruct a provider event.
   - B. Delete the deduplication row when the apply throws, so the provider retry is not mistaken for a replay. Chosen; the crash window between insert and apply remains.

## Decision

Review reads are public on the product surface: `/api/products`, `/api/wishlist`, `/api/cart` and `/api/reviews` mount `optionalAuth`; every write on them still runs `requireSession` and, where the account state matters, `requireActiveAccount`. `serializeReviewComment` accepts a nullable viewer and only marks `mine` when a user id is present. `GET /api/reviews/:reviewId` returns an `APPROVED` review through the public serializer, never the raw Prisma row.

The gateway answers from one JSON envelope for every failure: the terminal middleware maps `entity.parse.failed` to `400 INVALID_JSON`, `entity.too.large` to `413 PAYLOAD_TOO_LARGE`, hands `AppError` to `handleErrors`, and a two-argument 404 middleware answers `ROUTE_NOT_FOUND`. `helmet` runs its full default set with CSP disabled because the auth service's confirmation page passes through the same process.

A per-process fixed-window limiter guards the gateway (600 requests a minute per address) and the auth proxy (30 a minute). `RATE_LIMIT_ENABLED=false` turns it off, and it is off in tests.

The Stripe webhook keeps its record-before-apply order as the replay guard, but a failed apply deletes the recorded row before rethrowing, so the provider's retry can apply the event.

## Consequences

- **Positive**: a guest reads reviews and comments on a guest page; clients receive one error shape from every endpoint; brute force on the auth proxy is bounded; a transient failure while applying a paid event no longer loses the payment permanently; the catalogue list is deterministic (`createdAt desc, id desc`) and paginates with `limit + 1`, so infinite scroll cannot duplicate or skip cards; `GET /api/orders` carries `page`, `limit`, `total` and `totalPages`.
- **Negative**: the rate limit is per replica, so three replicas allow three times the budget; a Redis-backed limiter is still owed. Disabling CSP relies on the auth service's own headers for its HTML page. The webhook still has a crash window between the insert and the apply; only a reconciliation job closes it. Public review reads make the serializer the only barrier against leaking account ids, so any new review read must go through it.
- **Follow ups**: a Redis-backed limiter shared by replicas; a reconciliation job for `PaymentEvent.applied = false`; `ORDER_DB_TESTS=1` in CI so the staff integration suites actually run; the staff integration fixtures were updated to `DELIVERED → ISSUED`.
