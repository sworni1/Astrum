# 0026. Seller sales screen: stats, tabs, search and a flat line table — verify

Run these steps on the dev stack after `/develop`. Every step names what a broken run prints, so a green tick on a broken build is not possible. The `__auth` cookie is either taken from a browser sign in or minted below for a throwaway probe; its value is never printed.

## Verdict: PASS (2026-11-17, second run after the fix)

The first run failed on AC-14: `/cart` printed the line price as `$24054.80 за штуку` from `price.toFixed(2)`. The owner fixed the three findings and this run re-drove only those three, keeping the evidence of the eighteen steps that had already passed.

- **AC-14 (step 17)**: the cart line now reads `24 054,80 ₽ за штуку` in Russian and `₽24,054.80 each` in English, through `formatMoney(price, Currency.RUB, useLocale())` in `features/pages/Cart/components/CartCard/components/CartCardInfo.tsx`, and the `toFixed(2)` grep prints nothing.
- **The 403 toast**: an account with no business renders the not a seller screen and the toast list stayed empty across eight seconds, because `hooks/useSalesFilters.ts` now raises `showLoadFailureOnce` only when `sellerErrorKind(error) === "failure"`.
- **The wrapping pill**: the badge carries `whitespace-nowrap` (`features/pages/SellerOrders/lib/styles.ts:30`), so «В обработке» stays one line at 1280 (one client rect, 26 px tall, `white-space: nowrap`).

Every acceptance criterion is met. The two defects found beside it carry suites of their own, so the fixes are locked rather than merely observed (see the second run notes).

## Setup

```bash
cd E:/Astrum/Astrum
API=http://localhost:3580/api/seller/orders
DB_USER=$(docker exec astrum-db printenv POSTGRES_USER)
DB_NAME=$(docker exec astrum-db printenv POSTGRES_DB)
psql_() { docker exec astrum-db sh -lc "PGPASSWORD=\$POSTGRES_PASSWORD psql -U $DB_USER -d $DB_NAME -A -t -c \"$1\""; }
SELLER=$(psql_ 'select b."ownerUserId" from "Business" b join "OrderItem" oi on oi."businessId" = b.id where b."ownerUserId" is not null group by 1 order by count(*) desc limit 1')
echo "seller: $SELLER"
```

Mint a probe session for that seller (dev only; the gateway and this shell read the same secret and Redis):

```bash
cd apps/api-astrum && set -a && . ./.env && set +a
SID=$(node -e "console.log(require('crypto').randomUUID().replace(/-/g,''))")
docker exec astrum-redis redis-cli SET "session:$SID" "{\"userId\":\"$SELLER\",\"createdAt\":\"$(date -Iseconds)\",\"userAgent\":null}" EX 3600
AUTH=$(node -e "const j=require('jsonwebtoken');console.log(j.sign({userId:process.argv[1],sid:process.argv[2]},process.env.JWT_SECRET,{expiresIn:'1h'}))" "$SELLER" "$SID")
cd ../..
echo "session minted: ${SID:0:8}…"
```

`echo $AUTH` must never appear in a transcript. If the cookie is instead taken from the browser, set `AUTH` to that value and skip the mint block.

## 1. The answer is one object with seven keys (AC-1) · PASS (2026-11-17)

```bash
curl -s -H "Cookie: __auth=$AUTH" "$API?page=1&limit=20" | python -c "import sys,json; d=json.load(sys.stdin); print(type(d).__name__); print(sorted(d))"
```

Expect `dict` and `['counts', 'items', 'limit', 'page', 'stats', 'total', 'totalPages']`. On the build before this feature the answer is a dict with `orders`, `page`, `limit`, `total`, `totalPages`, and this line prints a different key list.

## 2. The page slices the unit the total counts (AC-1, AC-10) · PASS (2026-11-17)

