# 0026. Seller sales screen: stats, tabs, search and a flat line table — rationale

## Context

> ⚠️ Premise note: the scope row for this feature asks for four numbers "over the whole set" and, in the same `Done when:` line, that "no control sends a request". Those two cannot both hold on a read that pages 20 orders: the four numbers are about every line the seller owns, while a control that reads nothing can only compute over the page in hand, which is 20 orders and up to 80 lines. The engineer chose the server side read, and the row's `Done when:` line is corrected to match. The second thing this record flags is the money format: the mockup prints `46 332,00 ₽` and the project's `formatMoney` prints `₽46332.00`, so matching the drawing means changing the one formatter every screen uses. That was put to the engineer as its own decision and accepted on purpose, not folded in silently.

The seller panel is one read only table today, built by spec 0020: a band per order holding the order number, the payment state, the receiving method and the handover stamp, then one row per line with the product, its subtotal, the order date and the line status, plus a two button pager. `apps/customer/src/features/pages/SellerOrders/` holds 166 lines of composition, a 107 line band, a 98 line row, a 15 line state screen and two `lib/` modules.

The read behind it, `GET /api/seller/orders`, takes only `page` and `limit`. `SellerOrderService.getSellerOrders` finds the business by `ownerUserId`, counts the seller's distinct orders with a raw `COUNT(DISTINCT oi."orderId")`, then pages the orders, nesting the seller's own lines under each one. Nothing in the answer describes money, volume or status; nothing filters or searches. The controller converts each line price with `withNumberPrices` and leaves every other field as the ORM returned it.

The mockup for this feature, `C:/Users/ADMIN/Downloads/Продажи-html/Sales.dc.html`, draws a different screen: a heading with a count on the right, four stat tiles, a tab strip with counts, a search field, and one flat table of six columns where the amount is the line subtotal (`18 × 2 574 = 46 332` in its own first row). It also draws its own top navigation and a palette one step away from the theme (`#101114` page, `#17181c` card, `#26282e` border), the same older family spec 0025 mapped for the customer orders screen.

The numbers below were measured against the running dev database on 2026-11-17, before any design choice was written down.

| Measurement | Value |
|---|---|
| lines in `OrderItem` | 143 |
| orders carrying a seller line | 105 orders in the database |
| busiest seller | `biz_excel_12`, 24 orders and 24 lines |
| a seller with several lines per order | `biz_54369efe-…`, 15 orders and 20 lines, up to 4 lines in one order |
| orders whose lines carry more than one status | 7 |
| lines whose status disagrees with the parent order | 11 combinations, including 4 `DELIVERED` lines inside `PENDING` orders |
| line statuses | `PENDING` 65, `CANCELLED` 37, `DELIVERED` 36, `SHIPPED` 2, `OUT_OF_STOCK` 2, `CONFIRMED` 1 |
| orders where `totalPrice + deliveryPrice = grandTotal` | 105 of 105 |
| orders where the sum of line subtotals equals `totalPrice` | 103 of 105 (two legacy rows differ) |
| orders with no pickup point | 80 of 105 |
| currencies on lines | `RUB` only |
| `Business` rows with an owner | 16 of 31 |

Two of those measurements are load bearing. The status disagreement between an order and its lines means "delivered" cannot be one predicate for both screens: the customer screen groups orders, and this panel prints one badge per line, so the badge and the tab have to read the same column or the row contradicts the tab it sits in. The delivery fee inside `grandTotal` means the seller's money is the line subtotals and nothing else; summing `grandTotal` would pay the seller for the courier.

## Options considered

### Option 1: widen the read, flip the table to one row per line, share the blocks

`GET /api/seller/orders` gains `status`, `q`, `page` and `limit` and answers `{ items, counts, stats, page, limit, total, totalPages }` from one `RepeatableRead` transaction. The screen renders one row per line, four tiles, three tabs and one search field, and the tile, the tab strip, the search field and the failure block move to `features/general/` so the customer orders screen and this one read one copy. The money formatter gains a locale.

**Pros**:
- The four numbers describe every line the seller owns, and they cannot disagree with the list because one transaction produces both.
- One row per line is what the mockup draws, and its amount column is a line subtotal, so the grain matches the design instead of fighting it.
- The tab, the tile and the row badge read one column, so no screen of this feature can contradict itself.
- The shared blocks remove a second copy of the tile, the tab strip and the search field before it exists.

**Cons**:
- The answer is a breaking shape change for the only consumer, which ships in the same commit.
- An order holding four lines repeats its number four times, and the seller loses the order as a unit.
- A page costs four reads instead of two.
- Every amount on the storefront changes its printed form.

