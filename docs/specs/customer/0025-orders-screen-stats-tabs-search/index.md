# 0025. Orders screen: stats, tabs, search

**Date**: 2026-11-16
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The orders screen stops being a flat list of order cards and becomes the screen the reference mockup draws: three stat tiles at the top (orders, money spent, orders received), three tabs that group the list into all, delivered and canceled, one search field that finds an order by its number or by a product name inside it, and one group card per order that lists the products it holds. The gateway read grows to answer the filtered list, the three tab counts and the spent total in one response, because a filtered list can no longer be the source of numbers about the whole set. Nothing in the database changes: the lines, the counts and the money all come from tables and columns that already exist.

## Requirements

**User stories**:

- As a customer, I want to see how many orders I have, how much I have spent and how many I have received, so that I read my history without counting cards.
- As a customer, I want to switch between delivered and canceled orders, so that I reach the order I mean without scrolling past the rest.
- As a customer, I want to find an order by its number or by a product I remember, so that I do not open ten orders to find one.
- As a customer, I want to see which products each order held, so that I recognise the order before I click it.
- As the shop, I want the tiles, the tab counts and the list to come from one answer, so that no number can claim something the list below contradicts.

**Acceptance criteria** (the contract):

- **AC-1**: `GET /api/orders` answers one object instead of a bare array: `{ items, counts, spent }`. `items` is the filtered list, in the order the query already answers (`createdAt` descending) and never sorted again in the browser. `counts` is `{ all, delivered, canceled }` and `spent` is a list of `{ currency, amount }`. All three reads run inside one `prisma.$transaction([...], { isolationLevel: "RepeatableRead" })`, because the level this repo uses for its write transactions (`ReadCommitted`, `apps/api-astrum/src/modules/order/order-status.helpers.ts:12`) gives every statement its own snapshot, and a cancel committing between the list read and either aggregate would then print a tile that contradicts the list. The route keeps its path, its mount and its middleware, so no auth surface is added. The storefront types follow in `apps/customer/src/common/types/order.types.ts`: `OrderListRow` (id, status, createdAt, grandTotal, currency, orderItems), `OrderLineRow` (id, name, previewImage, quantity, status, receiptDate), `OrderListPage` (items, counts, spent). `OrderListItem` is deleted, and every file that names it moves to the new shape in the same change: its own definition at `apps/customer/src/common/types/order.types.ts:99`, `apps/customer/src/hooks/order/useGetOrders.ts` (four references), `apps/customer/src/features/pages/Orders/OrderCard/index.tsx` and `apps/customer/src/features/pages/Orders/OrderCard/__tests__/index.test.tsx`. The card and its three case suite are then replaced by `Orders/components/OrderGroup/` and its suite (AC-10, AC-11), not kept beside it. `useGetOrders` takes optional filters (`{ status?: OrderListStatus; q?: string }`), so the Navbar calls it with none and shares the bare `/orders` key with an unfiltered screen.

- **AC-2**: Two query parameters drive the read. `status` accepts `ALL`, `DELIVERED` and `CANCELED`, where an absent value or `ALL` means no status filter. `q` is trimmed, and an empty value means no search. A `status` outside that set answers `400 INVALID_STATUS_FILTER`, and a `q` longer than 64 characters after trimming answers `400 SEARCH_QUERY_TOO_LONG`; both codes join `ORDER_ERROR_CODES` in `apps/api-astrum/src/modules/order/constants/order.constants.ts`, and the parsing lives in a pure module `apps/api-astrum/src/modules/order/order-list-query.ts` with its own suite, so the controller stays a two line call. Only upper case is accepted: `delivered` is not `DELIVERED`. A repeated parameter, which Express hands over as an array rather than a string, is invalid input and answers the same `400`. A one character query is searched like any other, because the whole set is at most a few dozen orders for one customer.

- **AC-3**: `q` matches an order whose `id` contains the text, ignoring case, or an order that holds at least one line whose `name` contains the text, ignoring case. The number the screen prints is the last eight characters of the id, so a customer who copies that number finds the order, and a fragment of any product name finds it too. The search and the status filter combine through one `AND` array, never through two sibling `OR` keys in one `where` object, because the second `OR` would silently replace the first.

- **AC-4**: `counts` describes every order of the caller and never depends on `status` or `q`, so the tab labels stay stable while the list narrows. `counts.all` is the number of every order, `counts.delivered` the number with status `DELIVERED` and `counts.canceled` the number with status `CANCELED`.

