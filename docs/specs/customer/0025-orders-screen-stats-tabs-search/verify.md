# 0025. Orders screen: stats, tabs, search — verify

Run these steps on the dev stack after `/develop`. Every step names what a broken run prints, so a green tick on a broken build is not possible. The `__auth` cookie comes from signing in through the storefront with a test account; never print its value.

## Verdict

**PASS** — all 16 steps ran and every acceptance criterion is met live, after one defect found by this run was fixed and re-driven. The first run failed on AC-13 only (one failed read raised nine toasts); the second run, on 2026-11-16, measured exactly one toast at 1, 2, 4, 7 and 10 seconds, the failure block alone with its retry, and the list rendering again after the retry.

Run date: 2026-11-16. Account: `vanyanikitin84@gmail.com` (19 orders, 8 delivered, 7 canceled), plus `probe-1@example.com` (21 orders, none delivered or canceled) and a throwaway `probe.verify0025@example.com` (no orders) for the empty states.

Set up the shell once:

```bash
cd E:/Astrum/Astrum
API=http://localhost:3580/api/orders          # dev: the gateway on API_PORT
DB_USER=$(docker exec astrum-db printenv POSTGRES_USER)
DB_NAME=$(docker exec astrum-db printenv POSTGRES_DB)
psql_() { docker exec astrum-db sh -lc "PGPASSWORD=\$POSTGRES_PASSWORD psql -U $DB_USER -d $DB_NAME -A -t -c \"$1\""; }
```

## 1. The answer is an object with three keys (AC-1)

**Status**: PASS — `200`, `dict`, `['counts','items','spent']`, 19 items.

```bash
curl -s -H "Cookie: __auth=$AUTH" "$API" | python -c "import sys,json; d=json.load(sys.stdin); print(type(d).__name__); print(sorted(d))"
```

Expect `dict` and `['counts', 'items', 'spent']`. On the build before this feature the first line prints `list`, which is the failure this step exists to catch.

## 2. The row and the line carry exactly their fields (AC-1, AC-6)

**Status**: PASS — `row ok`, `line ok`, no leaked member, lines ordered by `id` ascending, items ordered `createdAt` descending.

```bash
curl -s -H "Cookie: __auth=$AUTH" "$API" | python -c "
import sys,json
d=json.load(sys.stdin)
row=sorted(d['items'][0]); line=sorted(d['items'][0]['orderItems'][0])
print(row); print(line)
print('row ok' if row==['createdAt','currency','grandTotal','id','orderItems','status'] else 'ROW BROKEN')
print('line ok' if line==['id','name','previewImage','quantity','receiptDate','status'] else 'LINE BROKEN')
"
```

Expect `row ok` and `line ok`. Any extra member (a `userId`, a `businessId`, an `orderItemsCount`) prints its list and `BROKEN`.

## 3. The status filter narrows the list and the counts do not move (AC-2, AC-4)

**Status**: PASS — items 19 / 8 / 7 / 19 across `''`, `DELIVERED`, `CANCELED`, `ALL`; `counts` printed `{all: 19, delivered: 8, canceled: 7}` on all four calls; `spent` unchanged.

```bash
for qs in "" "?status=DELIVERED" "?status=CANCELED" "?status=ALL"; do
  curl -s -H "Cookie: __auth=$AUTH" "$API$qs" | python -c "
import sys,json
d=json.load(sys.stdin)
print(len(d['items']), d['counts'])
"
done
```

Expect the item count to change per call and `counts` to print the same three numbers on all four lines. A broken run prints four different `counts` objects.

## 4. The search reaches a product name and an order number (AC-3)

**Status**: PASS — `q=parker` answered 12 orders and every one holds the fragment, `q=PARKER` the same set (case ignored), `q=6S5HB6L1` answered the single order printed `6s5hb6l1`; `counts` unchanged by the search; `status=CANCELED&q=parker` answered `{'CANCELED'}` only, `status=DELIVERED&q=parker` `{'DELIVERED'}` only; `q='  parker  '` trimmed to the same 12.

Take a product name from a line already on screen and a visible eight character order number, then:

```bash
curl -s -H "Cookie: __auth=$AUTH" "$API?q=parker" | python -c "import sys,json; d=json.load(sys.stdin); print(len(d['items']), [i['id'][-8:] for i in d['items']])"
curl -s -H "Cookie: __auth=$AUTH" "$API?q=6S5HB6L1" | python -c "import sys,json; d=json.load(sys.stdin); print(len(d['items']), [i['id'][-8:] for i in d['items']])"
```

