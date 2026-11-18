# 0028. Guest cart, wishlist and recommendations, verify

Run from the repository root on the dev stack (`pnpm dev` or the four containers up, plus the gateway on `:3580`). Each step names the criterion it proves. `W` is one scratch folder for the whole run: `W="C:/Users/ADMIN/AppData/Local/hermes/cache/scratch/guest-0028"`, created once with `mkdir -p "$W"`. Every cookie jar below lives under `$W`, so `-c` and `-b` never point at a path that native curl cannot write.

`$API` is `http://localhost:3580/api`. No cookie value or token is printed in this file or in a report.

## 1. Schema, columns and the owner check (AC-1)

**Status: PASS** (2026-11-18). The four copies diff clean, `migrate status` answered `Database schema is up to date!`, `\d "CartItem"` and `\d "WishlistItem"` both listed their `CHECK`, `updatedAt` carries `CURRENT_TIMESTAMP`, and the ownerless insert was refused with `new row for relation "CartItem" violates check constraint "CartItem_owner_exactly_one"` while the count answered `0`.

```
for f in apps/*/prisma/schema.prisma; do diff -q packages/Astrum-db/prisma/schema.prisma "$f"; done
```
Expected: no output.

```
cd packages/Astrum-db && npx prisma migrate status
```
Expected: `Database schema is up to date!`.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c '\d "CartItem"' | grep -i check
docker exec astrum-db psql -U greedyghoster -d astrum-db -c '\d "WishlistItem"' | grep -i check
```
Expected: one `CHECK` line per table naming both `userId` and `guestId`, and an `updatedAt` column whose default is `CURRENT_TIMESTAMP`, which is what lets the migration run against the rows that exist.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c \
  "insert into \"CartItem\" (id,\"productId\",quantity) values ('chk_0028','x',1);"
```
Expected: an error naming the check constraint, and the row is not written. Then confirm `select count(*) from "CartItem" where id='chk_0028';` answers `0`.

## 2. The first write issues the identity (AC-2)

**Status: PASS** (2026-11-18). `POST /api/cart` without cookies answered `200` with `Set-Cookie: __guest; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`, the row landed with `userId` empty and `has_guest` true, and `GET /api/cart` and `GET /api/wishlist` answered `200 []` with zero `Set-Cookie` lines.

```
P=$(docker exec astrum-db psql -U greedyghoster -d astrum-db -t -c \
  "select id from \"Product\" where quantity > 3 and id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' limit 1;" | tr -d ' ')
curl -s -D "$W/h2.txt" -o "$W/lines.json" -c "$W/jarA.txt" -X POST -H "Content-Type: application/json" \
  -d "{\"productId\":\"$P\"}" "$API/cart"
grep -i '^set-cookie' "$W/h2.txt" | sed 's/=.*/=<redacted>/'
```
Expected: `HTTP/1.1 200`, one `Set-Cookie: __guest=<redacted>; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c \
  "select \"userId\", (\"guestId\" is not null) as has_guest from \"CartItem\" where \"productId\"='$P' order by \"createdAt\" desc limit 1;"
```
Expected: `userId` empty and `has_guest` true.

```
curl -s -D "$W/h2b.txt" -o "$W/empty.json" "$API/cart"; grep -ci '^set-cookie' "$W/h2b.txt"
```
Expected: `0`, and the body is `[]`.

## 3. A broken token reads as no token (AC-3)

**Status: PASS** (2026-11-18). The forged, the foreign secret and the expired value each read `200 []`, and each write answered `200` with a fresh `Set-Cookie`; `select count(*) from "CartItem" where "guestId"='probe'` answered `0`. The log line was read on a controlled gateway on `:3581`: `{"event":"guest.token.refused","method":"GET","path":"/api/cart/","reason":"invalid signature"}`, with no token inside.

For each of the three cases below, read the cart with a hand written `__guest` and expect `[]` with `200`, then post a product and expect a fresh `__guest` in `Set-Cookie`:

```
curl -s -o "$W/c3a.json" -w "%{http_code}\n" -H "Cookie: __guest=notatoken" "$API/cart"
curl -s -o "$W/c3b.json" -w "%{http_code}\n" -H "Cookie: __guest=$(node -e "const j=require('./apps/api-astrum/node_modules/jsonwebtoken');console.log(j.sign({gid:'probe',typ:'guest'},'wrong-secret'))")" "$API/cart"
curl -s -o "$W/c3c.json" -w "%{http_code}\n" -H "Cookie: __guest=$(cd apps/api-astrum && set -a && . ./.env && set +a && node -e "const j=require('jsonwebtoken');console.log(j.sign({gid:'probe',typ:'guest',exp:1},process.env.JWT_SECRET))")" "$API/cart"
```
Expected: `200` three times, and each body is `[]`.

Then, with the same three values, `POST /api/cart` and expect `200` plus a `Set-Cookie: __guest=` that differs from the value sent.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c \
  "select count(*) from \"CartItem\" where \"guestId\"='probe';"
```
Expected: `0`, because an id inside a token that failed verification is never used as an owner.

## 4. Two guests never share a cart (AC-4)

**Status: PASS** (2026-11-18). The jarless call answered `200 []` while jar A held one line, a `POST` carrying `guestId` in its body wrote under jar B's own id (two guest ids in the table), and the grep over the three modules shows `guestId` only in the test suites and behind `owner.guestId`, with no `req.body`, `req.query` or `req.params` read.

```
curl -s -o "$W/a.json" -c "$W/jarA.txt" -X POST -H "Content-Type: application/json" -d "{\"productId\":\"$P\"}" "$API/cart"
curl -s -o "$W/b.json" -w "%{http_code}\n" "$API/cart"
```
Expected: the second call, carrying no jar, answers `200` with `[]` while the first jar holds one line.

```
curl -s -o "$W/c.json" -c "$W/jarB.txt" -b "$W/jarB.txt" -X POST -H "Content-Type: application/json" \
  -d "{\"productId\":\"$P\",\"guestId\":\"<the value from jarA>\"}" "$API/cart"
docker exec astrum-db psql -U greedyghoster -d astrum-db -c \
  "select \"guestId\", count(*) from \"CartItem\" group by 1 order by 2 desc limit 5;"