- **AC-5**: `spent` groups by `currency` over the orders of the caller with status other than `CANCELED` and with `paymentStatus = PAID` or status `DELIVERED`, summing `grandTotal`. A canceled order is not money spent, and an order that was never paid and never reached the customer is not either, while a cash order delivered to the customer still counts even though its payment status stays `PENDING` (10 such orders exist in the dev database today). A currency with no qualifying order is absent from the array; today the answer carries one entry, `RUB`. Each `amount` leaves the gateway as a number through `toMoney` (`apps/api-astrum/src/modules/order/order.mapper.ts`), so the browser never receives a `Decimal`.

- **AC-6**: Each item carries its own lines under `orderItems`, ordered by `id` ascending, and each line carries exactly `id`, `name`, `previewImage`, `quantity`, `status` and `receiptDate`. No price, no currency and no `businessId` travels per line, and the row itself carries exactly `id`, `status`, `createdAt`, `grandTotal`, `currency` and `orderItems`. The list answer therefore no longer carries `orderItemsCount` or an order level `previewImage`, because the lines carry both, and it carries no `userId`, `paymentDetails`, `idempotencyKey` or `idempotencyHash`. The narrow shape comes from an explicit `select` in both queries, not from spreading a `findMany` row.

- **AC-7**: The three tiles print in the mockup order. «Всего заказов» prints `counts.all`, «Потрачено» prints `spent` through `formatMoney(amount, toCurrency(currency))` (one entry as it is, several entries joined by ` · `, so a customer holding orders in two currencies reads two honest amounts instead of one sum of two different units), and «Получено» prints `counts.delivered`. When `spent` is empty the tile prints `formatMoney(0, RUB)`, the same fallback `toCurrency` already gives an unknown currency, so the tile never prints an empty cell. Entries are sorted by currency code ascending before they are joined, so the tile cannot reorder itself between two answers. The label sits at 14px in the muted foreground and the value at 24px weight 600 with `tabular-nums`, 6px below it.

- **AC-8**: Three tabs carry their counts from `counts`: «Все {all}», «Доставлены {delivered}», «Отменены {canceled}». Choosing one sets the `status` filter and reads again through the hook; an order in flight (status `PENDING`, `CONFIRMED` or `SHIPPED`) appears only under «Все», because the scope groups by delivered and canceled and the seller screen in row 15 must read the same grouping. While a new key loads the previous answer stays on screen, so a switch never blanks the list. The strip is `role="tablist"` with one `role="tab"` per tab carrying `aria-selected`, and the default on mount is «Все», which sends no `status` at all, so the first request key is the bare `/orders`.

- **AC-9**: One search field with a 16px search icon and the placeholder «Номер заказа или товар». It holds its own input state and moves the query into the request key only after 300 ms without a keystroke. While any request is in flight the field shows a small spinner inside it, and the screen keeps the last answer. Only the answer of the current key renders, so a slow reply for an older query can never replace a newer one. Clearing the field returns to the unfiltered list. The value is trimmed before it reaches the key, so a trailing space neither rebuilds the key nor reaches the server as text the client already judged empty. `debouncedQuery` is the single source for the request key and for every gate that decides an empty state, while the raw input drives only what the field prints. The field carries `aria-label` from the new `orders.search.label` key, because a placeholder is not an accessible name.

- **AC-10**: Each order renders as one group card, `rounded-group border border-border bg-card overflow-hidden`, whose header is `flex flex-wrap items-center justify-between gap-4 bg-secondary px-7 py-[18px]` holding three fields in the mockup order: «Номер заказа» with the last eight characters of the id printed through the existing `orders.number` key, «Дата заказа» with `createdAt` through `useFormatter` (`dateStyle: "long"`, no time, `timeZone: browserTimeZone()`), and «Сумма» with `grandTotal` through `formatMoney`. The whole group is one `<Link href={`/orders/${id}`}>` with the project focus ring, and it carries no other control: no receipt, no archive, no repeat purchase, and nothing on it sends a request. Its accessible name is the order number line (`Заказ 6s5hb6l1`), so a screen reader announces the order rather than the whole card.

- **AC-11**: Under the header each line renders as `flex flex-wrap items-center justify-between gap-5 border-t border-border px-7 py-[22px]`. On the left: a 96px image tile (`rounded-stat border border-border bg-secondary`) holding `previewImage` through `next/image` with `width={96}`, `height={96}`, `alt` from the line name and a `sizes` value naming the 96px and 80px boxes, while an empty or missing `previewImage` (the column allows an empty string) renders the tile as a plain `bg-secondary` square with the package icon the mockup draws, never a broken image, the product name at 16px weight 600, and one muted 15px line with the quantity from a new catalog key («18 шт.»). There is no variant line, because `OrderItem` has no variant column and this feature adds none. On the right: a 16px round dot and the line state from `orders.itemStatus.*` with the date when `receiptDate` is set (through `useFormatter`, `dateStyle: "long"`). The dot is `bg-success` for `DELIVERED`, `bg-destructive-soft` for `CANCELLED` and `bg-muted-foreground` for every other member, and the label table covers all nine members of `OrderItemStatus`, each keyed explicitly, so a member added later renders its own label instead of falling through a boolean test.