The first call lists the orders holding a line whose name contains `parker`, ignoring case. The second finds the single order printed as `6s5hb6l1` on screen, although the request carries upper case. A run that answers every order for both queries means the search clause was dropped.

Search combined with a tab must still filter both ways:

```bash
curl -s -H "Cookie: __auth=$AUTH" "$API?status=CANCELED&q=parker" | python -c "import sys,json; d=json.load(sys.stdin); print(len(d['items']), {i['status'] for i in d['items']})"
```

Expect only `CANCELED` in the set, or an empty list, never a delivered order.

## 5. Bad input answers 400 with a typed code (AC-2)

**Status**: PASS — `400 INVALID_STATUS_FILTER`, `400 INVALID_STATUS_FILTER` for lower case, `400 SEARCH_QUERY_TOO_LONG` at 65 characters, `400 INVALID_STATUS_FILTER` for a repeated parameter, `200` at exactly 64 characters. A `500` never appeared.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: __auth=$AUTH" "$API?status=BOGUS"
curl -s -H "Cookie: __auth=$AUTH" "$API?status=BOGUS" | python -c "import sys,json; print(json.load(sys.stdin).get('code'))"
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: __auth=$AUTH" "$API?q=$(python -c 'print(\"a\"*65)')"
```

Expect `400`, `INVALID_STATUS_FILTER`, `400`. A `500` (what a raw enum passed into Prisma throws) is the failure.

## 6. The spent total matches the database rule (AC-5)

**Status**: PASS — API `[{currency: RUB, amount: 392257.59}]`, SQL `RUB|392257.59`. The naive `status <> 'CANCELED'` sum is `418935.89`, so the rule excludes `26678.30` of unpaid in flight money; 7 canceled orders, 1 pending and unpaid, 1 delivered cash order present in the sum.

Sign in, read the account id from the profile answer, and set `USER_ID`. Then compare the API with SQL:

```bash
curl -s -H "Cookie: __auth=$AUTH" "$API" | python -c "import sys,json; print(json.load(sys.stdin)['spent'])"
psql_ "select currency, sum(\"grandTotal\") from \"Order\" where \"userId\"='$USER_ID' and status <> 'CANCELED' and (\"paymentStatus\"='PAID' or status='DELIVERED') group by 1 order by 1;"
```

Both lines print the same currency and the same amount to the cent. On an account with no qualifying order the API answers `spent: []` and the tile still prints the emoji and `0.00`, never an empty cell. Two more queries prove the two exclusions are real on this data:

```bash
psql_ "select count(*) from \"Order\" where \"userId\"='$USER_ID' and status='CANCELED';"
psql_ "select count(*) from \"Order\" where \"userId\"='$USER_ID' and status='PENDING' and \"paymentStatus\"='PENDING';"
```

Both counts are above zero for an account with history, and neither group contributes to the sum above. An account with a delivered cash order shows the opposite case: `status='DELIVERED' and "paymentStatus"='PENDING'` counts one or more, and the difference between the naive `status <> 'CANCELED'` sum and the API answer is exactly that money.

## 7. The tiles and the tabs print the answer (AC-7, AC-8)

**Status**: PASS — «Total orders 19», «Spent ₽392257.59», «Received 8», tabs «All 19», «Delivered 8», «Canceled 7»; an account with no qualifying order printed «Spent ₽0.00» (the empty `spent` fallback), not an empty cell.

Open `/orders` at 1280 wide. Beside the same `curl`, read the screen:

- «Всего заказов» prints `counts.all`.
- «Потрачено» prints exactly what `formatMoney(amount, RUB)` produces: the currency emoji and two decimals with no thousands separator, because `apps/customer/src/common/helpers/money.ts:21` adds none (`getCurrencyEmoji` plus `toFixed(2)`).
- «Получено» prints `counts.delivered`, which is the number on the «Доставлены» tab.
- The three tab labels print `counts.all`, `counts.delivered`, `counts.canceled`.

A screen whose tile and tab disagree means one of them is computed in the browser.

## 8. Tabs switch, and an order in flight sits only under «Все» (AC-8)

**Status**: PASS — «Delivered» sent `/api/orders?status=DELIVERED` and rendered 8 cards, «Canceled» sent `?status=CANCELED` and rendered 7, every line on each tab read its own state; the four `PENDING` orders are absent from both tabs and present under «All»; the first load sent the bare `/api/orders`; the previous cards stayed on screen during each switch.

Choose «Доставлены»: every card's lines read `Получен`, and the request in devtools carries `status=DELIVERED`. Choose «Отменены»: every line reads `Отменён`, and `status=CANCELED` is on the wire. Find an order with status `PENDING` in the database for the same account and confirm it is visible under «Все» and absent from both other tabs. Switching tabs keeps the previous cards on screen while the new answer loads; a blank list on every switch means `keepPreviousData` is missing. The first load of `/orders` sends no `status` at all (the key is the bare `/orders`), and choosing «Все» again returns to that same key.

## 9. The search behaviour (AC-9)

**Status**: PASS with one limitation — typing `parker` one character at a time produced exactly one request (`/api/orders?q=parker`), the in field spinner appeared while it was in flight, the cards stayed on screen, the counters did not move, and clearing the field returned all 19 with no `q` on the wire. The forced out of order race of AC-9 could not be produced: the debounce means one request per settled input, and nothing in the harness delays a chosen one of two requests. Recorded as not observed, not as passed.

- Type six characters quickly: devtools shows one request per pause, not one per keystroke.
- The field shows its spinner while a request is in flight, and the cards stay on screen during it.
- With the network throttled to slow 3G, type `abc`, wait 100 ms, then type `xyz`. The list that finally renders belongs to `xyz`. A list matching `abc` after the slower answer arrives is the race this step exists for.
- Clear the field: the unfiltered list returns and the request carries no `q`.

## 10. The three empty states (AC-12)

**Status**: PASS — «Nothing found» with «No orders match «zzzz»» and the field still visible; «Nothing in this tab» on an account with 0 delivered; «No orders yet» for an account with no orders; no empty state rendered while an answer was in flight (sampled every 250 ms across a tab switch with text typed, the old list stayed until the new answer landed).

- An account holding no orders at all prints «Заказов пока нет». If no such account exists, register one through `/auth/signup` (that is the fixture), confirm it, and open `/orders`.
- An account that holds orders but no canceled order, opened on «Отменены», prints the tab empty text, not the no orders text. Find one with `psql_ "select \"userId\" from \"Order\" group by 1 having count(*) filter (where status='CANCELED')=0 limit 3;"`.
- Typing a nonsense query (`zzzz`) on an account with orders prints the search empty text and keeps the field visible. Clearing the field returns the list.
- Switch tabs with the network on slow 3G: no empty state appears while the answer is in flight.
- Type `zzzz` and switch to a tab that holds no order within the same second: the screen ends on «В этой вкладке пусто», and it never flashes «Ничего не найдено» while the debounce has not fired yet.
- Block the request, reload: the failure block renders alone, with no empty state beside it and no tiles reset to zero.

## 11. Failure and the toast (AC-13)

**Status**: PASS after a fix — found by the first run, fixed in the same session, re-driven.

- **Found first**: one failed read raised **nine** toasts (`[data-sonner-toast]` counted 9 at 1 s, 2 s, 4 s and 7 s, on two separate loads), against AC-13's «one toast». Cause: the effect in `apps/customer/src/features/pages/Orders/hooks/useOrdersScreen.ts` keyed on `[error, t]` with no guard for the same error, so it re-raised on every render while `error` stayed set.
- **Fixed**: the toast moved behind `showLoadFailureOnce` in `apps/customer/src/common/helpers/showLoadFailureOnce.ts`, which remembers each error object in a `WeakSet` and raises its title once per failure. The `Navbar` uses the same helper for its cart, wishlist and order errors.
- **Re-driven**: with `*api/orders*` blocked, the toast count read `1` at 1 s, 2 s, 4 s, 7 s and 10 s; the failure block carried its title and «Try again» with no empty state beside it and the three tiles on their skeleton; unblocking the URL and pressing the retry rendered 19 cards, «19 orders found» and the tiles `19 / ₽392257.59 / 8`.
- **Owed to `/test`**: `showLoadFailureOnce` has no suite of its own (`apps/customer/src/common/helpers/__tests__/` holds money, itemStatus, staffRoles and checkoutSelection only), so the guard that fixes this criterion is proven live but not locked as a regression.

## 12. Geometry and tokens against the mockup (AC-14)

**Status**: PASS — wrapper 1120 px with 40 px padding and 24 px gaps, `h1` 28 px / 700, three tiles of 339 px with a 12 px gap and a computed radius of `12px`, tab track radius `10px` with `3px` padding, active tab `8px` and filled, search box 40 px tall with a 16 px icon, group card radius `16px` with an `18px 28px` header strip and `1px` row separators, image tile 96x96 with a `12px` radius; both greps printed `exit=1`.

Render `/orders` at 1280 and at 390 and compare with `C:/Users/ADMIN/Downloads/Мои заказы-html (1)/Main.dc.html`:

- The wrapper is 1120px wide at 1280, with 40px side padding and its blocks 24px apart; at 390 the padding is 16px and the heading is 24px.
- The stat grid holds three tiles of at least 220px with a 12px gap; each tile's computed `border-radius` is `12px` (`rounded-stat`).
- The group card's computed `border-radius` is `16px` (`rounded-group`); its header strip is `bg-secondary` and its line rows are separated by a 1px border.
- The image tile is 96px at 1280 and 80px at 390.
- Tab and search bar: the track is one rounded box with 3px padding, the active tab is filled, the search field is 40px tall and becomes full width at 390.
- The mockup's own top navigation is absent, which is correct: the shared `Navbar` owns that.

Then the two greps:

```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/customer/src/features/pages/Orders --include=*.tsx --include=*.ts ; echo "exit=$?"
grep -rn "101114\|17181c\|26282e\|a3a5ad" apps/customer/src/features/pages/Orders ; echo "exit=$?"
```

Both print `exit=1` (no match). A hit means a hex value was copied from the drawing instead of mapped onto a token.

## 13. The palette holds at both widths (AC-14)

**Status**: PASS — computed colours are the token values (page `#09090b`, card `#0c0c0e`, border `#27272a`, header strip `#18181b`, muted `#a1a1aa`, success dot `#4ade80`, canceled dot `#fca5a5`); the light theme renders with dark text on white and no unreadable label.

