# 0026. Seller sales screen: stats, tabs, search and a flat line table

**Date**: 2026-11-17
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The seller panel stops being one band per order with a nested line list and becomes the screen the mockup draws: four tiles (revenue, units sold, delivered, canceled), three tabs, one search field and one flat table whose row is an order line. The read behind it answers the rows, the counts and the money in one transaction, because a filtered list can no longer be the source of numbers about the whole set. Nothing in the database changes. The screen prints no number it computes itself, and no control writes anything.

The money format also moves: every amount on every storefront screen starts printing through `Intl.NumberFormat`, so `299,00 ₽` replaces `₽299.00` and the currency emoji leaves the amount. That change is site wide on purpose, and this spec carries it because this screen cannot print grouped thousands without it.

## Requirements

**User stories**:

- As a seller, I want to see what my shop has earned and how much it has sold, so that I read my volume without counting rows.
- As a seller, I want to switch between delivered and canceled lines, so that I reach the line I mean without scrolling past the rest.
- As a seller, I want to find a line by its order number or by a product name, so that I do not page through twenty rows to find one.
- As a seller, I want one dense row per line with the receiving point, the amount and the date, so that I recognise the line at a glance.
- As the shop, I want every control to read and never to write, so that the read only panel of spec 0020 stays read only.

**Acceptance criteria** (the contract):

- **AC-1**: `GET /api/seller/orders` answers one object instead of a paginated group list:
  `{ items, counts, stats, page, limit, total, totalPages }`.
  `items` is the filtered page of order lines, ordered by the parent order `createdAt` descending and then by line `id` ascending, so two lines of one order never swap places between two answers. `total` is the number of lines matching the filters, and `totalPages` is `Math.ceil(total / limit)`, so the page slices the unit the total counts. The route keeps its path (`/api/seller/orders`), its mount and its middleware. The page, the `count` and the one aggregate run inside one
  `prisma.$transaction([...], { maxWait: 5000, timeout: 10000, isolationLevel: "RepeatableRead" })`, the option set the repo already uses for its writes (`apps/api-astrum/src/modules/order/order-status.helpers.ts:9-13`) with the isolation level raised, because `ReadCommitted` gives every statement a fresh snapshot and a line status change committing between the list read and the aggregate would then print a tile that contradicts the list.

- **AC-2**: Four query parameters drive the read, parsed by one pure module
  `apps/api-astrum/src/modules/order/seller-order-query.ts` exporting `parseSellerOrderQuery(raw)` and `sellerOrderWhere(userId, query)`, mirroring `order-list-query.ts`, so the controller stays a two line call and the parsing carries its own suite.

  `status` accepts the three members of `ORDER_LIST_STATUSES` (`ALL`, `DELIVERED`, `CANCELED`), where an absent value, an empty string and `ALL` all mean no status filter. `DELIVERED` filters lines with status `DELIVERED`; `CANCELED` filters the pair `CANCELLED` and `OUT_OF_STOCK`, because an out of stock line is a lost sale the seller reads as canceled. Only upper case is accepted. A value outside the set, a repeated parameter (which Express hands over as an array) and a non string value answer `400 INVALID_STATUS_FILTER`.

  `q` is trimmed once, and an empty result means no search. Over `ORDER_SEARCH_MAX_LENGTH` (64) characters after trimming answers
  `400 SEARCH_QUERY_TOO_LONG`; a repeated parameter answers `400 VALIDATION`. A one character query is searched like any other, and the match runs on a substring of the whole `orderId`, which is what makes the eight characters the row prints find its line.

  A bad `page` or `limit` answers `422 VALIDATION` through `parsePagination`, whose ceiling of 50 still applies. The status clause and the search clause combine through one `AND` array, never through two sibling `OR` keys in one object.

- **AC-3**: Each row of `items` carries exactly these fields, produced by an explicit `select` and one mapper, never by spreading a `findMany` row:
  `id`, `orderId`, `productId`, `name`, `previewImage`, `quantity`, `price`, `subtotal`, `currency`, `status`, `createdAt`, `isPickup`, `pickupPointName`, `pickupPointAddress`, `handedOverAt`, `deliveryAddress`.
  `createdAt`, `isPickup`, `pickupPointName`, `pickupPointAddress`, `handedOverAt` and `deliveryAddress` belong to the parent order and travel on every line of it. `price` and `subtotal` leave through `toMoney` (`apps/api-astrum/src/common/helpers/money.ts`), and `subtotal` is computed on the server as `toMoney(quantity × price)`, so the browser never multiplies money. No `userId`, `businessId`, `paymentStatus`, `paymentMethod`, `paymentDetails` and no idempotency column crosses the wire, which drops the payment fields the current panel prints.

- **AC-4**: `counts` is `{ all, delivered, canceled }` counted over the caller's lines across the whole set, never over the filtered page, so a tab label stays stable while the list narrows. `all` counts every line of the seller, `delivered` counts lines with status `DELIVERED`, and `canceled` counts the pair `CANCELLED` and `OUT_OF_STOCK`, the same pair the `CANCELED` filter selects, so the tab and the tile cannot disagree. One raw aggregate grouped by `status` and `currency` produces `counts` and `stats` together, so the pair and the delivered test are written once in the database and the transaction carries three reads instead of four.

- **AC-5**: `stats` is `{ revenue: [{ currency, amount }], units }`, computed over `DELIVERED` lines only and across the whole set.
  `amount` sums `quantity × price` per currency, which is the money the seller earned for goods: the order `grandTotal` adds `deliveryPrice` (measured: `totalPrice + deliveryPrice = grandTotal` on 105 of 105 orders), and the delivery fee is not the seller's. `units` sums `quantity` over the same delivered lines, which makes «Продано, шт.» a piece count and not an order count; the database hands the sum back as a string, so the mapper converts it with `Number`, and each `amount` goes through `toMoney`. A currency with no delivered line is absent from `revenue`; today the answer carries one entry, `RUB`. Entries are sorted by currency code ascending before they reach the screen.

