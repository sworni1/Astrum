# 0022. Verify steps

Run these against the dev stack after `/develop`. Derive the container credentials at run time, never from a neighbouring spec:

```bash
cd /e/Astrum/Astrum
PSQL="docker exec astrum-db psql -U $(docker exec astrum-db printenv POSTGRES_USER) -d $(docker exec astrum-db printenv POSTGRES_DB)"
REDIS="docker exec astrum-redis redis-cli"
API=http://localhost:3580/api
ID=$($PSQL -t -c 'select id from "Product" where visibility = '"'"'Public'"'"' and status = '"'"'Published'"'"' and "isDeleted" = false limit 1' | tr -d ' ')
```

The routes need a session. Sign in at `http://localhost:3000`, take the `__auth` cookie from the browser once, and export it as `COOKIE='__auth=...'`. Never paste its value into a report or a transcript. All five routes:

```bash
hit_all () {
  for p in "/products/$ID" "/products/recommendations" "/products/categories/electronics" "/products/$ID/reviews" "/shipping-methods"; do
    curl -s -o /dev/null -w "%{http_code} $p\n" -H "Cookie: $COOKIE" "$API$p"
  done
}
```

Expect `200` five times. On a production Redis the client needs `-a "$REDIS_PASSWORD"`; `docker exec astrum-redis printenv REDIS_PASSWORD` prints it.

---

### 1. The cache module exists and can be switched off (AC-1)

**Result**: PASS. `apps/api-astrum/src/cache/` holds `cache.ts`, `cacheKeys.ts`, `cacheStore.ts` and `__tests__/`. `CACHE_CLIENT_OPTIONS` carries `commandTimeout` 100, `connectTimeout` 100, `enableOfflineQueue: false`, `maxRetriesPerRequest: 1` and `lazyConnect: true` (`cacheStore.ts:10` to `cacheStore.ts:37`), the URL comes from `CACHE_REDIS_URL` falling back to `REDIS_URL` (`cacheStore.ts:148`), and the two namespaces are `cache:v1:` and `cache:meta:` (`cacheKeys.ts:4`, `cacheKeys.ts:7`). With `CACHE_ENABLED=false` (gateway on `:3582`) the five routes answered `200` and `redis-cli --scan --pattern 'cache:*'` answered `0`, with not one cache line in that process log, so no client and no socket were built.

```bash
ls apps/api-astrum/src/cache
grep -n "commandTimeout: 100\|connectTimeout: 100\|enableOfflineQueue: false\|lazyConnect: true" apps/api-astrum/src/cache/cacheStore.ts
```

Expect three files (`cache.ts`, `cacheKeys.ts`, `cacheStore.ts`) and four matching option lines. Then start the gateway with `CACHE_ENABLED=false`, call `hit_all`, and count both namespaces:

```bash
$REDIS --scan --pattern 'cache:*' | wc -l
```

Expect `0`. A key of any kind means the switched off cache still wrote.

### 2. The product detail answers from Redis and expires (AC-2)

**Result**: PASS. A miss then a hit: `cmp` of the two saved bodies was silent (1580 bytes each), `ttl` answered `65` on the miss and `64` on the hit, the two log lines read `"hit":false` then `"hit":true`. The unknown uuid answered `404` and left `0` keys.

```bash
curl -s -H "Cookie: $COOKIE" "$API/products/$ID" > /tmp/hit-a.json
curl -s -H "Cookie: $COOKIE" "$API/products/$ID" > /tmp/hit-b.json
diff /tmp/hit-a.json /tmp/hit-b.json && echo "bodies identical"
KEY=$($REDIS --scan --pattern "cache:v1:product:$ID:*" | head -1)
echo "$KEY"; $REDIS ttl "$KEY"
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: $COOKIE" "$API/products/00000000-0000-0000-0000-000000000000"
$REDIS --scan --pattern 'cache:v1:product:00000000*' | wc -l
```

Expect `bodies identical`, a `ttl` from `60` through `66`, `404`, and `0` keys for the unknown id. A `-1` means a payload key was written without a lifetime, which fails the step.

### 3. Two accounts, one cached card, their own marks (AC-3)

**Result**: PASS. Account A (product in its wishlist) read `"isWishlisted":true`, account B read `"isWishlisted":false`, both from the single key `cache:v1:product:ad8155bb-…:v0`. `grep -c` over the values of every `cache:*` key answered `0` for both account ids.

Take the cookie of a second account (`COOKIE_B`), resolve both account ids from the database, put the product in one account's wishlist, and read the same product with both cookies:

