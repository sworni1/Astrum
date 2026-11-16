# 0021. Real rating on the product card — rationale

## Context

`ProductCard` (`apps/customer/src/features/general/ProductCard/index.tsx:32`) prints `_count?.impressions ?? 0` as a review count and `product.stars` as the rating. Both are dead ends:

- `Impression` holds **0 rows** in the dev database and has **no writer** in the repository: no `prisma.impression.*` call, no route, no seed (`seedFromExcel.ts` writes only `stars`). Reviews moved to `Review` in spec 0012 and nothing migrated the old rows, because there were none.
- `Product.stars` is written by the Excel seed alone, which parses it out of the product description (`extractStars`), so 3929 of 4752 products carry `0` and the rest carry a number invented by a spreadsheet.
- The product screen (`ProductOverview`, spec 0012 AC-5) already shows the truth: `aggregate.averageRating` and `aggregate.total` from `/api/products/:productId/reviews`.

Measured on 2026-11-15 in `astrum-db`:

| Product | `stars` | `reviewCount` | `averageRating` | `Impression` rows | `Review` rows (approved) |
|---|---|---|---|---|---|
| Самокат Tech Team V-Tech | 0 | 0 | 0 | 0 | 4 (3) |
| Ручка Parker Urban T200 Muted Black GT | 0 | 0 | 0 | 0 | 1 (1) |

The card therefore printed `0 (0)` for a product the product screen rated `4.67` out of 3 reviews.

## Options

1. **Read the live aggregate on the card.** One `groupBy` over the page's product ids, the two fields added to the recommendations answer, `Impression` deleted. Always true, no backfill, one source of truth. Cost: one extra query per page of eight cards.
2. **Maintain `Product.reviewCount` and `Product.averageRating` on write.** Call the already written `ReviewsService.updateProductAggregates` when a review is created (and once more on any future moderation), then let the card read columns. Cheaper on read, but it needs a backfill for the rows that exist today, a second source of truth that can drift, and the write path of spec 0012 to change for a cosmetic number.
3. **Drop the rating from the card.** Zero cost, but the owner wants the line kept: he chose `0 (0)` over hiding it, and the card is the only place a customer compares products.

## Chosen: option 1

The product screen already proved that a live aggregate is fast enough for one product; a page of eight needs one grouped query for all of them, which is cheaper than eight single-product reads. Option 2 buys one column read at the price of a second truth and a backfill; the scope already carries the three unmaintained columns as a decision of their own, and this spec does not open it.

## Consequences

**Good**: one rating source; a card can never disagree with the product screen; the schema loses a table and every select loses a nested count; the seed keeps working with one line less.

**Neutral**: the recommendations answer grows two fields per product; `Product.stars` stays readable and unread by the card; the products seeded with a fabricated rating now show `0 (0)` until a real review arrives, which is the honest number.

**Bad**: none found. The dropped table is empty, so no data is lost, and no client code reads `averageRating` off a card today, so nothing else changes shape.

## Follow-up

- [ ] Decide the fate of `Product.stars`, `reviewCount` and `averageRating` with `ReviewsService.updateProductAggregates` (already open in `docs/scope/_root/scope.md` · from spec 0012).
- [ ] A gateway suite of its own for `getRecommendations`: the product suite covers `createProduct` only, so the two new fields ride a route with no test that fails without them.