- **AC-6**: Four tiles print in the mockup order. «Выручка» prints `stats.revenue`, one entry as it is and several entries joined by ` · ` through
  `formatMoney(amount, toCurrency(currency), locale)`, and `formatMoney(0, RUB, locale)` when the array is empty, so the tile never prints a blank cell. «Продано, шт.» prints `stats.units`, «Доставлено» prints `counts.delivered` and «Отменено» prints `counts.canceled`. The label sits at 14px in the muted foreground and the value at 24px weight 600 with `tabular-nums`, 6px below it. A tile is text: no hover, no focus, no handler.

- **AC-7**: Three tabs carry their counts from `counts`: «Все {all}», «Доставлены {delivered}», «Отменены {canceled}», grouped by the line status, which is the same value the row badge prints. Choosing one sets the `status` filter, returns the page to 1 and reads again through the hook. The strip is `role="tablist"` with one `role="tab"` per tab carrying `aria-selected`, and the strip carries `aria-label` from `tabs.label` (no `aria-controls`, because the block below is a table and a half true relationship reads worse than none); the default on mount is «Все» and it sends no `status`, so the first request key carries no filter. While a new key loads, the previous answer stays on screen (`keepPreviousData`), so a switch never blanks the table. Every member other than `DELIVERED`, `CANCELLED` and `OUT_OF_STOCK` appears only under «Все», which places `RETURNED`, `BACKORDERED` and `REPLACED` without a second rule.

- **AC-8**: One search field holds its own input state and moves the trimmed value into the request key after 300 ms without a keystroke, returning the page to 1. A 16px search icon sits inside it, the placeholder is «Номер заказа или товар», and `aria-label` comes from a catalog key, because a placeholder is not an accessible name. While a read is in flight the field shows a small spinner inside it and keeps the last answer. Clearing the field returns to the unfiltered list. `debouncedQuery` is the single source for the request key and for every empty verdict, while the raw input drives only what the field prints.

- **AC-9**: The table is flat, one row per line, with the six mockup columns in this order:

  | Column | Head key | Cell |
  |---|---|---|
  | Заказ | `columns.orderNumber` | the last 8 characters of `orderId` in `ui-monospace` |
  | Товар | `columns.product` | a 40px tile holding `previewImage` and the product name at weight 500, then a muted `× {quantity} шт.` line; the tile and the name link to `/products/{productId}`, and an empty `previewImage` renders the package icon in a plain `bg-secondary` tile, never a broken image |
  | Получение | `columns.receipt` | a pickup line prints `pickupPointName` (or `pickupPointAddress` when the name is empty) with a muted `· {handedOverAt}` suffix when the handover date is set, that date printed through `useFormatter` with `{ day: "numeric", month: "short", timeZone: browserTimeZone() }`; a courier line prints the `receipt.courier` label and `deliveryAddress`; a line with neither a point nor an address prints `receipt.noAddress` in the muted colour instead of an empty cell |
  | Сумма | `columns.subtotal` | `subtotal` with `currency` through `formatMoney`, right aligned with `tabular-nums` |
  | Дата | `columns.date` | the order `createdAt` through `useFormatter` with `{ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }` and `timeZone: browserTimeZone()`; the punctuation Intl renders in place of the mockup's comma is accepted |
  | Статус | `columns.status` | a pill badge from `orders.itemStatus.*` through `itemStatusKey`, right aligned |

  The badge carries its tone from one table keyed by `OrderItemStatus`, never from a boolean test: `success` for `DELIVERED`, `destructive` for `CANCELLED` and `OUT_OF_STOCK`, `secondary` for the other six (`PENDING`, `CONFIRMED`, `SHIPPED`, `RETURNED`, `BACKORDERED`, `REPLACED`), and the raw value for a member the table does not know. A row carries no other control and no handler.

- **AC-10**: Pagination slices lines, 20 per page (`SELLER_ORDERS_PAGE_SIZE = 20`), and prints «Назад», «Страница {page} из {totalPages}» and «Вперёд», disabled at the first and last page. A page above the last one renders the last page through the existing self correcting effect, so the screen never prints «Страница 3 из 2». The heading prints the found count from `total`, through the `found` plural key, and never from `items.length`. Both the pager and the found count render only in the loaded, non failed, non empty branch, so an empty set never prints «Страница 1 из 0» from its own `totalPages` of 0.

- **AC-11**: Six states, with a fixed precedence:
  - `403 SELLER_NOT_ASSIGNED` renders the not a seller screen with its link to `/seller/onboarding`, reusing `states.notSellerTitle`, `states.notSellerText` and `states.notSellerAction`;
  - a failed read renders the shared failure block with `states.failureTitle`, `states.failureText` and a retry calling `mutate`, and raises exactly one toast from an effect keyed on the error through `@/common/helpers/showLoadFailureOnce`, never from a render body;
  - the first load (`isLoading && data === undefined`) paints skeletons of the heading, the four tiles and three rows;
  - `counts.all === 0` renders the no lines state, reusing `states.emptyTitle` and `states.emptyText` (the gate reads the whole set, never `total`, which is the filtered count: a seller who owns lines and opens an empty tab must not read «Нечего собирать»);
  - an empty page with a settled query renders `emptySearchTitle` and `emptySearchText` and keeps the search field visible;
  - an empty page with no query and a chosen tab whose count is 0 renders `emptyTabTitle` and `emptyTabText`.
  No empty verdict renders while `isValidating` is true, and a failed read renders no empty state at all. The decision is one pure function in `features/pages/SellerOrders/lib/emptyState.ts` with its own suite, mirroring `features/pages/Orders/lib/emptyState.ts`, so the precedence is tested instead of living inside a hook.