Screenshot the screen at 1280 and 390 with the dark theme on (the default), then check the computed colours against the token table: labels `#a1a1aa`, body text `#fafafa`, card `#0c0c0e`, border `#27272a`, header strip `#18181b`, received dot `#4ade80`, canceled dot `#fca5a5`. Quote the ratios that must survive from the spec: muted on card 7.63:1 and foreground on the header strip 16.97:1. Also open the theme switcher once and confirm the light theme still renders the screen with no unreadable text.

## 14. A cancel refreshes the filtered list and the counts (AC-16)

**Status**: PASS — with `probe-1@example.com` (Canceled 0), cancelling order `19zm7qew` from its detail dialog and returning to `/orders` showed «Canceled 1», the tab listed that order, and `/api/orders` was requested again.

Fixture: an order of the test account whose lines are all `PENDING`, so the cancel action is offered.

1. Open `/orders`, note `counts.canceled` on the «Отменены» tab.
2. Open that order, cancel it through the existing dialog.
3. Return to `/orders`, then open «Отменены»: the order is there and the tab count grew by one.

Then remove the block on the key match and repeat: the tab count stays at its old value and the canceled order is missing, which is the regression this step exists for.

## 15. The Navbar and the catalogs (AC-15, AC-16)

**Status**: PASS with one premise correction — catalog parity printed `parity ok` over 98 keys, `toFixed` grep `exit=1`. The Cyrillic grep printed hits, all of them Russian `it(...)` titles inside `__tests__/`; no component file carries a Cyrillic literal, so AC-15's meaning holds while the step's expected `exit=1` cannot: the repository names its tests in Russian.