- **AC-12**: Three empty states, each with its own text in the catalog. «No orders at all» reuses the existing `orders.emptyTitle` and `orders.emptyText`, which already say exactly that, and renders when `counts.all === 0`. «Nothing found» uses the new `orders.emptySearchTitle` and `orders.emptySearchText`, renders when the list is empty, `debouncedQuery` is not empty and `counts.all > 0`, and keeps the search field visible so the customer can clear it. «This tab is empty» uses the new `orders.emptyTabTitle` and `orders.emptyTabText` and renders when the list is empty, `debouncedQuery` is empty and the count of the chosen tab is 0. Precedence is fixed and read in this order: a failed read renders no empty state at all (AC-13 owns that screen), then no orders at all, then nothing found, then this tab is empty. Every gate reads `debouncedQuery` and never the raw input, so text typed 100 ms ago cannot claim a verdict about a filter that has not been requested yet, and no gate renders while `isValidating` is true, which covers a tab switch and the first load alike.

- **AC-13**: While the first answer loads the screen paints the page shell (heading and three tiles as skeletons) instead of a lone spinner. When the read fails it renders a failure block with a title from the catalog and a retry button calling `mutate`, and it raises one toast from an effect keyed on the error, never from the render body: the current file calls `showToast` inside the component body (`apps/customer/src/features/pages/Orders/index.tsx:23`), which rule S4 of the storefront standard forbids. No empty state renders from a failed read. The failure block replaces the list block only: the heading keeps its title and the three tiles keep the last values when an answer existed before, and print their skeleton when there was none. The predicates are `isLoading && page === undefined` for the first load and `error !== undefined` for the failure, so the two can never both decide.

- **AC-14**: The screen matches the mockup at 1280 and at 390 wide: the wrapper, the heading block, the stat grid, the tab and search bar, the group header, the line row and the mobile stack are the ones in the geometry table of the Feature design section, and every colour comes from a theme token through the mapping table, so `grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/customer/src/features/pages/Orders --include=*.tsx --include=*.ts` matches nothing.

- **AC-15**: Every string the screen prints comes from the `orders` namespace in both `apps/customer/messages/ru.json` and `apps/customer/messages/en.json`, and both files keep the same key set. The key table in the Feature design section lists every new key with its text in both languages, and `orders.emptyTitle` and `orders.emptyText` are reused for the no orders state rather than duplicated. No Cyrillic literal sits in a `.tsx` file, every amount prints through `formatMoney`, and every date prints through `useFormatter`.

- **AC-16**: Every reader of the list follows the new shape. `apps/customer/src/features/layout/Navbar/index.tsx` takes its badge count from `counts.all` at both call sites (the desktop item at line 98 and the mobile sheet at line 151) instead of `orders.length`, and its suite `apps/customer/src/features/layout/Navbar/__tests__/index.test.tsx` mocks the new return shape. The six hooks that revalidate the list stop naming the key themselves, four of them with an inline `mutate("/orders")` or `` mutate(`/orders`) `` (`useCheckout`, `useCreateOrder`, `useSyncOrderPayment`, `useUpdateOrderItemStatus`) and two through a file local `ORDER_LIST_KEY` (`usePayOrder`, `useUpdateOrderStatus`), and all six go through one exported matcher `isOrderListKey` from `apps/customer/src/hooks/order/orderListKey.ts`, which matches `/orders` and `/orders?…` but never `/orders/<id>`; the same module exports `orderListKey({ status, q })`, which yields the bare `/orders` when both filters are empty. Both functions carry a test, and a cancel performed from the detail screen refreshes the filtered list and the counts.

- **AC-17**: the four gates are green, with the real output of each quoted in the report:

```bash
pnpm --filter @astrum/api test && pnpm --filter @astrum/api check-types
pnpm --filter @astrum/customer lint && pnpm --filter @astrum/customer test
pnpm check-types && pnpm --filter @astrum/customer build
```

## Decision

**Chosen option**: Option 1: widen the read that already ships, and redraw the screen from the tokens spec 0023 pinned.

`GET /orders` gains two filters and answers the lines, the three counts and the spent total in one object, computed in one transaction so the numbers and the list describe one snapshot. The screen is rebuilt as the mockup draws it out of the tokens spec 0023 already created for exactly this screen (`--success`, `--radius-stat`, `--radius-group` were named there with this screen in mind), and the mockup's own hex values are mapped onto those tokens instead of being copied. There is no schema change, no migration, no new route and no new middleware.