- **AC-12**: The screen matches the token table and the geometry table of the Feature design section at 1280 and 390 wide, every colour comes from a theme token, and
  `grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/customer/src/features/pages/SellerOrders --include=*.tsx --include=*.ts` matches nothing. Below the `sm` breakpoint each row stacks into a card that prints each cell label from `lib/columns.ts`; the five column table it replaces prints an inline `sm:sr-only` label per cell, so reading the labels from one list is new work the sixth column earns. The mockup draws only the 1280 view. The mockup's own top tabs (`Мои заказы`, `Продажи`) are not built: the shared `Navbar` already leads to `/orders` and `/seller/orders`.

- **AC-13**: The blocks both screens need are extracted once, never copied: the stat tile, the tab strip, the search field, the failure block and the geometry classes leave `apps/customer/src/features/pages/Orders/` for `apps/customer/src/features/general/`, and both screens import them. Concretely:
  `features/general/StatTile/` (the tile, label and value, no control), `features/general/FilterTabs/` (a tab strip taking items, the current id and a change handler), `features/general/SearchField/` (icon, input, busy spinner, accessible name), `features/general/FailureBlock/` (title, text, retry label, handler) and `features/general/lib/screenStyles.ts` (the wrapper, heading, stat grid, toolbar, tab track, tab item, search field and search input classes moved out of `Orders/lib/styles.ts`; the wrapper is renamed `SCREEN_WRAPPER` and the rest already carry no prefix, so their names stay).
  The customer orders screen and its 19 suites stay green after the move, and `grep -rn "rounded-stat border border-border bg-card" apps/customer/src/features/pages` matches only the shared constant.

- **AC-14**: Money goes through one formatter with a locale: `formatMoney(amount, currency, locale)` renders through `Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })`. Measured on this machine with Node 24: `ru` prints `46 332,00 ₽` and `en` prints `₽46,332.00`, while the default currency display prints `RUB 46,332.00` in English, which is why the option belongs to the contract rather than to taste. The currency emoji leaves the amount path (`getCurrencyEmoji` is no longer called by `formatMoney`).

  The locale travels one way: a component reads it with `useLocale()` and passes it in, while a module under `lib/` takes it as its own argument, because a pure function cannot call a hook, which is why `Orders/lib/spent.ts` gains a locale parameter beside the arrays it already takes. The sweep covers 21 calls in 13 files once `SellerOrderRow` (one call) is deleted with the band, plus the 3 calls in `common/helpers/__tests__/money.test.ts`, which moves to locale pairs instead of the five fixed strings it asserts today. No component formats an amount with `toFixed`, `Intl` inline or a currency symbol in JSX.

- **AC-15**: Every string the screen prints comes from the `seller` namespace in both `apps/customer/messages/ru.json` and `apps/customer/messages/en.json`, and both files keep the same key set. The key table in the Feature design section lists every new and changed key, `orders.itemStatus.*` is reused for the nine status labels, `paymentLabel` and `statusCount` are deleted with their reader (`SellerOrderBand`, whose suite asserted both), and no Cyrillic literal sits in a `.tsx` file.

- **AC-16**: The gates are green, with the real output of each quoted in the report:

  ```bash
  pnpm --filter @astrum/api test && pnpm --filter @astrum/api check-types
  pnpm --filter @astrum/customer lint && pnpm --filter @astrum/customer test
  pnpm check-types && pnpm --filter @astrum/customer build
  ```

## Decision

**Chosen option**: Option 1: widen the read that already ships, flip the table to one row per line, and redraw the panel from the mockup onto the tokens spec 0023 pinned, sharing the blocks with the customer orders screen.