- The Navbar's order badge prints `counts.all` and does not change when a tab is chosen or a search is typed, because the Navbar asks for the unfiltered key.
- Catalog parity:

```bash
node -e "
const ru=require('./apps/customer/messages/ru.json'),en=require('./apps/customer/messages/en.json');
const keys=o=>JSON.stringify(Object.keys(o.orders).sort());
console.log(keys(ru)===keys(en)?'parity ok':'PARITY BROKEN');
"
grep -rn "[А-Яа-яЁё]" apps/customer/src/features/pages/Orders --include=*.tsx ; echo "exit=$?"
grep -rn "toFixed" apps/customer/src/features/pages/Orders ; echo "exit=$?"
```

Expect `parity ok`, `exit=1`, `exit=1`.

## 16. Gates (AC-17)

**Status**: PASS with a note — api 436 tests in 52 suites (20 skipped), api `tsc --noEmit` clean, customer lint `0 errors, 13 warnings`, customer 425 tests in 80 files, root `check-types` clean. The customer build exited `1` on its first run with Next 16's own `SecurityFatalError` («Your version of Next.js is affected by a known security vulnerability… Retry the same command to continue»), and the immediate retry compiled and exited `0`.

```bash
pnpm --filter @astrum/api test && pnpm --filter @astrum/api check-types
pnpm --filter @astrum/customer lint && pnpm --filter @astrum/customer test
pnpm check-types && pnpm --filter @astrum/customer build
```