**Assumed:**
(a) the tabs and the search live in component state, not in the URL. A tab in the query string would need a router write on every keystroke or a second source of truth beside the request key, and the scope asks for neither.
(b) three tabs and no fourth. An order in flight appears only under «Все», which is what the scope's grouping says and what row 15 must copy.
(c) the mockup's palette is mapped onto the spec 0023 tokens rather than added to the theme: the mockup of this slice carries an older grey (`#101114` page, `#17181c` card) while the profile mockup carried the zinc values the theme now prints.
(d) the mockup's red dot `#f87171` prints as `bg-destructive-soft` (`#fca5a5`), the nearest token in the palette, and its green `#4ade80` is the token itself.
(e) the mockup's three actions (receipt, archive, repeat purchase) are deliberately not built: the gateway has no route for a receipt, `Order` has no archive column and a repeat purchase is a cart write no scope row asks for. They are named here so their absence reads as a decision rather than an omission.
(f) the variant line the mockup prints under the product name («Muted Black GT») is not built, because `OrderItem` carries no variant column.
(g) the group card's hover affordance is `hover:border-ring/60` on the card border, since the mockup draws no hover state and the whole card is a link.

**Implementation skills**: none consulted. The storefront follows `apps/customer/AGENTS.md` (S1 to S5) and the gateway follows `apps/api-astrum/AGENTS.md`.

## Feature design

**Data model**: no schema change and no migration. The read is composed from `Order` (`id`, `status`, `paymentStatus`, `createdAt`, `grandTotal`, `currency`, `userId`) and `OrderItem` (`id`, `name`, `previewImage`, `quantity`, `status`, `receiptDate`, `orderId`), both already indexed on the columns the filters use: `@@index([userId])` on `Order` scopes every query to the caller, and `@@index([orderId])` on `OrderItem` serves the line read.