```bash
LINES=$(psql_ "select count(*) from \"OrderItem\" oi join \"Business\" b on b.id = oi.\"businessId\" where b.\"ownerUserId\" = '$SELLER'")
echo "sql lines: $LINES"
for P in 1 2; do curl -s -H "Cookie: __auth=$AUTH" "$API?page=$P&limit=20" | python -c "import sys,json; d=json.load(sys.stdin); print('page', d['page'], 'items', len(d['items']), 'total', d['total'], 'pages', d['totalPages'])"; done
```

Expect `total` equal to `sql lines` on both pages, `len(items)` of 20 on the first page and the remainder on the second. A build that counts orders instead of lines prints a smaller `total` and a second page that is not a remainder; that is the failure this step catches.

## 3. The rows are ordered by the order date, newest first (AC-1) · PASS (2026-11-17)

```bash
curl -s -H "Cookie: __auth=$AUTH" "$API?page=1&limit=20" | python -c "
import sys,json
d=json.load(sys.stdin)
dates=[i['createdAt'] for i in d['items']]
print('ordered' if dates==sorted(dates, reverse=True) else 'ORDER BROKEN')
"
```

## 4. The canceled filter selects both canceled members (AC-2, AC-4) · PASS (2026-11-17)

```bash
CANCELED_SQL=$(psql_ "select count(*) from \"OrderItem\" oi join \"Business\" b on b.id = oi.\"businessId\" where b.\"ownerUserId\" = '$SELLER' and oi.status in ('CANCELLED','OUT_OF_STOCK')")
curl -s -H "Cookie: __auth=$AUTH" "$API?status=CANCELED&page=1&limit=50" | python -c "
import sys,json
d=json.load(sys.stdin)
print('statuses', sorted({i['status'] for i in d['items']}))
print('total', d['total'], 'counts.canceled', d['counts']['canceled'], 'sql', $CANCELED_SQL)
print('match' if d['total']==d['counts']['canceled']==(int('$CANCELED_SQL') if '$CANCELED_SQL' else 0) else 'MISMATCH')
"
```

Expect exactly `['CANCELLED', 'OUT_OF_STOCK']` (or a subset when one member has no row), `total` equal to `counts.canceled` equal to the SQL count. A build that maps `CANCELED` onto the order status prints `[]` or a mismatch.

## 5. The refusals carry their codes (AC-2) · PASS (2026-11-17)

```bash
for Q in "status=delivered" "q=$(python -c 'print("x"*65)')" "page=abc" "status=DELIVERED&status=CANCELED"; do
  printf '%s -> ' "$Q"; curl -s -o /dev/null -w '%{http_code} ' -H "Cookie: __auth=$AUTH" "$API?$Q"
  curl -s -H "Cookie: __auth=$AUTH" "$API?$Q" | python -c "import sys,json; print(json.load(sys.stdin).get('code'))"; done
```

Expect `400 INVALID_STATUS_FILTER`, `400 SEARCH_QUERY_TOO_LONG`, `422 VALIDATION`, `400 INVALID_STATUS_FILTER`, in that order.

## 6. The search reaches a product name and an order number, and leaves the numbers alone (AC-2, AC-4) · PASS (2026-11-17)

```bash
NAME=$(curl -s -H "Cookie: __auth=$AUTH" "$API?page=1&limit=1" | python -c "import sys,json; print(json.load(sys.stdin)['items'][0]['name'][:6])")
ORDER=$(curl -s -H "Cookie: __auth=$AUTH" "$API?page=1&limit=1" | python -c "import sys,json; print(json.load(sys.stdin)['items'][0]['orderId'][-8:])")
for Q in "$NAME" "$ORDER" "zzz-no-such-line"; do
  curl -s -H "Cookie: __auth=$AUTH" "$API?q=$(python -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$Q")&page=1&limit=50" | python -c "
import sys,json
d=json.load(sys.stdin)
print('q=$Q', 'items', len(d['items']), 'counts', d['counts'], 'units', d['stats']['units'], 'revenue', d['stats']['revenue'])
"; done
```

Expect a non zero `items` for both the product fragment and the last eight characters of an order id, and zero for the nonsense string. `counts`, `units` and `revenue` print the same values in all three lines, which is the check that the filters never touch the aggregates.