```bash
USER_ID_A=$($PSQL -t -c "select id from \"User\" where email = '<first test account email>'" | tr -d ' ')
USER_ID_B=$($PSQL -t -c "select id from \"User\" where email = '<second test account email>'" | tr -d ' ')
curl -s -H "Cookie: $COOKIE"   "$API/products/$ID" | grep -o '"isWishlisted":[a-z]*'
curl -s -H "Cookie: $COOKIE_B" "$API/products/$ID" | grep -o '"isWishlisted":[a-z]*'
for k in $($REDIS --scan --pattern 'cache:*'); do $REDIS get "$k"; done | grep -c "$USER_ID_A"
for k in $($REDIS --scan --pattern 'cache:*'); do $REDIS get "$k"; done | grep -c "$USER_ID_B"
```

Expect `true` for the account holding it and `false` for the other, and `0` from both `grep -c` lines. Any non zero count means a per caller value reached the cache and fails the step.

### 4. The marks are batched, not per card (AC-4)

**Result**: PASS. `read-path.spec.ts` asserts `queryCount()` 4 on the miss and 6 after the second call (2 on the hit) plus one `review.groupBy` for the page of 8; the targeted run was 3 suites and 29 tests green, the full api run 418 passed and 20 skipped.

```bash
pnpm --filter @astrum/api test -- product.service
```

Expect the read path suite to pass with assertions of exactly 4 query calls on a miss and exactly 2 on a hit for a page of 8. A count of 18 means the per card loop survived.

### 5. The reviews route answers with no query on a hit (AC-5)

**Result**: PASS, with a corrected premise. The default `limit` is 20 and the clamp caps at 50, so `limit=77` lands on the `…:v0:50:undefined` key and not on the key of the default page size, so the step cannot print one page shape as written. The clamp-sharing clause was proven the other way: `limit=77` and `limit=60` share `cache:v1:reviews:<id>:v0:50:undefined`, the second one a hit. Bodies were identical across the miss and both clamped hits, and a hit cost no Postgres scan at all while the miss cost 5 (`pg_stat_user_tables` scan total 10739 to 10739 on the hit, 10734 to 10739 on the miss).

```bash
curl -s -H "Cookie: $COOKIE" "$API/products/$ID/reviews" > /dev/null
curl -s -H "Cookie: $COOKIE" "$API/products/$ID/reviews" > /tmp/rev-b.json
curl -s -H "Cookie: $COOKIE" "$API/products/$ID/reviews?limit=77" > /dev/null
docker logs astrum-api 2>&1 | grep '"event":"cache.read"' | tail -3
$REDIS --scan --pattern "cache:v1:reviews:$ID:*" | sed 's/.*:v[0-9]*://' | sort -u
```

Expect the second line of the log to carry `"hit":true` and the first `"hit":false`, and the last command to print one page shape only (`50:undefined`), because `limit=77` clamps to `50` and shares the key of the default page size. The suite of step 4 asserts the query counts (0 on a hit, 5 with `after`, 4 without).

### 6. Shipping methods expire (AC-6)

**Result**: PASS. `cache:v1:shipping` answered `ttl` 32 right after its own write, the second request was a hit in the log, both bodies were identical and the first `price` reached JSON as the number `799`.

```bash
curl -s -H "Cookie: $COOKIE" "$API/shipping-methods" > /dev/null
$REDIS ttl cache:v1:shipping
$REDIS get cache:v1:shipping | head -c 120
```

Expect a `ttl` from `30` through `33` and a JSON body whose first `price` is a number, not a quoted string.

### 7. A write makes the next read fresh (AC-7)

**Result**: PASS. (a) order `201`: `quantity` 13 to 12, `cache:meta:ver:product:<id>` absent to 1, `cache:meta:epoch:lists` to 1, the next detail read answered 12. (b) customer cancel `200`: version 2, quantity back to 13; point worker cancel `200`: version 2, quantity 12; courier cancel `200`: version 3 to 4, quantity 12; the payment expiry narrowed the same way, the sweep closed the order and the version went 5 to 6 with quantity back to 12. (c) a created review `201` grew `cache:meta:epoch:lists` by one and `cache:meta:ver:reviews:<id>` to 1, and the card on the category page moved from `averageRating` 0, `reviewCount` 0 to 4 and 1, read from the new epoch key `cache:v1:lists:7:cat:Toys:…` as a miss. (d) like grew the review version to 2, unlike to 3, comment to 4, comment deletion to 5. (e) `POST /api/products` answered `200` and grew the epoch to 5.

Stock, through an order. Take a product with stock above zero, then:

```bash
$PSQL -t -c "select quantity from \"Product\" where id = '$ID'"
$REDIS get cache:meta:ver:product:$ID
# create an order through the storefront checkout, or POST /api/orders with this line
curl -s -H "Cookie: $COOKIE" "$API/products/$ID" | grep -o '"quantity":[0-9]*'
$REDIS get cache:meta:ver:product:$ID
```