```
Expected: the line written under jar B's own id, so the id in the body is ignored and two guest ids exist.

```
grep -rn "guestId" apps/api-astrum/src/modules/cart apps/api-astrum/src/modules/wishlist apps/api-astrum/src/modules/guest | grep -v "owner.guestId"
```
Expected: only reads of the resolved owner, no `req.body.guestId`, no `req.query.guestId`, no `req.params.guestId`.

## 5. A guest token is not a session and a session is not a guest (AC-5)

**Status: PASS** (2026-11-18). A `__guest` value sent as `__auth` answered `401 SESSION_REVOKED` on `/api/users/me` and on `/api/orders`, and a session value sent as `__guest` answered `200 []` with no `Set-Cookie`. The token decodes to `{guestId, typ:"guest", iat, exp}` and carries no `sid`.

- Premise correction (2026-11-18): the step sends the guest value to `/api/cart`, which is no longer behind the session guard after this feature, so that route answers `200 []` by design. The guarded probe above is what proves the criterion.

```
GUEST=$(grep __guest "$W/jarA.txt" | awk '{print $7}')
curl -s -o "$W/c5.json" -w "%{http_code}\n" -H "Cookie: __auth=$GUEST" "$API/cart"
```
Expected: `401`, and the body carries one of `SESSION_MISSING`, `TOKEN_INVALID`, `SESSION_REVOKED`.

```
curl -s -o "$W/c5b.json" -w "%{http_code}\n" -H "Cookie: __guest=$TOK" "$API/cart"
```
Expected: `200` with `[]`, because a session value carries no `typ` of `guest` and is refused as a guest token. `$TOK` is minted in step 11, so run this half after it.

## 6. Catalogue reads without a session (AC-6)

**Status: PASS** (2026-11-18). Recommendations, a category page and a product detail each answered `200` with zero `Set-Cookie`; the same product carried `quantityInCart: 1` for the jar that added it and `0` for a caller with no jar, and `reviewState` answered `{"status":"NOT_PURCHASED","orderItemId":null}`; `/reviews` answered `200` and `/review-likes` answered `{"reviewIds":[]}`; `POST /api/products` and `POST /api/products/:productId/reviews` both answered `401 SESSION_MISSING`.

- Not measured (2026-11-18): the "exactly two queries per page" clause. The dev container has no `pg_stat_statements`, so a per page statement count cannot be read here; the scan delta recorded under step 12 hits the same limit.

```
curl -s -o "$W/rec.json" -w "%{http_code}\n" -c "$W/jarG.txt" -b "$W/jarA.txt" "$API/products/recommendations"
curl -s -o "$W/cat.json" -w "%{http_code}\n" -b "$W/jarA.txt" "$API/products/categories/Electronics"
```
Expected: `200` twice. The product from step 2 carries `quantityInCart: 1` for jar A and `0` for a jar that never added it, and both reads carry no `Set-Cookie`.

```
curl -s -o "$W/rev.json" -w "%{http_code}\n" "$API/products/$P/reviews"
curl -s -o "$W/likes.json" -w "%{http_code}\n" "$API/products/$P/review-likes"
```
Expected: `200` with the review page, and `200` with `[]`.

```
curl -s -o "$W/p6.json" -w "%{http_code}\n" -X POST -H "Content-Type: application/json" \
  -d '{"name":"probe","description":"probe product for 0028","price":1,"quantity":1,"category":"Electronics","currency":"RUB","previewImage":"x"}' "$API/products"
curl -s -o "$W/p6b.json" -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{"rating":5}' "$API/products/$P/reviews"
```
Expected: `401` and `SESSION_MISSING` for both, which is what they answer today.

## 7. Everything else still refuses a guest (AC-7)

**Status: PASS** (2026-11-18). All seven lines answered `401 SESSION_MISSING` with no cookies: `users/me`, `orders`, `shipping`, `pickup`, `staff`, `seller`, `reviews/any-id`.

```
for r in users/me orders shipping pickup staff seller reviews/any-id; do
  printf "%s " "$r"; curl -s -o "$W/g7.json" -w "%{http_code}\n" "$API/$r"; done
```
Expected: `401` on every line.

## 8. The guest reads back what it wrote (AC-8)

**Status: PASS** (2026-11-18). Two cart reads one second apart were byte identical (`cmp` printed `identical`) and carried `id`, `quantity` (the stock, 4), `price`, `previewImage`, `name`, `isWishlisted`, `quantityInCart`; the wishlist read answered `quantityInCart: 1`; after the wishlist add the cart line read `isWishlisted: true`; `DELETE /api/cart/:productId` answered `200 {"isWishlisted":true,"quantityInCart":0}`, the real mark, so the missing `await` is fixed.

```
curl -s -o "$W/r8a.json" -b "$W/jarA.txt" "$API/cart"; sleep 1
curl -s -o "$W/r8b.json" -b "$W/jarA.txt" "$API/cart"; cmp "$W/r8a.json" "$W/r8b.json" && echo identical
```
Expected: `identical`, and the body holds the five selected fields plus `isWishlisted` and `quantityInCart`.

```
curl -s -o "$W/w8.json" -b "$W/jarA.txt" -X POST -H "Content-Type: application/json" -d "{\"productId\":\"$P\"}" "$API/wishlist"
curl -s -o "$W/w8b.json" -b "$W/jarA.txt" "$API/wishlist"
```
Expected: `200` twice, and the wishlist line carries `quantityInCart: 1` from the cart.

## 9. A product that disappeared never reaches the screen (AC-9)

**Status: PASS** (2026-11-18). With `isDeleted` set, both reads answered `200` and held `0` occurrences of the product id while its guest rows were still in the table (`5` in this run, because the earlier steps had already written guest lines; the criterion is that the row survives the read, not the count), and the product was restored straight after.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c "update \"Product\" set \"isDeleted\"=true where id='$P';"
curl -s -o "$W/g9.json" -b "$W/jarA.txt" "$API/cart"; grep -c "$P" "$W/g9.json"
```
Expected: `0`, and the status is `200`.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c \
  "select count(*) from \"CartItem\" where \"guestId\" is not null and \"productId\"='$P';"