`GET /api/seller/orders` gains `status`, `q`, `page` and `limit`, and answers the lines, the three counts and the money in one `RepeatableRead` transaction. The table renders one row per order line, which is what the mockup draws and what makes its amount column a line subtotal (`18 × 2 574 = 46 332` in the mockup's own first row). The four tiles, the three tabs and the search reuse the blocks spec 0025 built for the customer screen, extracted into `features/general/` rather than copied. The money formatter gains the locale, which repaints every amount on the storefront, and that consequence is accepted on purpose: the screen cannot print grouped thousands while the helper has no locale.

**Implementation skills**: none consulted. The storefront follows `apps/customer/AGENTS.md` (S1 to S5) and the gateway follows `apps/api-astrum/AGENTS.md`.

**Assumed** (each needs one word from the engineer to change):

(a) the mockup's palette is mapped onto the tokens of spec 0023 instead of being added to the theme. The file carries the older grey family (`#101114` page, `#17181c` card, `#26282e` border), the same family spec 0025 mapped for the customer screen, while the dark theme prints the zinc values (`#09090b`, `#0c0c0e`, `#27272a`).

(b) the card radius of 14px lands on `rounded-xl`, which this theme's ladder resolves to 14px, and the row divider `#202228` lands on `border-border` (`#27272a`): one step of grey is not worth a token.

(c) badge fills follow the mockup's alpha pair rather than a new colour: `bg-success/10` with `border-success/20`, and `bg-destructive-soft/10` with `border-destructive-soft/20`.

(d) the row order is `order.createdAt` descending, then line `id` ascending. The mockup prints its rows newest first and says nothing about a tie.

(e) the mobile layout (below `sm`) stacks each row into a card with the column labels printed from one list. The mockup carries a single 1280 canvas and no media query, so this is the project's own convention applied to it, not a traced value.

(f) the tab, search, skeleton and failure blocks keep the geometry spec 0025 pinned, because they move as components; only the table, the tiles row of four and the receiving cell are new geometry.

(g) `stats.units` counts pieces of delivered lines only, the same population the revenue sums, so the two numbers on one screen describe one set.

(h) a line with neither a pickup point nor a delivery address prints `receipt.noAddress` rather than a dash, because a dash reads as data and the address is simply absent.

(i) the tab labels reuse the customer screen's wording («Доставлены», «Отменены») with line counts, so a seller moving between the two screens reads one vocabulary.

## Feature design

**Data model**: no schema change and no migration. The read is composed from three existing tables.

| Table | Columns read | Role |
|---|---|---|
| `OrderItem` | `id`, `orderId`, `productId`, `name`, `previewImage`, `quantity`, `price` (`Decimal(10,2)`), `currency`, `status`, `businessId` | one table row per line, the paged unit |
| `Order` | `id`, `createdAt`, `pickupPointName`, `pickupPointAddress`, `handedOverAt`, `deliveryAddress`, `shippingMethod.isPickup` | the order facts each line repeats |
| `Business` | `id`, `ownerUserId` (unique) | the ownership the read is scoped by |

Indexes used: `@@index([businessId, orderId])` and `@@index([orderId])` on `OrderItem`, plus the unique `Business.ownerUserId` that the ownership lookup already reads today.

**Ownership**: every read carries the seller through the business. The list and the count filter `business: { is: { ownerUserId } }`; both raw aggregates join `Business` on `ownerUserId`. The `403 SELLER_NOT_ASSIGNED` refusal stays where it is today, raised before any read when no business owns the account.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/seller/orders` | GET | `status` (`ALL` \| `DELIVERED` \| `CANCELED`, optional), `q` (string, trimmed, at most 64 characters, optional), `page`, `limit` (clamped to 50) | `{ items: SellerLineRow[], counts: { all, delivered, canceled }, stats: { revenue: [{ currency, amount }], units }, page, limit, total, totalPages }` | the `__auth` cookie through `authenticateToken`, every read scoped by the session account's business | `400 INVALID_STATUS_FILTER`, `400 SEARCH_QUERY_TOO_LONG`, `400 VALIDATION`, `403 SELLER_NOT_ASSIGNED`, `422 VALIDATION`, `401` from the middleware |

**Server reading shape** (three reads, one transaction at `RepeatableRead`):

1. `orderItem.count({ where })` with the same `where` the list uses, which is what `total` prints.
2. `orderItem.findMany({ where, orderBy: [{ order: { createdAt: "desc" } }, { id: "asc" }], skip: (page - 1) * limit, take: limit, select: { …line columns, order: { select: { createdAt, pickupPointName, pickupPointAddress, handedOverAt, deliveryAddress, shippingMethod: { select: { isPickup } } } } } })`
3. one raw aggregate over every line of the seller, grouped by status and currency, which produces `counts` and `stats` in one statement:
   `SELECT oi.status::text AS status, oi.currency::text AS currency, COUNT(*)::int AS count, COALESCE(SUM(oi.quantity), 0)::numeric AS units, COALESCE(SUM(oi.quantity * oi.price), 0)::numeric AS revenue FROM "OrderItem" oi JOIN "Business" b ON b.id = oi."businessId" WHERE b."ownerUserId" = $1 GROUP BY 1, 2`

The aggregate is raw for two reasons: Prisma `groupBy` cannot multiply two columns, and the canceled pair would otherwise be written three times (the TypeScript `where`, the count query and the money query). `counts` sums `count` over every row; `units` sums the rows whose `status` is `DELIVERED`; `revenue` collects the same rows per currency through `toMoney`, sorted by currency code. The filters appear in one place only, the `where` the list and the count share.

`where` for the list and the count: `{ business: { is: { ownerUserId } }, AND: [ … ] }`, where the array holds `{ status: "DELIVERED" }` or `{ status: { in: ["CANCELLED", "OUT_OF_STOCK"] } }` for a chosen tab and `{ OR: [{ name: { contains: q, mode: "insensitive" } }, { orderId: { contains: q, mode: "insensitive" } }] }` for a search. The order number is searchable on the line's own `orderId` column, so the search costs no join.

The mapper, `toSellerOrderLineJson`, flattens the parent order into the row and converts `price` and `subtotal` through `toMoney`. `withNumberPrices` in the controller and `toSellerOrderGroupJson` in the service are deleted with the group shape.

**Value sourcing** (every value the criteria display, with its source):

| Value displayed | Source |
|---|---|
| tile «Выручка» | `stats.revenue`, summed in the database over `DELIVERED` lines per currency |
| tile «Продано, шт.» | `stats.units`, `SUM(quantity)` over the same lines |
| tile «Доставлено» | `counts.delivered`, the same number the «Доставлены» tab prints |
| tile «Отменено» | `counts.canceled`, the same number the «Отменены» tab prints |
| tab labels | `counts.all`, `counts.delivered`, `counts.canceled` |
| «{total} позиций» under the heading | `total` from the count read |
| order number cell | last 8 characters of `orderId`, a display convention; the full value stays in the row |
| product cell | `name`, `previewImage`, `quantity`, `productId` from the line |
| receiving cell, pickup | `isPickup`, `pickupPointName`, `pickupPointAddress`, `handedOverAt` from the order |
| receiving cell, courier | `isPickup`, `deliveryAddress` from the order |
| amount cell | `subtotal` and `currency` from the line, `subtotal` computed on the server |
| date cell | the order `createdAt` through `useFormatter` with `browserTimeZone()` |
| status cell | the line `status` through `itemStatusKey` onto `orders.itemStatus.*` |
| pagination label | `page` and `totalPages` from the answer |
| every amount on every screen | `formatMoney(amount, toCurrency(currency), locale)` with `locale` from `useLocale()` |

**Key invariants**:

- `counts` and `stats` describe every line of the seller, never the filtered page, and the browser computes neither.
- The list, the count and the aggregate come from one `RepeatableRead` transaction.
- The page slices the unit `total` counts: lines, not orders.
- The list answer is an explicit `select` plus a mapper; no `userId`, no `businessId`, no payment column and no idempotency column crosses the wire.
- One money formatter (`formatMoney` with a locale) and one date formatter (`useFormatter` with `browserTimeZone()`) on this screen.
- The screen never filters, sorts or counts on its own: the tab and the search are request parameters, not client predicates.
- No control on the screen issues a write; the two seller write paths keep answering `SELLER_PANEL_READ_ONLY` (spec 0020).

**Security model**: the route sits behind `authenticateToken` like every mounted router except the auth proxy, and it carries no `requireActiveAccount`, matching spec 0020: a read only panel does not close to an unconfirmed account. Ownership is proven by the business attached to the session account (`Business.ownerUserId`), never by a value from the query string, so a seller cannot widen the read to another shop. The screen adds no role beyond an authenticated seller and no new refusal code.

**Configuration required**: none. No new environment variable, no new dependency, no migration.

**Design source**: `C:/Users/ADMIN/Downloads/Продажи-html/Sales.dc.html`, read from its `helmet` style block and its inline styles. Its own top navigation is not part of this feature (see AC-12), the same finding specs 0023 and 0025 recorded for their screens.

**Token mapping** (theme values as `apps/customer/src/app/index.css` prints them in `.dark`; the mockup column is this file's own value):

| Mockup | Mockup value | Token | Theme value | Class |
|---|---|---|---|---|
| page background | `#101114` | `--background` | `#09090b` | `bg-background` |
| card surface | `#17181c` | `--card` | `#0c0c0e` | `bg-card` |
| card and input border | `#26282e` | `--border`, `--input` | `#27272a` | `border-border` |
| row divider | `#202228` | `--border` | `#27272a` | `border-border` |
| tab track | `#17181c` | `--card` | `#0c0c0e` | `bg-card` |
| active tab | `#2a2d35` | `--secondary` | `#18181b` | `bg-secondary` |
| active tab label | `#ffffff` | `--foreground` | `#fafafa` | `text-foreground` |
| muted labels and dates | `#a3a5ad` | `--muted-foreground` | `#a1a1aa` | `text-muted-foreground` |
| body text | `#f2f2f3` | `--foreground` | `#fafafa` | `text-foreground` |
| thumb tile fill | `#22242a` | `--secondary` | `#18181b` | `bg-secondary` |
| thumb tile border | `#2f323a` | `--border` | `#27272a` | `border-border` |
| delivered badge | `#4ade80` at `18`/`33` alpha | `--success` | `#4ade80` | `text-success bg-success/10 border-success/20` |
| canceled badge | `#f87171` at `18`/`33` alpha | `--destructive-soft` | `#fca5a5` | `text-destructive-soft bg-destructive-soft/10 border-destructive-soft/20` |
| focus outline | none drawn | `--ring` | `#52525b` | `focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring` |

**Radii**: the card's 14px is `rounded-xl` (14px on this theme's ladder, `--radius: 0.625rem`), the tab track and the thumb tile of 10px are `rounded-lg`, the tab item of 8px is `rounded-md`, the stat tile of 12px is `rounded-stat` (the named token spec 0023 created), and the badge of 99px is `rounded-full`.