Expect the quantity one lower and the version one higher per line of the order. Then cancel, twice, once per path:

```bash
curl -s -X PATCH -H "Cookie: $COOKIE" -H "Content-Type: application/json" -d '{"status":"CANCELED"}' "$API/orders/<orderId>/status"
curl -s -X PATCH -H "Cookie: <point worker cookie>" "$API/staff/point/orders/<orderId2>/cancel"
```

The first is the customer route `PATCH /api/orders/:orderId/status`, the second the point worker route, and the courier route is `PATCH /api/staff/courier/orders/:orderId/cancel`. Each next read answers the returned quantity and the version grows again. A version that does not move means the writer was not wired, and the read then answers old stock until the lifetime ends.

Reviews, rating and counters:

```bash
$REDIS get cache:meta:epoch:lists
# create a review for a delivered line of this product
curl -s -H "Cookie: $COOKIE" "$API/products/recommendations" | grep -o "\"id\":\"$ID\"[^}]*\"averageRating\":[0-9.]*"
$REDIS get cache:meta:epoch:lists
$REDIS get cache:meta:ver:reviews:$ID
# like the review, then comment on it
$REDIS get cache:meta:ver:reviews:$ID
```

Expect the lists epoch to grow on the review, and the reviews version to grow on the review, on the like and on the comment. `POST /api/products` grows the lists epoch by one.

### 8. A dead cache does not fail a read or a write (AC-8)

**Result**: PASS. With `CACHE_REDIS_URL=redis://127.0.0.1:6390` (gateway on `:3583`) the five routes answered `200` in 0.012 to 0.122 s, an order answered `201`, the log carried 17 `cache.error` and 1 `cache.invalidate.error` lines at `warn`, and the access log held no `500`.

```bash
CACHE_REDIS_URL=redis://127.0.0.1:6390 pnpm --filter @astrum/api dev
hit_all
# create an order while the cache is dead
docker logs astrum-api 2>&1 | grep '"event":"cache.error"' | tail -1
docker logs astrum-api 2>&1 | grep '"event":"cache.invalidate.error"' | tail -1
```

Expect `200` five times, a created order that commits, and one line of each warning. A `500` means a cache error escaped into the handler, and a missing `cache.invalidate.error` means a failed invalidation is silent. The session store keeps its own `REDIS_URL`, which is the point of the separate cache URL: pointing the cache at a closed port must not sign the account out.

### 9. A slow cache costs a tenth of a second (AC-9)

**Result**: PASS. `cacheStore.spec.ts` asserts `commandTimeout` 100, `connectTimeout` 100, the four other bounded options and the rejection of a store that never settles; the live dead cache pass above shows a whole read answered inside the budget instead of waiting on the cache.

```bash
pnpm --filter @astrum/api test -- cache
```

Expect the suites that assert `commandTimeout: 100`, `connectTimeout: 100` and the stalled store to pass: the cache call rejects inside the budget and the route answers from Postgres.

### 10. Every payload key carries a lifetime (AC-10)

**Result**: PASS, with a sampling note. Each payload `ttl` was read right after its own write and printed 66 (product), 31 (recommendations), 60 (reviews) and 30 to 32 (shipping, category), and the count of `-1` among payload keys was `0`. Read a few seconds later the same keys print lower integers, because the lifetime decays, so a single later sweep of all keys can print 29 and is not a failure.

```bash
$REDIS --scan --pattern 'cache:v1:*' | while read k; do echo "$($REDIS ttl "$k") $k"; done | sort -n | head -3
$REDIS --scan --pattern 'cache:v1:*' | while read k; do $REDIS ttl "$k"; done | grep -c '^-1$'
$REDIS --scan --pattern 'cache:meta:*' | while read k; do $REDIS ttl "$k"; done | sort -u
```

Expect the smallest few payload lifetimes at `30` or above, `0` from the `-1` count, and `-1` only from the counter keys.

### 11. One log line per cache read (AC-11)

**Result**: PASS. The five route pass added exactly 5 `cache.read` lines, each carrying `key`, `hit` and `ms`, and the four list reads carried `epochKey` beside `key`. The second request over each route logged `"hit":true`.

```bash
docker logs astrum-api 2>&1 | grep -c '"event":"cache.read"'
curl -s -H "Cookie: $COOKIE" "$API/products/recommendations" > /dev/null
docker logs astrum-api 2>&1 | grep -c '"event":"cache.read"'
docker logs astrum-api 2>&1 | grep '"event":"cache.read"' | tail -1
```

Expect the count one higher after the request, and a line carrying `key`, `hit` and `ms`, with `epochKey` beside `key` on the list read because that read touches two keys.