## 7. The row carries exactly its fields and a server computed subtotal (AC-3) · PASS (2026-11-17)

```bash
curl -s -H "Cookie: __auth=$AUTH" "$API?page=1&limit=1" | python -c "
import sys,json
d=json.load(sys.stdin); i=d['items'][0]
want=['createdAt','currency','deliveryAddress','handedOverAt','id','isPickup','name','orderId','pickupPointAddress','pickupPointName','previewImage','price','productId','quantity','status','subtotal']
got=sorted(i)
print(got)
print('row ok' if got==want else 'ROW BROKEN')
print('subtotal ok' if abs(i['subtotal']-round(i['quantity']*i['price'],2))<0.005 else 'SUBTOTAL BROKEN')
print('leak' if any(k in i for k in ('userId','businessId','paymentStatus','paymentMethod','paymentDetails')) else 'no leak')
print('price is number:', isinstance(i['price'], (int,float)))
"
```

## 8. The counts and the money agree with the database (AC-4, AC-5) · PASS (2026-11-17)

```bash
echo "sql delivered: $(psql_ "select count(*) from \"OrderItem\" oi join \"Business\" b on b.id = oi.\"businessId\" where b.\"ownerUserId\" = '$SELLER' and oi.status = 'DELIVERED'")"
echo "sql units: $(psql_ "select coalesce(sum(oi.quantity),0) from \"OrderItem\" oi join \"Business\" b on b.id = oi.\"businessId\" where b.\"ownerUserId\" = '$SELLER' and oi.status = 'DELIVERED'")"
echo "sql revenue: $(psql_ "select coalesce(sum(oi.quantity * oi.price),0) from \"OrderItem\" oi join \"Business\" b on b.id = oi.\"businessId\" where b.\"ownerUserId\" = '$SELLER' and oi.status = 'DELIVERED'")"
echo "sql delivered orders grandTotal: $(psql_ "select coalesce(sum(o.\"grandTotal\"),0) from \"Order\" o join \"OrderItem\" oi on oi.\"orderId\" = o.id join \"Business\" b on b.id = oi.\"businessId\" where b.\"ownerUserId\" = '$SELLER' and o.status = 'DELIVERED'")"
curl -s -H "Cookie: __auth=$AUTH" "$API?page=1&limit=1" | python -c "import sys,json; d=json.load(sys.stdin); print('counts', d['counts']); print('stats', d['stats'])"
```

Expect `counts.delivered`, `stats.units` and `stats.revenue[0].amount` to match the three SQL lines exactly, and `stats.revenue` to be smaller than the `grandTotal` line whenever that seller ships paid orders, because the delivery fee is not the seller's money. A build that sums `grandTotal` prints the larger number, which is the failure this step exists to catch.

## 9. The screen prints the four tiles from the answer (AC-6) · PASS (2026-11-17)

Sign in as the same seller, open `/seller/orders`, and compare the four tiles against step 8. Expected: «Выручка» prints `stats.revenue` in the locale form (`299,00 ₽`, grouped with a space), «Продано, шт.» the units, «Доставлено» `counts.delivered` and «Отменено» `counts.canceled`. A tile that prints a blank cell, a raw `46332` or a number that differs from step 8 fails this step.

## 10. The tabs group by the line status (AC-7) · PASS (2026-11-17)

On the same screen press «Отменены». Expected: every visible badge reads `Отменён` or `Нет в наличии`, the tab label reads the same count as the tile, and no row shows a `Доставлен` badge. Then press «Все» and confirm the row count equals the number under the heading.

## 11. The search field works and does not move the numbers (AC-8) · PASS (2026-11-17)

Type six characters of a visible product name. Expected: after roughly 300 ms the table narrows to the matching lines, the tiles and the tab counts stay exactly as in step 9, and a spinner sits inside the field while the request runs. Clear the field: the full first page returns and the pager reads page 1.