```
Expected: `1`, the deliberate cost named in the spec: the row stays until the sweep, and the read never shows it.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c "update \"Product\" set \"isDeleted\"=false where id='$P';"
```
This restore is part of the step, not a cleanup afterthought.

## 10. A repeated add raises the quantity (AC-10)

**Status: PASS** (2026-11-18). Two guest adds answered `200` and `200` and the row went `1 -> 2 -> 3`; two account adds answered `200` and `200` and the row went `1 -> 2`; a product with stock `1` held `1` after two guest adds; a second `POST /api/wishlist` answered `200` and left one row.

```
curl -s -o "$W/a10.json" -w "%{http_code}\n" -b "$W/jarA.txt" -X POST -H "Content-Type: application/json" -d "{\"productId\":\"$P\"}" "$API/cart"
curl -s -o "$W/a10b.json" -w "%{http_code}\n" -b "$W/jarA.txt" -X POST -H "Content-Type: application/json" -d "{\"productId\":\"$P\"}" "$API/cart"
docker exec astrum-db psql -U greedyghoster -d astrum-db -c \
  "select quantity from \"CartItem\" where \"productId\"='$P' and \"guestId\" is not null;"
```
Expected: `200`, `200`, and the quantity grows by one per call, never `500`. Repeat with the account token from step 11 and expect the same.

```
curl -s -o "$W/w10.json" -w "%{http_code}\n" -b "$W/jarA.txt" -X POST -H "Content-Type: application/json" -d "{\"productId\":\"$P\"}" "$API/wishlist"
docker exec astrum-db psql -U greedyghoster -d astrum-db -c \
  "select count(*) from \"WishlistItem\" where \"productId\"='$P' and \"guestId\" is not null;"
```
Expected: `200` and `1`, where the same call answered `500` before this change.

## 11. The merge on sign in (AC-11)

**Status: PASS on every observable clause** (2026-11-18). A guest holding 3 of one product and 1 of a stock `1` product met an account holding 2 and 1: `POST /api/cart/merge` answered `200 {"cartLines":2,"wishlistLines":1}` with a `Set-Cookie`, the account lines became `4` (the stock cap) and `1` (the stock cap), the wishlist line was created, and that id's guest rows went to `0` in both tables. A second call answered `200 {"cartLines":0,"wishlistLines":0}`, a call with a session and no guest cookie answered the same zeros, and a call with no session answered `401 SESSION_MISSING`. A guest line whose product was `isDeleted` was deleted and not counted (`{"cartLines":0,"wishlistLines":0}`).

- Not observed (2026-11-18): the "a merge that throws leaves both tables and the cookie untouched" clause. Inducing a throw inside the transaction needs a code change, which a verify run does not make; `guest.merge.spec.ts` is the only proof of that branch.

Mint a throwaway session with the recipe of `astrum-monorepo`, `references/verifying-the-live-api.md` (register a probe account, set its `status` to `ACTIVE`, read the token into `$TOK`).