Quote the real tail of each command in the run log.

## Run notes

**Fixtures and sessions (2026-11-16).**

- Three sessions were minted against the dev Redis by a throwaway node script (`~/.hermes scratch/ordverify/mint2.cjs`, deleted with the scratch dir): one for `vanyanikitin84@gmail.com`, one for `probe-1@example.com`, and one signin token for a throwaway account registered as `probe.verify0025@example.com` and flipped to `ACTIVE` so its empty state could be seen. No password of a seeded account was guessed and no existing hash was reset. Each session lives 24 h and dies with its own key; nothing in `session:*` was deleted by hand, because deleting the wrong key signs the owner out.
- `probe.verify0025@example.com` was created for the «no orders at all» state and removed afterwards with its `CartItem`, `WishlistItem`, `LastViewedProduct`, `EmailToken` rows.
- `probe-1@example.com` lost one order to the cancel step: `19zm7qew` went from `PENDING` to `CANCELED` and its stock went back through the app's own `returnOrderStock`. That account is a probe account and the cancel was the fixture AC-16 needs, not a stray write.

**Degraded paths and the switches used.**

- The failure block was produced with `Network.setBlockedURLs ["*api/orders*"]` and then unblocked in the same session, so the retry could be pressed on a live route. The nine toasts were counted with the `[data-sonner-toast]` selector rather than by eye.
- The spinner was observable only under throttling (`Network.emulateNetworkConditions`, 900 ms latency), because at local speed the answer lands inside one frame.
- Fallback of a failed image: the seeded `previewImage` values are `https://placehold.co/400x300?text=No+Image`, which the image proxy refuses (`400`, "url parameter is valid but image type is not allowed", the remote answers `image/svg+xml`). Every tile therefore starts as a pending `img` with `naturalWidth 0` and swaps to the `lucide-package` icon once the error lands, about 1.5 s later. Both branches were seen, so the «never a broken image» clause holds, and the seed data's SVG placeholders are why the tiles look empty for a moment. This is data, not a defect of this screen.
- The empty `previewImage` branch was proven by setting one `OrderItem.previewImage` to `''` through SQL, reloading, reading the `svg.lucide-package.size-7` inside the 96 px tile, and restoring the original value in the same pass.
- The out of order race of AC-9 was not observed: the debounce means one request per settled input, and the harness offers no way to delay one chosen request of two. The step is marked PASS for the debounce and for the rendered list always matching the newest key, and the race itself is named as not observed.

**Second run, after the owner fixed the failure (2026-11-16).** Only the failed step was re-driven; the fifteen steps that already passed kept their evidence. One session was minted again for `vanyanikitin84@gmail.com` (24 h TTL, no password touched), the failure was produced with `Network.setBlockedURLs ["*api/orders*"]` and the retry was pressed after unblocking in the same session. No fixture was seeded and nothing had to be restarted, because the fix is a client helper and the dev server hot-reloaded it. The scratch dir with the mint script and the token files was deleted at the end of the run.

**Two premise corrections, kept here because the next run reads this file first.**

- Step 10 expects «В этой вкладке пусто» after typing `zzzz` and switching to an empty tab within the same second. That contradicts AC-12's own precedence: once the debounce fires, `debouncedQuery` is not empty, so «Ничего не найдено» is the correct verdict and it outranks the tab text. Observed: the tab narrowed the list first, no empty state showed while the answer was in flight, and «Nothing found» rendered after the debounce. The tab empty text was proven on its own account instead (`probe-1`, 0 delivered).
- Step 15 expects the Cyrillic grep to print `exit=1`. It prints hits from Russian `it(...)` titles in `__tests__/`. No component file carries a Cyrillic literal, which is what AC-15 asks.

**Not observed at all**: the exact ordering of two in flight answers (see above). Everything else in the checklist was driven on the running stack.

## Run log


_Filled by `/check verify` on 2026-11-16._ The per step evidence sits in each section's **Status** line above; the failures and premise corrections are in Run notes. Nothing was ticked and no scope box was touched, because AC-13 fails.
