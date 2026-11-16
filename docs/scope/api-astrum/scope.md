# Scope: Astrum api gateway

Every read and write of users, products, cart, wishlist, orders, reviews, shipping, pickup points and staff goes through this Express service, and the storefront talks to nothing else except the auth proxy.

**Build approach:** Tracer Bullet (every feature runs end to end through the storefront and the gateway).
**Workflow:** Beta (after `/develop`: `/check verify`, then `/test`). A feature can carry its own tag to raise or lower that.

_These are recommendations to keep the build orderly, not requirements. Skip anything that does not fit. You decide when a feature is `done`._

## At a glance

| #   | Feature                        | Phase   | Status  |
| --- | ------------------------------ | ------- | ------- |
| 1   | Redis cache for frequent reads | Slice 1 | done |

## Slice 1: Reads off the database

### 1. Redis cache for frequent reads · done · GA

Redis holds one `session:<sid>` record per signed in session and nothing else (`src/session/sessionStore.ts`), so every visit reads the same rows again: the product page, the category listing, the recommendations, the reviews of a product and the shipping methods. Price and stock sit inside those answers, and the writes that change them are spread across the product, review, order and shipping modules.
**Done when:** a repeated read of a catalogue route answers its shared part from Redis, and one log line per cache read names the key, whether it was a hit or a miss, and how long the answer took; the caller's own cart and wishlist marks stay live at two queries per page instead of two per card, so two accounts read one cached card and each still sees its own marks; a write that changes a cached answer makes the next read show the new value, and those writes are the ones that exist today (a product creation, a new review, a like or a comment, an order that moves stock, and every stock return from the customer, point worker and courier cancels and from the payment expiry paths), so no stale price and no stale stock reaches a screen; a slow or broken cache never fails a read and never fails a write, the answer falls back to the database, while a dead Redis is caught earlier by the session guard every catalogue route already runs; and every cached payload carries a lifetime, so no answer stays stale past a named bound.
- [x] Design it (spec): `/architect redis cache for frequent reads`
- [x] Build it: `/develop redis cache for frequent reads`
  - [x] Cache module, keys, client, config and the reviews route end to end (AC-1, AC-5, AC-13) — done: `src/cache/` built; live 200 with `cache:v1:reviews:…:v0:20:undefined` and TTL 30-33
  - [x] Shipping route and the batched marks on the list path (AC-4, AC-6) — done: live `cache:v1:shipping` hit; read-path suite asserts 4 queries on a miss and 2 on a hit
  - [x] Lists and product detail cached under the epoch and the per product version (AC-2, AC-3, AC-12) — done: two passes answer byte identical bodies, no account id in any cached value
  - [x] Invalidation from every stock and review writer (AC-7) — done: live order create raised `ver`/`epoch` to 1, customer cancel to 2, a like raised `ver:reviews`; dead cache logs `cache.invalidate.error`
  - [x] Failure suite, gates, live pass and the corrected row (AC-8, AC-9, AC-10, AC-11, AC-14) — done: 418 api tests green, `CACHE_ENABLED=false` leaves 0 keys, a dead cache URL answers 200 five times
- [x] Verify it: `/check verify redis cache for frequent reads` — done: 2026-11-16, PASS, all 14 acceptance criteria proven live on the dev stack (per criterion evidence in the spec `verify.md`)
- [x] Test it: `/test redis cache for frequent reads` — waived on 2026-11-16 when the feature was closed; the suites that do exist are green (api 418 passed and 20 skipped, customer 365 passed over 66 files, `pnpm check-types` 5 of 5) and `read-path.spec.ts` asserts the 4 query miss and the 2 query hit
- [x] Review it (fresh model): `/check review redis cache for frequent reads` — waived on 2026-11-16; no fresh model pass was run
- [x] Document it: `/document redis cache for frequent reads` — waived on 2026-11-16; the spec, its rationale and the `verify.md` record are the documentation that exists
  spec [0022](../../specs/api-astrum/0022-redis-cache-for-frequent-reads/index.md)

## Legend

- **Next step** = the first unticked box.
- **Status**: `planned` → `in-progress` → `done`, plus `existing` (built before this scope) and `dropped`.
- A row with `Design it (spec)` runs `/architect` first; the tag `needs a decision` is implied by that box.
- **Workflow tag** beside a heading (for example `· GA`) overrides the project default for that feature.

## Deferred

- **`POST /api/cart` answers 500 for a product already in the cart**: a repeat add returns `{"message":"Internal Server Error"}` instead of a coded refusal, reproduced twice on a fresh account; the cart path carries no cache, so it predates and sits outside spec 0022 · bug, found while verifying spec 0022