## 12. The six columns print the mockup's cells (AC-9) · PASS (2026-11-17)

At 1280 wide, on a seller that owns both a pickup and a courier order, confirm: the order cell is a monospace last eight characters; the product cell holds a 40px tile, the name at weight 500 and a muted `× N шт.` line, and both the tile and the name open `/products/<id>`; the receiving cell prints a pickup name with its address and a muted `выдан <date>` for a handed line, and `Курьер` with the address for a courier line; the amount sits right aligned with two decimals; the date prints day, short month, hour and minute in the browser zone, not the previous day; the badge sits right aligned. A line with a delivery address but no pickup point that prints an empty cell fails this step.

**Premise correction** (2026-11-17): this step reads "a pickup name with its address", while AC-9 defines the cell as `pickupPointName`, or `pickupPointAddress` when the name is empty, with a muted handover suffix. The render follows AC-9: `Pickup point Lenina · выдан 15 нояб.` with no street, and `Курьер · Panel check street 1` on the courier line. The mechanism the step aims at (the pickup branch, the courier branch, and both on one page at 1280) was proven on seller `d8ccbecb…`, whose first page holds both kinds of line. Two sub branches stayed unobserved for lack of data: a line with neither a point nor an address (`receipt.noAddress`), and an empty `previewImage` (every row carries a `placehold.co` URL, so the package icon branch never rendered).

## 13. The pager slices lines and never prints an impossible page (AC-10) · PASS (2026-11-17)

Press «Вперёд» to the last page. Expected: the label reads «Страница N из N», «Вперёд» is disabled, the last page holds the remainder of step 2, and the heading keeps printing the same total on every page. Then ask the API directly for a page past the last:

```bash
curl -s -H "Cookie: __auth=$AUTH" "$API?page=99&limit=20" | python -c "import sys,json; d=json.load(sys.stdin); print('items', len(d['items']), 'total', d['total'], 'pages', d['totalPages'])"
```

Expected: `items 0` with `total` still above 0 and `totalPages` unchanged, which is why the screen's own effect has to come back to the last page instead of painting «Страница 99 из N».

## 14. The states (AC-11) · PASS (2026-11-17)

- **Not a seller**: mint a session for an account with no `Business` row and open `/seller/orders`. Expected: «Этот аккаунт не продаёт» with its button to `/seller/onboarding`, and no table.
- **Nothing found**: type a nonsense string. Expected: «Ничего не найдено» with the query in the text, the search field still visible, and no tab empty text.
- **This tab is empty**: for a seller that owns no delivered line, open «Доставлены». Expected: «В этой вкладке пусто» and not «Нечего собирать», which is the gate reading `counts.all` instead of `total`.
- **Failure**: stop the gateway (`pnpm --filter @astrum/api` interrupted), reload. Expected: one failure block with «Повторить», exactly one toast over ten seconds, and no empty state. Start the gateway, press «Повторить»: the table returns.

## 15. The palette and the geometry (AC-12) · PASS (2026-11-17)

```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/customer/src/features/pages/SellerOrders --include=*.tsx --include=*.ts
```

Expected: no output. Then, at 1280 and at 390 wide, confirm every colour comes from a token (devtools colour picker reads `#09090b`, `#0c0c0e`, `#27272a`), the row stacks into a card below 640px with the six labels printed, and `document.documentElement.scrollWidth` equals the viewport width at both sizes. The mockup's own `Мои заказы` / `Продажи` tabs must not appear.

## 16. The shared blocks are shared, not copied (AC-13) · PASS (2026-11-17)

```bash
grep -rn "rounded-stat border border-border bg-card" apps/customer/src/features/pages
ls apps/customer/src/features/general
pnpm --filter @astrum/customer test
```

Expected: the first command prints only the shared constant's file, the second lists `StatTile`, `FilterTabs`, `SearchField` and `FailureBlock`, and the suite is green, including the four orders screen suites that moved with the extraction. Open `/orders` and confirm its three tiles, tabs and search field still render and behave.