**Why no new index**: the search runs `contains` on `Order.id` and on `OrderItem.name`, both of which cannot use a B tree index with a leading wildcard. The scan is bounded by the `userId` filter, which does use its index: the largest single customer holds 21 orders today. An index would be dead weight, and the honest reason is written here so a later reader does not add one.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/orders` | GET | `status` (`ALL` \| `DELIVERED` \| `CANCELED`, optional), `q` (string, trimmed, at most 64 characters, optional) | `{ items: OrderListRow[], counts: { all, delivered, canceled }, spent: [{ currency, amount }] }` | the `__auth` cookie through `authenticateToken`, every query filtered by the session `userId` | `400 INVALID_STATUS_FILTER`, `400 SEARCH_QUERY_TOO_LONG`, `401` from the middleware, `500` from `handleErrors` |

**Server reading shape** (one `prisma.$transaction([...])` so all three describe one snapshot):

1. `order.findMany({ where, orderBy: { createdAt: "desc" }, select: { id, status, createdAt, grandTotal, currency, OrderItem: { select: { id, name, previewImage, quantity, status, receiptDate }, orderBy: { id: "asc" } } } })`
2. `order.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } })`
3. `order.groupBy({ by: ["currency"], where: { userId, status: { not: "CANCELED" }, AND: [{ OR: [{ paymentStatus: "PAID" }, { status: "DELIVERED" }] }] }, _sum: { grandTotal: true } })`

The `where` for the first read is `{ userId, AND: [...] }`, where the array holds the status clause when a tab is chosen and the search clause when `q` is not empty. The search clause is `{ OR: [{ id: { contains: q, mode: "insensitive" } }, { OrderItem: { some: { name: { contains: q, mode: "insensitive" } } } }] }`.

**Value sourcing** (every value the criteria display, with its source):

| Value displayed | Source |
|---|---|
| tile «Всего заказов» | `counts.all` from the `groupBy` on `status` |
| tile «Потрачено» | `spent` from the `groupBy` on `currency`, `_sum.grandTotal` |
| tile «Получено» | `counts.delivered`, the same number the «Доставлены» tab prints |
| tab labels | `counts.all`, `counts.delivered`, `counts.canceled` |
| «{n} заказов найдено» under the heading | `items.length` of the current answer, printed through the existing `orders.found` key |
| group number | last 8 characters of `id`, a display convention only; the full id stays in the link |
| group date | `createdAt` through `useFormatter` with `dateStyle: "long"` and `timeZone: browserTimeZone()` |
| group total | `grandTotal` and `currency` through `formatMoney(amount, toCurrency(currency))` |
| line title | `orderItems[].name`, the snapshot taken when the order was created |
| line quantity | `orderItems[].quantity` through the new catalog key |
| line state | `orderItems[].status` through the nine member table onto `orders.itemStatus.*` |
| line date | `orderItems[].receiptDate`, printed only when it is not null |
| line image | `orderItems[].previewImage` through `next/image` |
| link target | `id` |

**Key invariants**:

- `counts` and `spent` describe every order of the caller, never the filtered subset, and the browser never computes either.
- The list, the counts and the spent total come from one transaction.
- The list answer is an explicit `select`; no `userId`, no `businessId`, no idempotency column and no `paymentDetails` crosses the wire.
- One money formatter (`formatMoney` with `toCurrency`) and one date formatter (`useFormatter` with `browserTimeZone()`) on this screen; no `toFixed`, no currency symbol and no hex literal in the feature.
- The client shows what the server sent and never filters, sorts or counts on its own: the tab and the search are request parameters, not client predicates.

**Security model**: the route sits behind `authenticateToken` like every mounted router except the auth proxy, and every query carries `where: { userId }` taken from the session, so the search and the counts read only the caller's own rows. No role is required beyond an authenticated account. The read is not behind `requireActiveAccount`, so an account in `PENDING` still browses its orders, which matches the rule that only ordering and reviews are closed to it.

**Configuration required**: none. No new environment variable, no new dependency.

**Design source**: `C:/Users/ADMIN/Downloads/Мои заказы-html (1)/Main.dc.html`, read from its `helmet` style block and its inline styles. The mockup's own top navigation (`Мои заказы` / `Продажи`) is not part of this feature: the shared `Navbar` already leads to `/orders` and `/seller/orders`, the same finding spec 0023 recorded for that slice.

**Token mapping** (theme values as `apps/customer/src/app/index.css` prints them in `.dark`; the mockup column is this file's value):

| Mockup | Mockup value | Token | Theme value | Class |
|---|---|---|---|---|
| page background | `#101114` | `--background` | `#09090b` | `bg-background` |
| card surface | `#17181c` | `--card` | `#0c0c0e` | `bg-card` |
| card and input border | `#26282e` | `--border`, `--input` | `#27272a` | `border-border` |
| group header strip | `#1c1d22` | `--secondary` | `#18181b` | `bg-secondary` |
| tab track | `#17181c` | `--card` | `#0c0c0e` | `bg-card` |
| active tab | `#2a2d35` | `--secondary` | `#18181b` | `bg-secondary` |
| active tab label | `#ffffff` | `--foreground` | `#fafafa` | `text-foreground` |
| muted labels | `#a3a5ad` | `--muted-foreground` | `#a1a1aa` | `text-muted-foreground` |
| body text | `#f2f2f3` | `--foreground` | `#fafafa` | `text-foreground` |
| image tile fill | `#22242a` | `--secondary` | `#18181b` | `bg-secondary` |
| image tile border | `#2f323a` | `--border` | `#27272a` | `border-border` |
| received dot | `#4ade80` | `--success` | `#4ade80` | `bg-success` |
| canceled dot | `#f87171` | `--destructive-soft` | `#fca5a5` | `bg-destructive-soft` |
| focus outline | none drawn | `--ring` | `#52525b` | `focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring` |

**Radii**: the mockup's 12px (stat tile, image tile) is `rounded-stat`, its 16px (group card) is `rounded-group`, its 10px (tab track, search field) is `rounded-lg` and its 8px (tab item) is `rounded-md`. The ladder resolves through `--radius: 0.625rem` (10px), so `rounded-md` is 8px and `rounded-lg` is 10px.

**Geometry table** (mockup value, then the class):

