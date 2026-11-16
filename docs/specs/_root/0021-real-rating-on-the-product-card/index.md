# 0021. Real rating on the product card

**Date**: 2026-11-15
**Status**: In Progress

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The product card prints a rating that comes from two places nobody maintains: `Product.stars` (written only by the Excel seed, which invents it out of the product description) and `_count.impressions` (the legacy `Impression` table, which holds 0 rows in the dev database and has no writer anywhere in the repository). The product screen already shows the true average and the true count, read from `Review` through `/api/products/:productId/reviews`. This decision removes `Impression` from the schema and from every read, and gives the card the same numbers the product screen shows: one `groupBy` over the approved reviews of the page, carried on each product of the recommendations answer. The card keeps its layout and prints `0 (0)` for a product nobody has reviewed.

## Requirements

**User stories**:

- As a customer, I want the stars and the count on a card to be the same rating I read on the product screen, so that I can judge two products without opening both.
- As a customer, I want a card of a product with no reviews to say so honestly, so that no invented rating talks me into a purchase.
- As the shop, I want one rating source, so that a fixed review never leaves a stale number on a card.

**Acceptance criteria** (the contract):

- **AC-1**: The `Impression` model and the `Product.impressions` relation are gone from all four schema copies (`packages/Astrum-db/prisma/schema.prisma` and the identical copies in `apps/api-astrum`, `apps/auth-astrum`, `apps/worker`), the four copies stay byte identical to each other, and one migration drops the table: `packages/Astrum-db/prisma/migrations/20261115120000_drop_impression/migration.sql` carries `DROP TABLE "Impression";`. `grep -n "Impression" packages/Astrum-db/prisma/schema.prisma apps/*/prisma/schema.prisma` returns no match, `prisma migrate status` answers `Database schema is up to date!`, and `\dt` in `astrum-db` lists no `Impression` table. The table is empty when the migration runs (`select count(*) from "Impression"` answered `0` on 2026-11-15) and nothing is backed up, because a row nobody wrote carries no information.
- **AC-2**: No read of the table survives. `grep -rn "impressions\|Impression" apps/api-astrum/src apps/customer/src` returns no match: `productPreviewPublicSelect` and `productPublicSelect` carry no `impressions` field and no `_count`, `getProduct` maps no `impressions` array and no `_count`, the `Impression` interface is gone from `apps/customer/src/common/types/product.types.ts`, and the string `"Impression"` leaves the `TRUNCATE` statement of `packages/Astrum-db/prisma/seedFromExcel.ts`, so the seed still runs.
- **AC-3**: `GET /api/products/recommendations` answers every product with `averageRating` (a number rounded to two decimals, `0` when there is none) and `reviewCount` (an integer, `0` when there is none), computed from `Review` rows whose `status` is `APPROVED`. The page costs exactly one extra query, a single `prisma.review.groupBy` over the ids of the page (`by: ["productId"]`, `_count: { _all: true }`, `_avg: { rating: true }`), never one query per product. A `REJECTED` or `PENDING` row never counts and never enters the average: on the dev database `Самокат Tech Team V-Tech` holds four reviews of which one is `REJECTED` (3, 4, 5, 5 approved), so the answer is `averageRating: 4.67` and `reviewCount: 3`, and `Ручка Parker Urban T200 Muted Black GT` answers `averageRating: 5` and `reviewCount: 1`.
- **AC-4**: `GET /api/products/categories/:category` answers the same two fields with the same rule, because it is the same service method (`getCategoryProducts = this.getRecommendations`), and a search inside a category changes nothing about them.
- **AC-5**: The storefront types follow the answer: `ProductCardProps` carries `averageRating: number` and `reviewCount: number` and loses `stars` and `_count`; the `ProductOverview` type loses `_count`; `Product` in the same file keeps `stars`, because `getProduct` still answers it. No component reads `stars` for a rating any more: `grep -rn "stars" apps/customer/src --include=*.tsx` matches only the review feature's own rating controls and the card's own prop plumbing.
- **AC-6**: The rating line of the card renders on every card, in the layout the card has today (`CardFooter`, the `flex justify-between items-center w-full` row, the yellow `FaStar`, `text-sm`): the average with one decimal through the product screen's own rule (`toFixed(1)`) when `reviewCount` is above zero, the bare `0` when it is zero, then the count in parentheses. So a reviewed product prints `4.7 (3)` and an unreviewed one prints `0 (0)`. The card carries no new catalog key: the line prints numbers only, and both languages render the same characters.
- **AC-7**: The product screen changes in nothing it already proved: `GET /api/products/:productId` stops answering the `impressions` array and the `_count` object (AC-2), and the header keeps reading the aggregate of `/reviews` exactly as spec 0012, AC-5 set it. `productPublicSelect` keeps every other field it selects today, `stars` included.
- **AC-8**: The two debug lines that a diagnosis left in the tree are gone: `product.service.ts` logs nothing, and `Recommendations/index.tsx` logs nothing. `grep -rn "console\." apps/api-astrum/src/modules/product apps/customer/src/features/pages/Home` returns no match beyond `console.error` in the error paths a suite requires.
- **AC-9**: Nothing that already passed breaks: `pnpm --filter @astrum/api test`, `pnpm --filter @astrum/customer test` and `pnpm check-types` are green, and `pnpm --filter @astrum/customer lint` reports no error. `ProductService.createProduct` and the seller write path are untouched, and the seed's `prisma generate` runs against the four field schemas.
- **AC-10**: The plan stays honest: `docs/scope/_root/scope.md` gains feature 22 under the reviews slice with its build line, its row leaves `## Deferred`, and `## Fixed` carries it · the Follow-up checklist of spec 0012 ticks the card item and names this spec as the closure.