```
curl -s -o "$W/m11pre.json" -b "$W/jarA.txt" "$API/cart"
curl -s -o "$W/m11.json" -w "%{http_code}\n" -D "$W/h11.txt" -b "$W/jarA.txt" -H "Cookie: __auth=$TOK" \
  -X POST "$API/cart/merge"
cat "$W/m11.json"; grep -i 'set-cookie' "$W/h11.txt" | sed 's/=.*/=<redacted>/'
```
Note: the `-b` jar and the `-H Cookie` header are both needed, so one request carries both identities. Expected: `200`, a body with `cartLines` and `wishlistLines` above zero, and `Set-Cookie: __guest=<redacted>; Max-Age=0`.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c \
  "select (select count(*) from \"CartItem\" where \"guestId\" is not null) as guest_cart, (select count(*) from \"WishlistItem\" where \"guestId\" is not null) as guest_wishlist;"
```
Expected: `0` and `0` for that jar's id.

```
curl -s -o "$W/m11b.json" -w "%{http_code}\n" -H "Cookie: __auth=$TOK" -X POST "$API/cart/merge"
curl -s -o "$W/m11c.json" -w "%{http_code}\n" -b "$W/jarA.txt" -X POST "$API/cart/merge"
```
Expected: `200` with zeros twice, the second one because the jar's cookie is gone.

The sum and the cap are proved with a second guest line on a product the account already holds, and a product whose stock is `1`:

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c \
  "select p.id, p.quantity, (select quantity from \"CartItem\" c where c.\"userId\"='$UID' and c.\"productId\"=p.id) as in_account from \"Product\" p where p.quantity = 1 and exists (select 1 from \"CartItem\" c where c.\"userId\"='$UID' and c.\"productId\"=p.id) limit 1;"
```
Expected after the merge: the account line holds the stock, never more, and no guest line remains.

## 12. An account read ignores a stale guest cookie (AC-12)

**Status: PASS on the read clause** (2026-11-18). A request carrying both a live `__guest` (two guest lines) and a session answered the account's own two lines, and that id's guest rows stood at `2` before and after, so the read touched nothing.

- Not measured (2026-11-18): the scan comparison. `pg_stat_user_tables` for `CartItem` and `WishlistItem` together moved by `15` around that read, but that total mixes the session lookup, the two cart queries and the marks, and a guest scan cannot be split out without `pg_stat_statements`, which the dev container does not carry. The pre change baseline the step asks for does not exist on this branch either.

```
GUEST=$(grep __guest "$W/jarA.txt" | awk '{print $7}')
curl -s -o "$W/r12.json" -w "%{http_code}\n" -H "Cookie: __auth=$TOK; __guest=$GUEST" "$API/cart"
docker exec astrum-db psql -U greedyghoster -d astrum-db -c \
  "select count(*) from \"CartItem\" where \"guestId\"='${GUEST%%[.=]*}';"
```
Expected: `200` with the account's lines only, and the guest count unchanged, which proves the read touched nothing.

The scan total comes from the same two second `pg_stat_user_tables` reading the `astrum-monorepo` reference describes, restricted to `CartItem` and `WishlistItem`; a read with a session moves it by zero on both, which is what proves the resolver never reads a guest row when a session exists.

## 13. The storefront renders without a cookie (AC-13)

**Status: PASS** (2026-11-18). A profile with no `__auth` and no `__guest` loaded `/`, `/cart`, `/wishlist`, `/categories/Electronics`, `/products/<id>` and `/auth/signin` and stayed on each path, two seconds after load on `/` included; `/checkout` answered `/auth/signin?next=%2Fcheckout` and `/orders` answered `/auth/signin?next=%2Forders`. The network log of a guest page held `/api/cart`, `/api/wishlist`, `/api/products/recommendations` and, on a product page, `/api/products/:id`, `/reviews` and `/review-likes`, with no `/api/users/me` and no `/api/orders`.

Open a fresh browser profile (no `__auth`, no `__guest`) and load each path, reading the final URL:

```
new_tab("http://localhost:3000/"); wait_for_load(); js("location.pathname")
new_tab("http://localhost:3000/cart"); wait_for_load(); js("location.pathname")
new_tab("http://localhost:3000/wishlist"); wait_for_load(); js("location.pathname")
new_tab("http://localhost:3000/checkout"); wait_for_load(); js("location.pathname + location.search")
```
Expected: `/`, `/cart`, `/wishlist`, then `/auth/signin?next=/checkout`. Stay two seconds on `/` and read `performance.getEntriesByType('navigation')[0].name` plus `location.pathname` again: a guest screen that bounced through the fetcher's `endSessionHere` arrives as `/auth/signin`, and that is the failure this step exists to catch.

```
new_tab("http://localhost:3000/orders"); wait_for_load(); js("location.pathname + location.search")
```
Expected: `/auth/signin?next=/orders`.

## 14. The guest screens hold (AC-14)

**Status: PASS at 390 and 1280** (2026-11-18). `scrollWidth/innerWidth` read `383/390` and `1280/1280` on `/cart`, and `383/390` and `1273/1280` on `/wishlist` and on `/`. The guest header carried the cart icon with the line count plus `Войти` and `Регистрация` in place of the avatar; `/cart` carried one notice band with the sign in link and its checkout button pointed at `/auth/signin?next=/checkout`; `/wishlist` rendered the guest line with the account card; the heart on a product card filled on the first press (`fill="currentColor"`, `text-red-600`).

- Defect found (2026-11-18, outside the two widths this criterion names): at a `1037` viewport the header's right cluster ran past the edge (`scrollWidth 1109` against `innerWidth 1037`) and the `Регистрация` button was clipped, so the guest header overflows roughly between `1024` and `1109` pixels. Recorded in `docs/scope/_root/scope.md` under Deferred with that measurement.

On the same fresh profile, with `cdp('Network.setCookie', name="NEXT_LOCALE", value="ru", domain="localhost", path="/", httpOnly=False)` and a reload:

```
js("document.documentElement.scrollWidth === innerWidth")
```
Run at `Emulation.setDeviceMetricsOverride(width=390, height=844, deviceScaleFactor=1)` on `/cart`, `/wishlist` and `/`, then at `1280`. Expected: `true` at both widths on all three.

Read the header and the band on `/cart`: the card icon count equals the guest line count, the `Sign in` and `Register` buttons replace the avatar, and one notice band sits above the lines. Press the heart on `/products/<id>` once as a guest and expect it filled after the answer, `aria-pressed="true"` or the filled icon.

## 15. The return path is closed and the merge runs once (AC-15)

**Status: PASS via the corrected route** (2026-11-18). `acceptedReturnPath` has one definition and two callers (`auth/signin/page.tsx` and `hooks/auth/useAuth.ts`). Signing in from `/auth/signin?next=https://evil.example` landed on `/`. As a guest with two cart lines ticked, `Перейти к оформлению` led to `/auth/signin?next=/checkout`, the sign in landed on `/checkout` with those two lines, and one `POST /api/cart/merge` appeared in the network log; that id's guest rows were gone from both tables afterwards.

- Premise correction (2026-11-18): `/checkout` reconciles the handoff in `sessionStorage` (`useCheckoutRoute`), so a guest who signs in without ticking a line is sent back to `/cart` with the `nothingSelected` toast, which is what the step as written produced. The criterion is proven through the route the screen actually offers: tick the lines, press the checkout button, sign in.

```
grep -rn "acceptedReturnPath" apps/customer/src
```
Expected: one definition and two callers.

```
new_tab("http://localhost:3000/auth/signin?next=https://evil.example"); wait_for_load()
```
Sign in with the probe account through `cdp('Input.insertText', …)` (a `fill_input` leaves a controlled React input empty). Expected: the browser lands on `/`, not on `evil.example`.

Then the real path: as a guest add two lines, open `/cart`, press the checkout button, sign in, and expect `/checkout` with both lines in the account cart and one `POST /api/cart/merge` in the gateway log. Registering instead keeps the `/auth/confirm-email` step it has today, and the merge still runs once before that step.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c \
  "select count(*) from \"CartItem\" where \"userId\"='$UID';"