### Option 2: one unpaginated read, filter and sum in the browser

Drop the pager, answer every line the seller owns in one request (24 today, clamped at 50), and compute the tabs, the search and the four numbers in the browser, which is the literal reading of "no control sends a request".

**Pros**:
- No new query parameters, no new aggregate, and the smallest server change of the four.
- A tab switch and a keystroke cost nothing, and the numbers are instant.

**Cons**:
- The `MAX_PAGE_SIZE` clamp of 50 turns the numbers into a partial answer the moment a seller owns 51 lines, and the screen would print a total nobody could reconcile.
- Every filtered view needs the whole set in memory, so a shop that grows needs this rewritten anyway.
- It contradicts the read the customer screen settled on (spec 0025), so the shop would carry two search mechanisms with two behaviours.

### Option 3: keep the band, add the numbers on the client

Keep the current band and row shape, add the four tiles and the tabs with numbers computed from the loaded orders, and leave the read untouched.

**Pros**:
- The smallest visual change and no server work at all.
- The order stays a unit on the screen.

**Cons**:
- The mockup's six columns and its flat table are not built, so the feature's own design source is ignored.
- The numbers describe the page, not the shop, which is the defect this feature exists to fix.
- The tile, the tab strip and the search field get a third copy in the tree.

### Option 4: a second read for the numbers

Keep the list paged as it is and add `GET /api/seller/stats` answering the four numbers, so the screen fires two requests.

**Pros**:
- The list read stays small and can be reused by a future export.
- The aggregate can be cached on its own later.

**Cons**:
- Two requests mean two snapshots: a status change landing between them prints a tile that contradicts the list under it, which no amount of care on the client can repair.
- Two failure paths, two loading states and two cache keys on one screen.

## Rationale

Option 1 wins on the two forces this feature is actually about. The numbers must describe the shop, and they must agree with the list; one `RepeatableRead` transaction answering rows and aggregates together is the only option of the four that makes both true, which is also the rule spec 0025 already established for the customer screen. The flat table is not a taste call: the mockup's amount column is a line subtotal (`18 × 2 574`), and a band per order cannot print a line level amount without nesting a second table inside a row, which is what the panel does today and what this feature is replacing.

Option 2 was tempting because the scope row literally asks for it, and it is the honest answer while the largest seller holds 24 lines. It loses on two counts: the clamp of 50 makes the numbers partial for a shop that grows past it, and the design source draws a search field over a filtered set, which the browser can only fake over a full set. Option 4 was rejected for the reason the customer screen already wrote down: a filtered list and a total from two requests describe two instants.

The grain change costs the seller something real, and the spec records it as a negative rather than a footnote: an order with four lines now reads as four rows, and the order stops being a visual unit. The tab grouping follows from the same measurement rather than from symmetry with the customer screen: 7 orders carry lines in more than one status, and one such order holds a delivered line inside a pending order, so grouping by the order status would put a row under «Отменены» whose own badge reads `DELIVERED`. The tile and the tab therefore both read the line status, and `OUT_OF_STOCK` joins the canceled bucket because a seller reads a lost sale as a cancellation, not as a line in flight.

The money formatter change is the one part of this spec whose blast radius is outside the feature. It was put to the engineer as its own decision with its cost named, and the answer was to widen it: `Intl.NumberFormat(locale, { style: "currency", currency })` prints `299,00 ₽` for a Russian reader and `₽299.00` for an English one, which is what the mockup draws and what the bilingual storefront should have printed all along. The alternative, a second formatter inside this feature, was rejected because the storefront standard (S4) names one helper for every amount and a second one is the defect that rule exists to prevent.

References: none. The stack is settled and the sources that shaped this decision are the existing specs and the code they describe: 0001 and 0003 for the rule that money and totals are decided by the server; 0016 and 0018 for the line status vocabulary and the handover that writes `DELIVERED`, `receiptDate` and `handedOverAt`; 0020 for the read only seller panel and its `SELLER_PANEL_READ_ONLY` refusal; 0023 for the palette and the three tokens (`--success`, `--radius-stat`, `--radius-group`) this redraw prints instead of new hex values; 0025 for the tab grouping rule, the one transaction that answers rows and aggregates together, the search debounce and the failure block whose toast moved out of a render body; plus `apps/customer/AGENTS.md` for the feature shape, the placement rules and the money and date rules (S1 to S5). The reasoning stays here rather than in a citation list, following the shape specs 0011, 0020, 0024 and 0025 already use for the same call.