| Block | Mockup | Class |
|---|---|---|
| wrapper | `max-width:1120px; margin:0 auto; padding:36px 40px 0; gap:24px` | `mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-10 pt-9 pb-16` |
| wrapper at 390 | `padding:20px 16px 0` | `max-sm:px-4 max-sm:pt-5` |
| heading row | flex, space between, items end, wrap, gap 8px | `flex flex-wrap items-end justify-between gap-2` |
| `h1` | 28px / 700 / `letter-spacing:-.02em` | `text-[28px] font-bold tracking-[-.02em]` |
| `h1` at 390 | 24px | `max-sm:text-2xl` |
| subtitle and found count | 14px, muted | `text-sm text-muted-foreground` |
| stat grid | `repeat(auto-fit,minmax(220px,1fr))`, gap 12px | `grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]` |
| stat tile | padding 16px 18px, radius 12px | `rounded-stat border border-border bg-card px-[18px] py-4` |
| stat value | 24px / 600, 6px above, tabular | `mt-1.5 text-2xl font-semibold tabular-nums` |
| tab and search bar | flex, space between, wrap, gap 12px | `flex flex-wrap items-center justify-between gap-3` |
| tab track | radius 10px, padding 3px, gap 2px | `flex gap-0.5 rounded-lg border border-border bg-card p-[3px]` |
| tab item | padding 7px 14px, radius 8px, 14px / 500 | `rounded-md px-3.5 py-[7px] text-sm font-medium` |
| search field | `min-width:260px; height:40px; padding:0 12px; gap:8px` | `flex h-10 min-w-[260px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm max-sm:w-full max-sm:min-w-0` |
| group card | radius 16px, border 1px | `rounded-group overflow-hidden border border-border bg-card` |
| group header | padding 18px 28px | `flex flex-wrap items-center justify-between gap-4 bg-secondary px-7 py-[18px]` |
| group fields | flex, gap 36px | `flex flex-wrap gap-9` |
| field label / value | 14px muted / 15px 600 | `flex flex-col gap-1 text-sm text-muted-foreground` with `text-[15px] font-semibold text-foreground` |
| line row | padding 22px 28px, 1px top border | `flex flex-wrap items-center justify-between gap-5 border-t border-border px-7 py-[22px]` |
| image tile | 96px, radius 12px | `h-24 w-24 shrink-0 rounded-stat border border-border bg-secondary` |
| line title | 16px / 600 | `text-base font-semibold` |
| line quantity | 15px muted | `text-[15px] text-muted-foreground` |
| line state | 15px muted, dot 16px, gap 10px | `flex items-center gap-2.5 text-[15px] text-muted-foreground` with `size-4 shrink-0 rounded-full` |
| mobile group header | column, grid of 3 | `max-sm:flex-col max-sm:items-start max-sm:px-5` and `max-sm:grid max-sm:grid-cols-3 max-sm:gap-x-6 max-sm:gap-y-3.5` |
| mobile line row | column, tile 80px | `max-sm:flex-col max-sm:items-start max-sm:px-5` with `max-sm:h-20 max-sm:w-20` |

**State table**:

| State | Rendered |
|---|---|
| group card hover | `hover:border-ring/60` (Assumed, the mockup draws no hover) |
| group card focus | `focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring` |
| tab idle | `text-muted-foreground`, transparent fill |
| tab active | `bg-secondary text-foreground` |
| tab hover (idle only) | `hover:text-foreground` |
| search field focus | the same ring as the card focus row |
| search busy | a 16px spinner inside the field, `aria-hidden`, while `isValidating` |
| tile | no hover and no focus: it is text, not a control |

**Contrast pairs to survive** (computed from the token values, all far above the 4.5:1 body floor): muted foreground on card 7.63:1, foreground on card 18.72:1, muted on the header strip 6.91:1, foreground on the header strip 16.97:1, success dot on card 11.22:1, destructive soft dot on card 10.3:1.

**Catalog keys** (both `apps/customer/messages/ru.json` and `apps/customer/messages/en.json`, same set, `orders` namespace):

| Key | ru | en |
|---|---|---|
| `stats.orders` | Всего заказов | Total orders |
| `stats.spent` | Потрачено | Spent |
| `stats.received` | Получено | Received |
| `tabs.all` | Все {count} | All {count} |
| `tabs.delivered` | Доставлены {count} | Delivered {count} |
| `tabs.canceled` | Отменены {count} | Canceled {count} |
| `search.placeholder` | Номер заказа или товар | Order number or product |
| `search.label` | Поиск по заказам | Search orders |
| `fields.number` | Номер заказа | Order number |
| `fields.date` | Дата заказа | Order date |
| `fields.amount` | Сумма | Amount |
| `quantity` | {count} шт. | {count} pcs |
| `emptySearchTitle` | Ничего не найдено | Nothing found |
| `emptySearchText` | По запросу «{query}» заказов нет. Измените запрос или очистите поле. | No orders match «{query}». Change the query or clear the field. |
| `emptyTabTitle` | В этой вкладке пусто | Nothing in this tab |
| `emptyTabText` | Заказов с таким статусом нет. Откройте «Все», чтобы увидеть остальные. | No orders carry this status. Open «All» to see the rest. |
| `retry` | Повторить | Try again |

Reused as they stand: `orders.number` (the group number line), `orders.found` (the count under the heading), `orders.failed` (the failure title), `orders.emptyTitle` and `orders.emptyText` (the no orders state), `orders.itemStatus.*` (nine members, both files already carry all nine).