```
Expected: the two lines, and `select count(*) from \"CartItem\" where \"guestId\" is not null;` back to `0`.

## 16. Copy, retention and the gates (AC-16)

**Status: PASS** (2026-11-18). `catalog-parity` printed `nav: en 20 keys, ru 20 keys` and `cart: en 82 keys, ru 82 keys`, both with no missing and no extra key. The cookie carries `Max-Age=2592000`, 30 days. The sweep deleted `old_0028` and kept `new_0028` on the boot pass of a controlled gateway, logging `{"event":"guest.sweep.done","cartLines":1,"wishlistLines":0}`. Gates: `pnpm check-types` exit `0`, `@astrum/api` `489 passed` of 509 (58 suites passed, 5 skipped), `@astrum/customer` `458 passed`, `@astrum/customer lint` `0 errors, 13 warnings`.

- Premise correction (2026-11-18): the insert of the two probe rows cannot run as written, because both rows carry the same `guestId` and the same `productId` and the unique key this feature adds (`CartItem_guestId_productId_key`) refuses that pair. The run used two different products, one row per product.

```
node C:/Users/ADMIN/AppData/Local/hermes/skills/astrum-monorepo/scripts/catalog-parity.mjs nav
node C:/Users/ADMIN/AppData/Local/hermes/skills/astrum-monorepo/scripts/catalog-parity.mjs cart
```
Expected: two equal key counts and no missing or extra key.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c \
  "insert into \"CartItem\" (id,\"productId\",quantity,\"guestId\",\"createdAt\",\"updatedAt\") values ('old_0028','$P',1,'sweep_probe', now() - interval '31 days', now() - interval '31 days'), ('new_0028','$P',1,'sweep_probe', now() - interval '29 days', now() - interval '29 days');"
```
Restart the gateway, wait for the boot pass, then:

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c "select id from \"CartItem\" where id like '%_0028';"
```
Expected: only `new_0028`, and one `guest.sweep.done` line in the gateway log with both counts.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c "delete from \"CartItem\" where id='new_0028';"
pnpm check-types && pnpm --filter @astrum/api test && pnpm --filter @astrum/customer test && pnpm --filter @astrum/customer lint
```
Expected: every gate green, with the new suites listed by name.

## Run notes (2026-11-18)

- Scratch folder: `C:/Users/ADMIN/AppData/Local/hermes/cache/scratch/guest-0028`.
- Fixtures: a throwaway account `probe.g0028@example.com`, registered through `POST /api/auth/register`, flipped to `ACTIVE` by SQL, signed in for its token, which was never printed. Guest identities were cookie jars the gateway minted itself; the two hand written tokens (foreign secret, expired) were signed with the app's own `jsonwebtoken`. Products used: `896b5425...` (stock 4), `008f927a...` (stock 1), `ad8155bb...` (the gone product probe) and two more taken from the storefront's first cards.
- The gateway on `:3580` was the one `pnpm dev` had started. A second controlled copy ran on `:3581` for the log evidence (`guest.sweep.done`, `guest.token.refused`) and was killed afterwards. Its boot pass ran the retention sweep, so `:3580` was never restarted.
- Cleanup: every guest row this run wrote (6 cart rows, 1 wishlist row) and the whole probe account (5 cart rows, 2 wishlist rows, 1 email token, the user row) were deleted. Product stock was never touched because no order was placed. One `session:<sid>` record of the probe account outlives the user row and dies on its TTL.
- Not observed, and why: the throw atomicity clause of AC-11 (a code change is needed), the per page query count of AC-6 and the scan comparison of AC-12 (no `pg_stat_statements` on the dev container), and the `Secure` cookie attribute (dev serves plain HTTP, so that half of the criterion can only be read in the code).
- Verdict: **PASS**. Every behaviour above was driven against the running stack, every acceptance criterion of the spec is met on its observable clauses, and the clauses that could not be driven are named here rather than ticked.