**Premise correction** (2026-11-17): the grep over `features/pages` printed nothing, which is stronger than the step asks: the constant lives in `features/general/lib/screenStyles.ts:18` and no copy of it survived in either screen. The customer suite ran under step 19 (83 files green) and `/orders` renders its three tiles, its three tabs and the search field.

## 17. Money prints in the reader's locale, on every screen (AC-14) · PASS (2026-11-17, second run)

**Found first, then fixed** (2026-11-17): the first run printed `$24054.80 за штуку` on the cart item line, from `price.toFixed(2)` in `components/CartCard/components/CartCardInfo.tsx`. After the fix the same line reads `24 054,80 ₽ за штуку` in Russian and `₽24,054.80 each` in English, formatted by `formatMoney(price, Currency.RUB, useLocale())`, and `grep -rn "toFixed(2)" apps/customer/src` prints nothing. The seller table, its tiles and the cart summary keep printing through the same helper.

On `/cart` and on `/seller/orders`, confirm an amount reads `299,00 ₽` with a space between thousands and a comma before the decimals. Switch the interface to English and reload: amounts read `₽299.00`. Then:

```bash
grep -rn "toFixed(2)" apps/customer/src --include=*.tsx --include=*.ts
```

Expected: no amount rendering outside `common/helpers/money.ts` (the helper's own suite may appear in `__tests__`). A component that still prints `${emoji}${amount}` fails this step.

## 18. Both catalogs carry the same keys, and the dead keys are gone (AC-15) · PASS (2026-11-17)

```bash
node -e "
const ru=require('./apps/customer/messages/ru.json'), en=require('./apps/customer/messages/en.json');
const a=JSON.stringify(Object.keys(ru.seller).sort()), b=JSON.stringify(Object.keys(en.seller).sort());
console.log(a===b ? 'parity ok' : 'KEY SET BROKEN');
for (const k of ['paymentLabel','statusCount']) console.log(k, k in ru.seller || k in en.seller ? 'STILL PRESENT' : 'gone');
"
```

Expected: `parity ok` and `gone` twice.

## 19. The gates (AC-16) · PASS (2026-11-17)

**Note** (2026-11-17): the first `build` run stopped on Next's own security advisory ("This command stopped to show the upgrade recommendation"), not on a type or lint error; the retry finished with exit 0. The counts and the warning total are in the run notes below.

```bash
pnpm --filter @astrum/api test && pnpm --filter @astrum/api check-types
pnpm --filter @astrum/customer lint && pnpm --filter @astrum/customer test
pnpm check-types && pnpm --filter @astrum/customer build
```

Expected: every command exits 0. Quote the test counts and the lint warning count from the output, not from this file.

## 20. Cleanup · PASS (2026-11-17)

```bash
docker exec astrum-redis redis-cli DEL "session:$SID"
```

Then reload `/seller/orders`: the storefront redirects to `/auth/signin`, which proves the probe session is gone. No order, line or business row was written by this walk.

## Run notes (2026-11-17)

**Fixtures.** Five probe sessions were minted in Redis and deleted afterwards (`DEL session:<sid>` five times, after which `/seller/orders` redirected to `/auth/signin`, step 20). The accounts: `d8ccbecb…` the seller whose page 1 was walked (24 lines: 1 `DELIVERED`, 20 `PENDING`, 3 `CANCELLED`, three pickup lines and twenty one courier lines), `a7c7f855…` the seller holding one `OUT_OF_STOCK` line, `1f24a4e7…` a seller with lines and no delivered line, `a735b9ad…` a business with no line at all, `d94870b1…` an account with no business. One product was added to the cart to reach a money line and removed through the confirm dialog; the cart is empty again.

**Ledger against SQL** (same seller, `/api/seller/orders?page=1&limit=1`): `counts` `{all 24, delivered 1, canceled 3}`, `stats` `{units 1, revenue [{RUB, 24054.8}]}`, and the SQL lines read 24 / 1 / 1 / 24054.80, with the delivered orders' `grandTotal` at 199346.40, so the delivery fee stays out of the tile. Page 1 held 20 items and page 2 held 4 with `total` 24 on both; `page=99` answered `items 0`, `total 24`, `pages 2`.

**Degraded paths, each with its number.** The gateway was stopped (the `tsx watch` tree on 3580 terminated, port verified free) and the screen rendered one failure block with «Повторить», no empty state and no table; the toast count read 4 across 14 seconds, one from this read and three from the navbar reads (orders, wishlist, cart) that fail with the same gateway. The gateway was restarted and «Повторить» brought the table back with 20 rows and `24 позиции`. A `403 SELLER_NOT_ASSIGNED` account renders the not a seller screen with its «Открыть лавку» link to `/seller/onboarding` and no table.

**Harness switches.** `Emulation.setDeviceMetricsOverride` for the 1280 and the 390 pass. `Network.emulateNetworkConditions` at 1500 ms latency was the switch that made the search spinner observable: the field carried an `animate-spin` icon from 0.6 s to 1.2 s after the keystroke, and the debounced answer landed at 3 rows afterwards. `Network.setBlockedURLs` did not intercept the `/api-gateway/*` rewrite, so the retry path was proven by stopping the gateway rather than by blocking the request. Calls that do not navigate are refused by this harness, so interactions were driven inside one navigation each.

**Not observed.** The `receipt.noAddress` branch (no line in the database has neither a point nor an address), the empty `previewImage` package icon (all rows carry a placeholder URL), the first load skeleton (it never stayed on screen long enough at local speed to capture), and the design table's `Мои заказы` tabs are absent as designed rather than verified: the only `Продажи` string on the page is the `h1`.

**Gates (step 19)**, quoted from the runs: `pnpm --filter @astrum/api test` 52 suites passed of 57 (5 skipped), 455 tests passed of 475 (20 skipped); `api check-types` exit 0; `customer lint` exit 0 with 0 errors and 13 warnings; `customer test` 83 files passed; `root check-types` exit 0 across 5 tasks; `customer build` exit 0 on the retry described above.

**Defects found outside the failing criterion.**

- **The not seller branch raises the load failure toast**: a 403 renders the not a seller screen and still shows «Не удалось загрузить строки заказов» over it, because the effect in `features/pages/SellerOrders/hooks/useSalesFilters.ts` passed every error to `showLoadFailureOnce`, typed refusals included. Fixed in the same session: the effect now fires only for `sellerErrorKind(error) === "failure"`, and `__tests__/index.test.tsx` counts one toast on a failed read and still one after a 403.
- **The status pill wraps**: at 1280 the `PENDING` badge breaks into «В» / «обработке» and reads as an oval, where `DELIVERED` and `CANCELLED` fit. Fixed in the same session: `lib/styles.ts:30` now carries `whitespace-nowrap`, and `__tests__/index.test.tsx:269` asserts it.
- **The cart's per item price** (the AC-14 failure above) also lives outside the seller feature, so the fix landed in `features/pages/Cart/components/CartCard/` rather than in this screen; `CartCardInfo.test.tsx` renders the real catalog in both locales. Fixed in the same session.

### Second run (2026-11-17, after the fix)

Only step 17 and the two defects were re-driven; the eighteen passing steps kept their first-run evidence and were not replayed. A fresh probe session was minted in Redis and deleted afterwards. One product was added to the cart to reach the money line and removed through the confirm dialog, and the cart reads «Ваша корзина пуста» again.

Observed this run: `/cart` line price `24 054,80 ₽ за штуку` (ru) and `₽24,054.80 each` (en); every status pill on the first page measuring one client rect at 26 px with `white-space: nowrap`; the not a seller screen with an empty toast list at 4, 6 and 8 seconds.

Gates after the fix: `customer test` 84 files and 448 tests green (three above the first run, the new assertions), `customer lint` exit 0 with 0 errors and 13 warnings, root `check-types` exit 0 across 5 tasks. The api side was untouched by the fix and keeps its first-run result (52 suites, 455 tests).