**Geometry table** (mockup value, then the class; the shared rows are the constants AC-13 moves):

| Block | Mockup | Class |
|---|---|---|
| wrapper | `max-width:1120px; margin:0 auto; padding:36px 40px 0; gap:24px` | `mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-10 pt-9 pb-16` (`SCREEN_WRAPPER`) |
| wrapper at 390 | `padding:20px 16px 0` | `max-sm:px-4 max-sm:pt-5` |
| heading row | flex, space between, items end, wrap, gap 8px | `flex flex-wrap items-end justify-between gap-2` (`HEADING_ROW`) |
| `h1` | 28px / 700 / `letter-spacing:-.02em` | `text-[28px] font-bold tracking-[-.02em] max-sm:text-2xl` (`HEADING`) |
| subtitle and found count | 14px, muted | `text-sm text-muted-foreground` (`HEADING_MUTED`) |
| stat grid | `repeat(auto-fit,minmax(220px,1fr))`, gap 12px | `grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]` (`STAT_GRID`) |
| stat tile | padding 16px 18px, radius 12px | `rounded-stat border border-border bg-card px-[18px] py-4` (`STAT_TILE`) |
| stat label | 14px muted | `text-sm text-muted-foreground` (`STAT_LABEL`) |
| stat value | 24px / 600, 6px above, tabular | `mt-1.5 block text-2xl font-semibold tabular-nums` (`STAT_VALUE`) |
| tab and search bar | flex, space between, wrap, gap 12px | `flex flex-wrap items-center justify-between gap-3` (`TOOLBAR`) |
| tab track | radius 10px, padding 3px, gap 2px | `flex gap-0.5 rounded-lg border border-border bg-card p-[3px]` (`TAB_TRACK`) |
| tab item | padding 7px 14px, radius 8px, 14px / 500 | `rounded-md px-3.5 py-[7px] text-sm font-medium` (`TAB_ITEM`) |
| search field | `min-width:260px; height:40px; padding:0 12px; gap:8px` | `flex h-10 min-w-[260px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm max-sm:w-full max-sm:min-w-0` (`SEARCH_FIELD`) |
| table card | radius 14px, 1px border, clipped | `overflow-hidden rounded-xl border border-border bg-card` |
| table head cell | 13px / 500 muted, padding 12px 16px, 1px bottom rule | `border-b border-border px-4 py-3 text-left text-[13px] font-medium text-muted-foreground` |
| table body cell | 14px, padding 14px 16px, 1px bottom rule, last row none | `border-b border-border px-4 py-[14px] text-sm last:border-b-0` |
| order number | `ui-monospace` | `font-mono text-[13px]` |
| product name | weight 500, 14px | `font-medium` |
| quantity line | 12.5px muted | `text-[12.5px] text-muted-foreground` |
| thumb tile | 40px, radius 10px | `grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-secondary` |
| amount cell | right, weight 500, tabular | `text-right font-medium tabular-nums` |
| status cell | right, pill badge, 12.5px / 500 | `flex justify-end` with `inline-flex items-center rounded-full border px-2.5 py-[3px] text-[12.5px] font-medium` |
| mobile row | no mockup value | `block border-b border-border px-4 py-3 sm:table-row` with one `sm:hidden` label per cell |