## Decision

**Chosen option**: Option 1: read the live aggregate, delete the dead table.

The card reads the same aggregate the product screen reads, computed per page in one query, and `Impression` goes away entirely. `Product.stars`, `Product.reviewCount` and `Product.averageRating` stay as they are (written by nothing, read only by the seed's own column and by no screen), because their fate is its own row in `docs/scope/_root/scope.md` and removing three columns while removing a table would make one commit carry two decisions.

**Implementation skills**: none consulted. The storefront part follows `apps/customer/AGENTS.md` (S1 to S5).

## Feature design

**Data model sketch**: one table dropped, no column added.

| Entity | Change | Use in this decision |
|---|---|---|
| `Impression` | dropped | The legacy review row nobody writes. Replaced by `Review` since spec 0012. |
| `Product.impressions` | relation removed | Only the select and one mapping read it. |
| `Product.stars` | kept, unread by the card | Seeded from the Excel description; a decision of its own. |
| `Review` | read only | `status: APPROVED` rows are the rating and the count. |

**Read path**: `getRecommendations` fetches the page, then asks `prisma.review.groupBy` for those ids once, and folds the two numbers into each product before it answers. The category route rides the same method, so it inherits the numbers with no second implementation.

## Build plan

1. Schema and migration: drop `Impression` from the four copies, write `20261115120000_drop_impression`, drop the table from the seed's `TRUNCATE`, `pnpm db:generate`, `pnpm prisma:migrate:deploy`, prove the table is gone (AC-1, AC-2).
2. Gateway read: strip `impressions` and `_count` from both selects and from the `getProduct` mapping, add the one `groupBy` and the two fields to `getRecommendations`, remove the debug line (AC-2, AC-3, AC-4, AC-7, AC-8).
3. Storefront: `ProductCardProps` and the `ProductOverview` type, `StarRating` on the new props with both number shapes, the `Recommendations` debug line removed (AC-5, AC-6, AC-8).
4. Gates, then the walk of `verify.md` against the running stack (AC-9).
5. Docs: the scope row, the `## Fixed` entry and the spec 0012 follow-up (AC-10) — done: this file, and the rows in `docs/scope/_root/scope.md`.