### 12. Nothing on the wire changes (AC-12)

**Result**: PASS. `pnpm --filter @astrum/api test` 418 passed, `pnpm --filter @astrum/customer test` 365 passed across 66 files, `pnpm check-types` 5 of 5 tasks successful, and `git status --short apps/customer/src` printed nothing.

```bash
pnpm --filter @astrum/api test && pnpm --filter @astrum/customer test && pnpm check-types
git status --short apps/customer/src
```

Expect three green commands and an empty `git status` for the storefront. A changed storefront file means the cache changed the contract, not just the source of it.

### 13. The configuration is wired (AC-13)

**Result**: PASS. The four variables sit in `apps/api-astrum/.env.example`, the root `.env.example` and `.env.prod.example`, and `docker compose -f docker-compose.prod.yml --env-file .env.prod config --quiet` exited `0`.

```bash
grep -n "CACHE_" apps/api-astrum/.env.example .env.example .env.prod.example
docker compose -f docker-compose.prod.yml --env-file .env.prod config --quiet; echo "exit=$?"
```

Expect four variables in each of the three templates and `exit=0`. The api service reads them through `env_file: .env.prod`, so it needs no `environment:` entry.

### 14. The scope row tells the truth (AC-14)

**Result**: PASS, with a corrected premise. The map row reads `0 done / 1 in progress / 0 planned` rather than `1 planned`, because the feature's `Build it` box is ticked; the clause's intent (one enrolled feature, none done) holds. The `Done when:` line carries the shared part from Redis, the marks at two queries per page, the refusal only on a slow or broken cache and invalidation on the writers that exist today, and `Design it (spec)` is ticked with the path to this spec.

```bash
sed -n '18,30p' docs/scope/api-astrum/scope.md
grep -n "api-astrum" docs/scope/index.md
```

Expect a `Done when:` line that names the shared part in Redis, the marks at two queries per page, a refusal only on a slow or broken cache and invalidation on the writers that exist; a ticked `Design it (spec)` box carrying the path to this spec with the build milestones under it; and `0 done / 1 planned` still in the map.

---

## Verdict

**PASS**. All 14 acceptance criteria are met and every specced surface exists and behaved as specced: the product detail, the recommendations page, the category page, the product reviews page and the shipping methods list. No criterion is specced but missing, and no migration was owed.

Run on 2026-11-16 against the dev stack. A gateway was started for this run on `:3581` (cache on, defaults), beside `:3582` (`CACHE_ENABLED=false`) and `:3583` (`CACHE_REDIS_URL=redis://127.0.0.1:6390` for the dead cache). The gateway the owner already had on `:3580` was left untouched.

## Run notes

**Fixtures made for this run.** Two throwaway accounts (`cache.verify.a@example.com`, `cache.verify.b@example.com`), registered through `POST /api/auth/register` and set to `ACTIVE` with one `UPDATE`, because sign in answers `403` for a `PENDING` account and the confirmation mail needs a mailbox step. Account A owned a temporary `Business` row so that `POST /api/products` could run at all (that route answers `403 SELLER_NOT_ASSIGNED` for a user without one). Account B was made a point worker at `PickupPoint Mira` and a courier, so the two staff cancels could be driven. One order per stock path: the customer cancel, the point cancel, the courier cancel, the payment expiry and three review orders.

**Seeded states, and why.** The point and courier cancel routes refuse an order that is not `SHIPPED` (`409 ORDER_NOT_SHIPPED`), and no route in this repository moves an order to `SHIPPED` for a cash pickup order, so `Order.status` was set to `SHIPPED` in SQL before each cancel. The expiry branch was reached by moving `Order.paymentExpiresAt` and `Payment.expiresAt` five minutes into the past and letting the payment sweep run its sixty second tick, which closed the order and returned the stock. Two reviews needed a delivered line, so one order item per review was set to `DELIVERED` in SQL (that is the state the customer screen reaches after a handover).

**Cleanup.** The seven orders, both reviews, the probe product, the temporary business, the point worker row, the courier row and every throwaway account were deleted afterwards; `Product.quantity` was restored to 13 and 2. No fixture row from this run is left, confirmed by one query at the end.

**Harness switches.** None were needed. No browser was driven: every behaviour in this checklist is reachable over HTTP, Redis and psql, so each one was proven there and no criterion rests on a screenshot.

**Observed, but outside this feature.** `POST /api/cart` answers `500` with a bare `{"message":"Internal Server Error"}` when the product is already in the caller's cart, reproduced twice on `:3581` with a fresh account. The cart path is not cached, so this is not a regression from spec 0022; it is recorded in `docs/scope/api-astrum/scope.md` under `## Deferred`.