**Files** (S1 and S2 of the storefront standard: composition in `index.tsx`, one component per file, the tables in `lib/`, the feature's own state in `hooks/`):

| Path | Owns |
|---|---|
| `features/pages/Orders/index.tsx` | composition only: reads the hook, picks the branch, renders the sections |
| `features/pages/Orders/components/StatsRow/` | the three tiles, one file each for the row and the tile |
| `features/pages/Orders/components/OrdersToolbar/` | the tab strip and the search field |
| `features/pages/Orders/components/OrderGroup/` | the group card, its header and the link |
| `features/pages/Orders/components/OrderLineRow/` | one line, its tile, its quantity line and its state |
| `features/pages/Orders/components/OrdersStates/` | the empty, failure and skeleton blocks |
| `features/pages/Orders/hooks/useOrderSearch.ts` | the input value, the debounce and the trimmed query |
| `features/pages/Orders/lib/tabs.ts` | the three tabs: id, wire `status` value, label key, count key |
| `features/pages/Orders/lib/lineState.ts` | the nine member table of `OrderItemStatus` onto a label key and a dot class |
| `features/pages/Orders/lib/emptyState.ts` | which of the three states applies, as one pure function with its test |
| `features/pages/Orders/lib/styles.ts` | the class constants of the geometry table |
| `hooks/order/useGetOrders.ts` | the read, the filters and the page type |
| `hooks/order/orderListKey.ts` | `orderListKey` and `isOrderListKey` |
| `features/layout/Navbar/index.tsx` | the badge from `counts.all` (edited, not created) |

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: the screen loads, the three tiles print `counts.all`, the joined currencies and `counts.delivered`, and the three tabs print their counts, verifies **AC-7**, **AC-8**.
- Search by product name: typing a fragment of a line name narrows the list to the orders holding that line and leaves the counts unchanged, verifies **AC-3**, **AC-4**.
- Search by number: typing the last eight characters of an id finds that order, verifies **AC-3**.
- Money rule: a canceled order and an unpaid order in flight are absent from `spent`, a delivered cash order with `paymentStatus` `PENDING` is present, verifies **AC-5**.
- Refusal: `status=BOGUS` answers `400 INVALID_STATUS_FILTER` and a 65 character `q` answers `400 SEARCH_QUERY_TOO_LONG`, verifies **AC-2**.
- Failure: a failing read renders the failure block with its retry and raises one toast, and no empty state renders, verifies **AC-13**.
- Cache: a cancel performed on the detail screen refreshes the filtered list and the counts, verifies **AC-16**.

## Build plan

The project builds Tracer Bullet: a thin thread through every layer first, thickened afterwards. Here the thread is the real answer of `GET /orders` read by the real screen, so the filters, the counts and the spent total are proven against the database before a single pixel moves to the mockup.

1. Gateway read, first half: add the two error codes and the constants (`ORDER_LIST_STATUSES`, `ORDER_SEARCH_MAX_LENGTH`) to `apps/api-astrum/src/modules/order/constants/order.constants.ts`, and write `order-list-query.ts` with `parseOrderListQuery(raw)` and its suite (absent and `ALL`, both real values, a bogus value, a 64 character `q`, a 65 character `q`, a `q` with surrounding spaces), satisfies **AC-2**. — done: `constants/order.constants.ts` carries `INVALID_STATUS_FILTER`, `SEARCH_QUERY_TOO_LONG`, `ORDER_LIST_STATUSES` and `ORDER_SEARCH_MAX_LENGTH`, and `order-list-query.ts` holds `parseOrderListQuery` and `orderListWhere` with 14 cases in `__tests__/order-list-query.spec.ts`
2. Gateway read, second half: change `getOrdersByUserId(userId, query)` to run the three reads in one `prisma.$transaction` at `isolationLevel: "RepeatableRead"`, narrow both selects, add the status and search clauses through one `AND` array, and map the answer in `order.mapper.ts` as `toOrderListJson(page)`, satisfies **AC-1**, **AC-3**, **AC-4**, **AC-5**, **AC-6**. — done: `getOrdersByUserId(userId, query)` runs the narrowed `findMany` and both `groupBy` reads in one `$transaction` at `RepeatableRead`, and `toOrderListJson(page)` answers `{ items, counts, spent }`
3. Move the gateway suites with it: `order.service.spec.ts`, `order.controller.spec.ts` and `order.mapper.spec.ts` gain the filter, count and spent cases and lose the `orderItemsCount` and `previewImage` assertions, satisfies **AC-1**, **AC-5**. — done: the three suites moved to the page shape and gained the filter, count and spent cases; api 436 tests in 52 suites, `tsc --noEmit` clean
4. Storefront data layer: the new types in `common/types/order.types.ts`, `useGetOrders(filters)` returning `{ page, isLoading, isValidating, error, mutate }` with `keepPreviousData`, and `hooks/order/orderListKey.ts` with `orderListKey` and `isOrderListKey` plus their suite, satisfies **AC-1**, **AC-9**, **AC-16**. — done: `OrderLineRow`, `OrderListRow`, `OrderListPage` and `OrderListStatus` in `order.types.ts` (OrderListItem deleted), `useGetOrders(filters)` with `keepPreviousData`, `orderListKey.ts` with 6 cases
5. Repoint every reader: `Navbar` to `counts.all` at both call sites, and the five revalidating hooks to `isOrderListKey`, with the Navbar suite mocked to the new shape, satisfies **AC-16**. — done: the badge reads `counts.all` at both call sites and all six hooks (useCheckout twice, useCreateOrder, useSyncOrderPayment, useUpdateOrderItemStatus, usePayOrder, useUpdateOrderStatus) match through `isOrderListKey`
6. Screen shell: the wrapper, the heading row with the found count, and the three tiles (skeletons while the first answer loads), satisfies **AC-7**, **AC-13**, **AC-14**. — done: `components/StatsRow/` (row plus tile) paints the three values and the skeletons, and `lib/spent.ts` with its 3 cases carries the money text
7. Tabs and search: the `lib/` tab table with its counts, the tab strip, the search field with its 300 ms debounce and its spinner, all wired to the request key, satisfies **AC-8**, **AC-9**. — done: `lib/tabs.ts` with its counts, `components/OrdersToolbar/` (tablist plus field) and `hooks/useOrderSearch.ts` with the 300 ms debounce
8. Groups and rows: `components/OrderGroup/` with its header fields and its link, the line rows with the tile, the quantity line and the `lib/lineState` table, replacing `Orders/OrderCard/` and moving its three cases into an equivalent suite in the new folder, satisfies **AC-10**, **AC-11**, **AC-14**. — done: `components/OrderGroup/`, `components/OrderLineRow/` and 5 cases; `Orders/OrderCard/`, its suite and `lib/status.ts` are deleted
9. States: the three empty states gated on `!isValidating`, the failure block with its retry, and the toast moved into an effect, satisfies **AC-12**, **AC-13**. — done: `lib/emptyState.ts` with 6 cases decides the states, `OrdersFailure` carries the retry, and the toast is raised from an effect in `hooks/useOrdersScreen.ts`
10. Catalogs and gates: the new keys in both message files, the feature split into `components/` and `lib/` per S1 and S2, then lint, test, check-types and build, satisfies **AC-15**, **AC-17**. — done: 17 new `orders` keys in both catalogs with equal key sets; customer lint 0 errors, customer 421 tests in 78 files, root `check-types` green, customer build green, the AC-14 hex grep matches nothing

## Consequences

**Positive**:
- The three numbers and the list cannot disagree, because one transaction produces them and the browser computes none of them.
- The search reaches a product name without loading a detail screen, and it costs one request per settled query string.
- The screen is redrawn from tokens that already exist, so this feature adds no colour, no radius and no theme value.
- The list answer stops publishing `userId`, `paymentStatus` and `paymentDetails` to the browser, which the spread row did until now. The idempotency columns were already stripped by `toOrderJson` and `toOrderListJson`, and `businessId` is a column of `OrderItem` that the list never carried.

**Negative / tradeoffs**:
- The list answer is a breaking shape change: the old array is gone, so the hook, its types, the Navbar and the card suite move in the same change. Nothing outside this repo consumes it.
- The search runs `contains` on two columns, which cannot use an index; it stays cheap only because every query is already scoped to one customer. A shop that one day shows thousands of orders to one account needs a different read, and the Follow-up says so.
- The read is not paginated, so the screen holds every order of the caller in memory. That is 21 rows for the largest account today.
- The mockup's three actions are absent, so the screen is thinner than the drawing.
- The variant line is absent, so a line prints its product name and its quantity only.

**Neutral**:
- `spent` is grouped by currency from the first release. With one currency in the data it prints one amount, and the shape survives a second currency without a redesign.
- The tab grouping lives in one `lib/` table with a test, so row 15 (the seller sales screen) copies the rule instead of inventing a second meaning of «delivered».
- The tab and the search are component state, so a refresh returns to «Все» with an empty field.

## Follow-up

- [ ] Pagination is out of scope: the read answers every order of the caller. When a customer's volume or the seller panel asks for paging, the counts and the spent total must move to the server with the page, or they will describe a page while claiming to describe the whole set.
- [ ] `browserTimeZone` is imported by five features out of `features/pages/SellerOrders/lib/format`. This feature keeps the import as it is; a later cleanup moves it to `src/common/helpers/`, where rule S3 puts a helper with two or more consumers.
- [ ] `apps/customer/src/features/layout/Navbar/index.tsx` raises toasts for cart, wishlist and order errors from its render body, the same S4 violation this feature fixes on the orders screen. Untouched here, worth its own small change.
- [ ] A receipt, an archive and a repeat purchase need a route, a schema column and a cart write respectively. None is in the scope today; the mockup draws all three.
- [ ] A variant line («Muted Black GT») needs a product option column captured on `OrderItem` at order creation. Neither the column nor the capture exists.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