**State table**:

| State | Rendered |
|---|---|
| tab idle | `text-muted-foreground`, transparent fill |
| tab active | `bg-secondary text-foreground` |
| tab hover (idle only) | `hover:text-foreground` |
| tab focus | the ring row of the token table |
| search field focus | the same ring, through `focus-within` |
| search busy | a 16px spinner inside the field, `aria-hidden`, while `isValidating` |
| pagination disabled | `disabled:opacity-50 disabled:cursor-not-allowed` |
| row | no hover and no focus: the row is not a control; only the product link takes focus |
| badge | the three tones of AC-9, from one table keyed by the enum |

**Contrast pairs to survive** (computed from the token values): muted foreground on card `7.63:1`, foreground on card `18.72:1`, success text on `bg-success/10` over card `10.4:1`, destructive soft text on `bg-destructive-soft/10` over card `9.6:1`, muted on the secondary tab fill `6.91:1`.

**Catalog keys** (both `apps/customer/messages/ru.json` and `en.json`, same set, `seller` namespace; `found` and `handedOverAt` are the two existing keys whose value changes):

| Key | ru | en |
|---|---|---|
| `stats.revenue` | Выручка | Revenue |
| `stats.units` | Продано, шт. | Units sold |
| `stats.delivered` | Доставлено | Delivered |
| `stats.canceled` | Отменено | Canceled |
| `tabs.all` | Все {count} | All {count} |
| `tabs.delivered` | Доставлены {count} | Delivered {count} |
| `tabs.canceled` | Отменены {count} | Canceled {count} |
| `tabs.label` | Вкладки продаж | Sales tabs |
| `search.placeholder` | Номер заказа или товар | Order number or product |
| `search.label` | Поиск по продажам | Search sales |
| `columns.receipt` | Получение | Receipt |
| `quantity` | {count} шт. | {count} pcs |
| `handedOverAt` | выдан {date} | handed over {date} |
| `receipt.courier` | Курьер | Courier |
| `receipt.noAddress` | Адрес не указан | No address |
| `found` | {count, plural, one {# позиция} few {# позиции} many {# позиций} other {# позиции}} | {count, plural, one {# line} other {# lines}} |
| `emptySearchTitle` | Ничего не найдено | Nothing found |
| `emptySearchText` | По запросу «{query}» позиций нет. Измените запрос или очистите поле. | No line matches «{query}». Change the query or clear the field. |
| `emptyTabTitle` | В этой вкладке пусто | Nothing in this tab |
| `emptyTabText` | Позиций с таким статусом нет. Откройте «Все», чтобы увидеть остальные. | No line carries this status. Open «All» to see the rest. |

Reused as they stand: `title`, `subtitle`, `orderNumber`, `productFallback`, `retry`, `columns.orderNumber`, `columns.product`, `columns.subtotal` (its label «Сумма» is the mockup's own word), `columns.date`, `columns.status`, `pagination.label`, `pagination.back`, `pagination.next`, `pagination.pageOf`, `states.loadingLabel`, `states.notSellerTitle`, `states.notSellerText`, `states.notSellerAction`, `states.failureTitle`, `states.failureText`, `states.emptyTitle`, `states.emptyText`, and `orders.itemStatus.*` for the nine labels.

Deleted: `paymentLabel`, `statusCount` (their only reader, `SellerOrderBand`, is deleted), and the `columns` key set keeps no hole.

**Files** (S1 and S2 of the storefront standard: composition in `index.tsx`, one component per file, the tables in `lib/`, the feature's own state in `hooks/`):

| Path | Owns |
|---|---|
| `features/general/StatTile/index.tsx` | one tile, label and value, control free (moved from `Orders/components/StatsRow/StatTile.tsx`) |
| `features/general/FilterTabs/index.tsx` | the tab strip: items, current id, change handler, `role="tablist"` (moved and generalised from `Orders/components/OrdersToolbar/OrderTabs.tsx`) |
| `features/general/SearchField/index.tsx` | icon, input, busy spinner, accessible name (moved from `Orders/components/OrdersToolbar/OrderSearchField.tsx`) |
| `features/general/FailureBlock/index.tsx` | title, text, retry label and handler (moved from `Orders/components/OrdersStates/OrdersFailure.tsx`) |
| `features/general/lib/screenStyles.ts` | the shared class constants of the geometry table, one per design decision |
| `features/pages/Orders/**` (edited) | repointed at the shared blocks and constants; its four suites move with it |
| `features/pages/SellerOrders/index.tsx` | composition only: the read, the branch, the sections |
| `features/pages/SellerOrders/components/StatsRow/` | the four tiles, one file for the row and the value formatting |
| `features/pages/SellerOrders/components/SalesToolbar/` | the tab strip and the search field wired to the filters |
| `features/pages/SellerOrders/components/SalesTable/` | the table, its head and its stacked mobile layout |
| `features/pages/SellerOrders/components/SalesRow/` | one line: number, product cell, receiving cell, amount, date, badge, plus the product and receiving children in their own files |
| `features/pages/SellerOrders/components/SalesStates/` | the skeleton, the empty trio and their gates |
| `features/pages/SellerOrders/hooks/useSalesFilters.ts` | the chosen tab, the debounced query and the page, as one hook |
| `features/pages/SellerOrders/lib/columns.ts` | the six columns: id, head key, alignment, and the mobile label |
| `features/pages/SellerOrders/lib/status.ts` | the `OrderItemStatus` to badge tone and label key table, plus the two tab buckets |
| `features/pages/SellerOrders/lib/format.ts` | `browserTimeZone` only; the `lineSubtotal` and `countLinesByStatus` describes leave it |
| `features/pages/SellerOrders/lib/emptyState.ts` | which of the states applies, as one pure function with its suite, mirroring `Orders/lib/emptyState.ts` |
| `features/pages/SellerOrders/lib/__tests__/format.test.ts` | keeps `browserTimeZone` and the repo wide scan for a `format.dateTime(` call that carries no zone, the guard the date cell depends on |
| `features/pages/SellerOrders/StateScreen.tsx` | the plain title, text and action screen, kept for the not a seller branch and the empty states |
| `features/pages/SellerOrders/__tests__/` | `index.test.tsx` is rewritten for the flat table and loses its band, `paymentLabel` and `statusCount` assertions; `SellerOrders.test.tsx` follows the new shape |
| `hooks/seller/useSellerOrders.ts` | the read with filters and page, `SELLER_ORDERS_PAGE_SIZE`, `sellerOrdersKey(filters)` |
| `common/helpers/money.ts` | `formatMoney(amount, currency, locale)` through `Intl.NumberFormat` |
| `common/types/order.types.ts` | `SellerLineRow`, `SellerLineCounts`, `SellerSalesStats`, `SellerSalesPage`, `SellerListStatus`; the three old seller types are deleted |

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: the screen loads, the four tiles print the money, the units and the two counts, and the three tabs print their counts, verifies **AC-6**, **AC-7**.
- Grain: a page of 25 lines answers 20 then 5, and `total` reads 25 on both pages, verifies **AC-1**, **AC-10**.
- Filter: `status=CANCELED` returns both `CANCELLED` and `OUT_OF_STOCK` lines and their counts, and a `status=delivered` answers `400 INVALID_STATUS_FILTER`, verifies **AC-2**.
- Search: a fragment of a product name finds its lines and leaves `counts` and `stats` unchanged, and the last eight characters of an `orderId` find that order's lines, verifies **AC-2**, **AC-4**.
- Money: a canceled line is absent from `revenue` and from `units`, the delivery fee is absent too (the sum is lines only), and a currency with no delivered line is absent from the array, verifies **AC-5**.
- Format: one amount on the cart screen and one on this table print with the locale's grouping and separator, verifies **AC-14**.
- Failure: a failing read renders the failure block with its retry, raises exactly one toast, and renders no empty state, verifies **AC-11**.
- Refusal: an account with no business reads its own lines and none of another shop's, verifies **AC-3**, **AC-11**.

## Build plan

The project builds Tracer Bullet: a thin thread through every layer first, thickened afterwards. Here the thread is the real answer of `GET /api/seller/orders` read by the real screen, so the filters, the counts and the money are proven against the database before a single pixel moves to the mockup.

1. Gateway query module: `apps/api-astrum/src/modules/order/seller-order-query.ts` with `parseSellerOrderQuery` and `sellerOrderWhere`, and its suite covering an absent, empty and `ALL` status, `DELIVERED`, `CANCELED` expanding to the pair, a bogus value, a repeated value, a 64 character `q`, a 65 character `q`, a `q` with surrounding spaces and a repeated `q`, satisfies **AC-2**. — done: `apps/api-astrum/src/modules/order/seller-order-query.ts` with its 12 case suite `__tests__/seller-order-query.spec.ts`
2. Gateway read: `SellerOrderService.getSellerOrders(userId, query, pageInput, limitInput)` running the count, the list and the one status and currency aggregate in a single `prisma.$transaction([...], { maxWait: 5000, timeout: 10000, isolationLevel: "RepeatableRead" })`, plus `toSellerOrderLineJson` with `toMoney`, `Number` for the units and the server side `subtotal`; `toSellerOrderGroupJson` and `withNumberPrices` are deleted, satisfies **AC-1**, **AC-3**, **AC-4**, **AC-5**. — done: `seller-order.service.ts` runs the count, the list and the aggregate in one `RepeatableRead` transaction; `toSellerOrderLineJson` carries the 16 fields and the server side subtotal, and the group mapper left with `withNumberPrices`
3. Gateway suites move with the shape: `order.service.spec.ts` and `order.controller.spec.ts` gain the filter, count and money cases and lose the group assertions; `pnpm --filter @astrum/api test` and `check-types` are green, satisfies **AC-1**, **AC-5**, **AC-16**. — done: the service, controller and access suites rewritten, `seller-order-group.mapper.spec.ts` deleted, api 52 suites / 455 tests and its types green green
4. Money formatter: `formatMoney(amount, currency, locale)` through `Intl.NumberFormat` with `currencyDisplay: "narrowSymbol"`, the helper's suite rewritten to locale pairs, 21 call sites in 13 files passing the value of `useLocale()`, and `Orders/lib/spent.ts` taking the locale as an argument, satisfies **AC-14**. — done: `formatMoney(amount, currency, locale)` through `Intl.NumberFormat` with `narrowSymbol`, 21 call sites in 13 files passing `useLocale()`, and one shared `amountListText` in `features/general/lib/moneyText.ts`
5. Storefront data layer: `SellerLineRow`, `SellerLineCounts`, `SellerSalesStats`, `SellerSalesPage` and `SellerListStatus` in `common/types/order.types.ts`, `useSellerOrders({ status, q, page })` with `keepPreviousData`, and `sellerOrdersKey` returning the bare `/seller/orders?page=1&limit=20` when no filter is set, with its suite; the three old seller types are deleted with their readers, satisfies **AC-1**, **AC-7**, **AC-8**. — done: five types in `common/types/order.types.ts`, `useSellerOrders({status, q, page})` with `keepPreviousData`, `sellerOrdersKey` answering `/seller/orders?page=1&limit=20`
6. Shared blocks: create `features/general/{StatTile,FilterTabs,SearchField,FailureBlock}` and `features/general/lib/screenStyles.ts`, repoint the customer orders screen and its four suites, and confirm the tree carries no second copy of the tile or the tab classes, satisfies **AC-13**, **AC-16**. — done: `features/general/{StatTile,FilterTabs,SearchField,FailureBlock}` and `lib/screenStyles.ts`; `StatTile.tsx`, `OrderTabs.tsx`, `OrderSearchField.tsx` and `OrdersFailure.tsx` deleted, so the tile and tab classes exist once
7. Screen shell: composition, the heading with the found count, the four tiles and the loading skeletons, satisfies **AC-6**, **AC-10**, **AC-11**, **AC-12**. — done: `SellerOrders/index.tsx`, `components/StatsRow/` and the heading, tile and row skeletons
8. Toolbar: `lib/columns.ts` and `lib/status.ts` as the two tables, the tab strip and the search field wired to `useSalesFilters`, page back to 1 on a tab or a settled query, satisfies **AC-7**, **AC-8**. — done: `lib/columns.ts`, `lib/status.ts`, `components/SalesToolbar/` and `hooks/useSalesFilters.ts`, which returns the page to 1 on a tab or a settled query
9. Table: the six columns, the product cell with its links, the receiving cell with its pickup, courier and absent branches, the amount, the date and the badge from the status table, plus the stacked layout below `sm`, satisfies **AC-9**, **AC-12**. — done: `components/SalesTable/` and `components/SalesRow/{index,ProductCell,ProductThumb,ReceiptCell}.tsx` over `lib/styles.ts`
10. States: the not a seller screen, the failure block with its retry and its single toast from an effect, the no lines, nothing found and tab empty states with the precedence of AC-11, satisfies **AC-11**. — done: `components/SalesStates/SalesEmpty.tsx`, `lib/emptyState.ts` with its suite, and one toast per failed read through `showLoadFailureOnce`
11. Pagination: 20 lines per page with its three controls and the fallback to the last page, satisfies **AC-10**. — done: `components/SalesPager/`, `SELLER_ORDERS_PAGE_SIZE = 20` and the self correcting last page effect in `useSalesFilters`
12. Catalogs and gates: the new keys in both message files with equal key sets, the deleted keys gone, the `AC-12` hex grep empty, then lint, test, check-types and build, satisfies **AC-15**, **AC-16**. — done: both catalogs at 20 keys with equal sets, `paymentLabel` and `statusCount` gone, the hex grep empty; api 52 suites / 455 tests and its types green, customer 83 files / 444 tests and lint 0 errors, root check-types 5/5, customer build green

## Consequences

**Positive**:

- The tiles, the tab counts and the money cannot disagree with the list, because one transaction produces all four answers and the browser computes none of them.
- The search reaches a product name and an order number without a page of scrolling, at one request per settled query.
- The seller screen and the customer orders screen now share one tile, one tab strip, one search field and one failure block, so a later geometry change lands once.
- Every amount on the storefront prints with the reader's own locale, grouped and with the right separator, which the emoji prefix could never do.
- The list answer stops publishing payment state and the order level fields the flat table does not print.

**Negative / tradeoffs**:

- `formatMoney` gains a third argument, so 21 call sites in 13 files and the helper's suite move in the same change, and every screen that printed `₽299.00` now prints `299,00 ₽`. That is a visible change outside this feature and it is accepted on purpose.
- The read is a breaking shape change: the old group list is gone, so the hook, its types and both of its suites move with it. Nothing outside this repo consumes it.
- One line per row repeats the order number when an order holds several lines (up to 4 today), and the seller loses the order as a visual unit.
- The search runs `contains` on two columns, which cannot use an index; it stays cheap only because every read is scoped to one business.
- The `RepeatableRead` aggregate is one more statement per page, so a page costs three reads instead of the two it costs today.
- The panel still says nothing about payment, which some sellers check before handing goods over; that information now needs the customer order screen or a later feature.

**Neutral**:

- `stats` groups revenue by currency from the first release. With one currency in the data it prints one amount, and the shape survives a second currency without a redesign.
- The tab grouping (line status, with `OUT_OF_STOCK` in the canceled bucket) lives in one `lib/` table with a test, so the customer screen keeps its own order level grouping and neither invents the other's rule.
- The money formatter's locale comes from the request config, so a reader who switches language sees amounts change with the interface.
- The mockup's three off canvas facts (its sample numbers, its 14 orders and its own top navigation) are not built, and the spec says so instead of leaving them as omissions.

## Follow-up

- [x] `formatMoney` now needs the locale at every call site. The storefront rule S4 in `apps/customer/AGENTS.md` still describes the two argument call, so `/sync` should carry the new signature into that rule. — done: S4 now names `formatMoney(amount, currency, locale)` with the locale from `useLocale()`
- [x] `getCurrencyEmoji` stays in the tree with no money reader. If no other caller appears, it is dead code worth removing in its own small change. — done: no caller remained once the formatter dropped it, so `apps/customer/src/common/helpers/getCurrencyEmoji.ts` is deleted
- [ ] A seller who reads an order as a unit (four lines, one number) needs a group view or a link into the order. Neither is in this scope, and the panel stays read only.
- [ ] The paginated read still clamps `limit` at 50 through `parsePagination`. The screen asks for 20 lines, so the clamp never fires here; a later "page size" control must respect it.
- [ ] `browserTimeZone` is still imported by eleven features out of `features/pages/SellerOrders/lib/format`, the debt spec 0025 recorded. This feature keeps the import as it is.
- [ ] Payment state left this screen entirely. A seller who wants it back needs a column of its own, and that is a product decision, not a styling one.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
