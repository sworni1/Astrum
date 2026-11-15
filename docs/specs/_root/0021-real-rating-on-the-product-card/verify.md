# 0021. Real rating on the product card — verify

Run from the repository root on the dev stack (`pnpm dev` or the four containers up). Each step names the criterion it proves.

## 1. The table is gone (AC-1)

```
grep -n "Impression" packages/Astrum-db/prisma/schema.prisma apps/api-astrum/prisma/schema.prisma apps/auth-astrum/prisma/schema.prisma apps/worker/prisma/schema.prisma
```
Expected: no match, exit code 1.

```
cd packages/Astrum-db && npx prisma migrate status
```
Expected: `Database schema is up to date!` with 14 migrations found.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c '\dt' | grep -i impression
```
Expected: no match.

## 2. No read of the table survives (AC-2)

```
grep -rn "impressions\|Impression" apps/api-astrum/src apps/customer/src
```
Expected: no match.

```
grep -n "TRUNCATE" packages/Astrum-db/prisma/seedFromExcel.ts
```
Expected: the statement names `"ProductProperty"` and `"Product"`, not `"Impression"`.

```
pnpm db:generate
```
Expected: `Generated Prisma Client`, no error.

## 3. The answer carries the real numbers (AC-3, AC-4)

With a customer session cookie in `$COOKIE`:

```
curl -s -b "$COOKIE" http://localhost:4000/api/products/recommendations | jq '.products[] | {name, averageRating, reviewCount}'
```
Expected: every object carries both fields; a product with no review answers `"averageRating": 0, "reviewCount": 0`.

```
curl -s -b "$COOKIE" http://localhost:4000/api/products/products/<parket-product-id> 2>/dev/null
curl -s -b "$COOKIE" "http://localhost:4000/api/products/recommendations" | jq '[.products[] | select(.name | test("Parker"))]'
```
Expected: `averageRating: 5`, `reviewCount: 1`.

```
curl -s -b "$COOKIE" "http://localhost:4000/api/products/categories/toys" | jq '.products[0] | {averageRating, reviewCount}'
```
Expected: both fields present, same shape.

Cross check against the database:

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c 'select "productId", count(*), round(avg(rating)::numeric, 2) from "Review" where status = '"'"'APPROVED'"'"' group by 1;'
```
Expected: each card of those products prints the same count and the same average with one decimal (`4.67` prints as `4.7`).

## 4. The card prints the line (AC-6)

Open `/` in the browser at 1440x900.

Expected: every card carries the star row; `Самокат Tech Team V-Vech` family cards read `4.7 (3)`, `Ручка Parker …` reads `5.0 (1)`, a product nobody reviewed reads `0 (0)`. No card prints `4.7 (0)` and none drops the row.

Open a product from a card and compare: the product screen header prints the same average and the same count.

## 5. The product screen is untouched (AC-7)

```
curl -s -b "$COOKIE" http://localhost:4000/api/products/<product-id> | jq 'keys' | grep -i "impressions\|_count"
```
Expected: no match; `stars` still present.

## 6. Nothing logs (AC-8)

```
grep -rn "console\." apps/api-astrum/src/modules/product apps/customer/src/features/pages/Home
```
Expected: no match.

## 7. The gates (AC-9)

```
pnpm --filter @astrum/api test
pnpm --filter @astrum/customer test
pnpm check-types
```
Expected: every suite passes, types 5 of 5.

## 8. The documents (AC-10)

```
grep -n "22\. Real rating on the product card" docs/scope/_root/scope.md
grep -n "Review count on the product card" docs/scope/_root/scope.md docs/specs/_root/0012-reviews-on-the-product-screen/index.md
```
Expected: the first finds the feature block; the second finds no open Deferred row, and the spec 0012 follow-up item is ticked with the pointer to this spec.
