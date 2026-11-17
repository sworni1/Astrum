# Scope: Astrum storefront

The browser side of the shop: the auth screens and the pages a signed in customer walks through. Backend services keep their own scopes.

**Build approach:** Tracer Bullet (every feature works end to end through the storefront and the gateway).
**Workflow:** Beta (after `/develop`: `/check verify`, then `/test`). A feature can carry its own tag to raise or lower that.

_These are recommendations to keep the build orderly, not requirements. Skip anything that does not fit. You decide when a feature is `done`._

## At a glance

| #   | Feature                                    | Phase    | Status      |
|-----|--------------------------------------------|----------|-------------|
| A   | Sign in and register screens               | Existing | existing    |
| B   | Home and categories                        | Existing | existing    |
| C   | Product page                               | Existing | existing    |
| D   | Cart and wishlist                          | Existing | existing    |
| E   | Orders                                     | Existing | existing    |
| F   | Profile and profile editing                | Existing | existing    |
| 1   | Registration form: age rule and date entry | Slice 1  | done        |
| 2   | Storefront coding standard                 | Slice 2  | in-progress |
| 3   | Order page decomposition                   | Slice 2  | in-progress |
| 4   | One quantity stepper for the shop          | Slice 2  | in-progress |
| 5   | Product reviews: real state                | Slice 2  | done        |
| 6   | Checkout form decomposition                | Slice 2  | done        |
| 7   | Optimized image decomposition              | Slice 2  | planned     |
| 8   | Cart money and selection                   | Slice 2  | planned     |
| 9   | Seller onboarding and profile form split   | Slice 2  | planned     |
| 10  | HTTP client out of the fetcher hook        | Slice 2  | planned     |
| 11  | Product card layout tokens                 | Slice 2  | planned     |
| 12  | Design tokens and the profile screen       | Slice 3  | done        |
| 13  | Checkout on its own route                  | Slice 3  | done        |
| 14  | Orders screen: stats, tabs, search         | Slice 3  | done        |
| 15  | Seller sales screen                        | Slice 3  | done        |
| 16  | Order page redesigned from the mockup      | Slice 3  | done        |

## Already built

### A. Sign in and register screens · existing

Email and password sign in, registration with email, nickname, date of birth and gender. Session lives in the `__auth` cookie. code in `apps/customer/src/features/auth/`

### B. Home and categories · existing

Landing page and the category listing with pagination. code in `apps/customer/src/features/pages/Home/`, `apps/customer/src/features/pages/Categories/`

### C. Product page · existing

One product with add to cart. code in `apps/customer/src/features/pages/ProductOverview/`

### D. Cart and wishlist · existing

Cart lines and the wishlist list. code in `apps/customer/src/features/pages/Cart/`, `apps/customer/src/features/pages/WishList/`

### E. Orders · existing

Order history for the signed in customer. code in `apps/customer/src/features/pages/Orders/`

### F. Profile and profile editing · existing

Profile page with an edit form for the stored fields. code in `apps/customer/src/features/pages/Profile/`

## Slice 1: Registration form

### 1. Registration form: age rule and date entry · done

The register screen accepts a birthday and a gender, but the date field has no minimum age rule, the calendar needs a lot of clicking to reach an older year, the picker stays open after a choice, and the date cannot be typed at all. Gender selection has the same staying open problem.
**Done when:** a birthday can be typed as `DD.MM.YYYY` or picked from the calendar; a date younger than 14 years is refused with a message under the field; the calendar jumps to any month and year through dropdowns and lands on a usable month when opened; both the calendar and the gender list close right after a choice.
- [x] Build it: `/develop registration form age rule and date entry`
- [x] Verify it: `/check verify registration form age rule and date entry`
- [x] Test it: `/test registration form age rule and date entry`
  code in `apps/customer/src/features/auth/Register/`, rule in `apps/customer/src/common/zodSchemes/auth.scheme.ts`
  spec [0001](../../specs/0001-registration-minimum-age/index.md), the server rule; the date entry and calendar part was built without a spec

## Slice 2: Code quality

### 2. Storefront coding standard

Measurements and the drafted rule list: `docs/reviews/2026-11-11-customer-code-quality.md`. One page decides how a storefront file is shaped, so the refactor below follows a written rule and not taste.
**Done when:** `apps/customer/AGENTS.md` carries the section (file and function size, folder shape, where mapping tables and pure helpers go, side effects only in handlers, money through `formatMoney`, `@/` imports, one formatter per package), the review checklist it implies is written, and a reviewer can reject a file by pointing at a rule.
- [x] Design it (spec): `/architect storefront coding standard`
  spec [0010](../../specs/customer/0010-storefront-coding-standard/index.md)
- [x] Build it: `/develop storefront coding standard`
  code in `apps/customer/AGENTS.md` (`## Coding standard`), `apps/customer/CODE_REVIEW.md`, `apps/customer/eslint.config.mjs`, `apps/customer/eslint-suppressions.json`
- [ ] Verify it: `/check verify storefront coding standard`
- [ ] Test it: `/test storefront coding standard`

### 3. Order page decomposition · in-progress

One 521 line file holds three lookup tables, four helpers, two copies of the delivery stepper and a 404 line component body, and a toast fires during render.
**Done when:** `OrderPage/index.tsx` composes named children, the status and payment maps plus the stepper logic live in `lib/` with tests, the mobile and desktop steppers share one progress component, and no toast is raised in a render body.
- [x] Build it: `/develop order page decomposition`
  code in `apps/customer/src/features/pages/Orders/OrderPage/` (`index.tsx` composition, `components/` 10 files, `lib/` status + payment + styles with tests, `hooks/` cancel and load failure); the `max-lines` exception for that file left `apps/customer/eslint.config.mjs` in the same change
  evidence: `tsc --noEmit` and `tsc -p tsconfig.test.json` clean, `eslint .` 0 errors (9 warnings, the same baseline), `vitest run` 137 tests in 31 files, `next build` green

### 4. One quantity stepper for the shop · in-progress

Two copies of the same stepper exist (98 identical lines, 0.66 similarity), one for the product card and one for the cart card, each with its own toast handling.
**Done when:** one `AddToCartWithQuantity` under `features/general/` serves both call sites, the cart copy is deleted, and adding from the product card and changing quantity in the cart both still work.
- [x] Build it: `/develop one quantity stepper for the shop`
  code in `apps/customer/src/features/general/AddToCartWithQuantity/` (`index.tsx` the one stepper, `lib/styles.ts` the width variant with a test); the product card copy and the cart card copy are deleted, and the product page uses the same component
  evidence: `tsc --noEmit` and `tsc -p tsconfig.test.json --noEmit` clean, `eslint .` 0 errors (8 warnings, one fewer than before since two copies became one), `vitest run` 147 tests in 33 files, rendered at 1037 and 390 wide with no horizontal overflow

### 5. Product reviews: real state · done

The reviews block renders four hard coded reviews of products that do not exist and a form that discards what it is given.
**Done when:** the demo constant is gone, the block renders an honest empty state when there are no reviews, and the submit path either posts or is visibly disabled instead of pretending.
- [x] Build it: `/develop product reviews real state` — built through root scope feature 8 (spec [0012](../../specs/_root/0012-reviews-on-the-product-screen/index.md)): the demo constant is gone, `ReviewsEmpty` covers zero reviews, `WriteReviewDialog` posts through `useCreateReview`, and the list, the summary and the rating come from the API
  code in `apps/customer/src/features/pages/ProductOverview/Reviews/`, `apps/customer/src/hooks/review/`

### 6. Checkout form decomposition

One 401 line file performs both form orchestration and every field, with a 350 line block.
**Done when:** the shipping, payment and summary sections are separate components, the submit and refusal handling stays in one hook, and the nine existing checkout tests pass unchanged.
- [x] Build it: `/develop checkout form decomposition` — absorbed by feature 13 as the slice 3 note says; the form landed as `SelectedLines`, `ReceiptSection`, `PaymentSection` and `SummaryCard` in `apps/customer/src/features/pages/Checkout/`, with the nine cases moved and green (spec [0024](../../specs/customer/0024-checkout-on-its-own-route/index.md))

### 7. Optimized image decomposition

One 376 line component downloads, caches, retries, falls back and renders at once, with `console` calls in the production path.
**Done when:** download and cache logic live outside the component, the presentation is a thin component, and the product card shows the same fallback as before.
- [ ] Build it: `/develop optimized image decomposition`

### 8. Cart money and selection

The cart summary prints `$` and `toFixed(2)` while every other screen goes through `formatMoney`, and the selection arithmetic sits inside the page.
**Done when:** every amount on the cart screen goes through `formatMoney` with the cart currency, the selection logic is a hook with tests, and a non USD cart shows its own symbol.
- [ ] Build it: `/develop cart money and selection`

### 9. Seller onboarding and profile form split

Two page files of 271 and 257 lines mix schema wiring, error mapping, restore logic and markup.
**Done when:** each page composes named sections, the server error code to message maps live in `lib/` with tests, and the existing onboarding and profile tests pass unchanged.
- [ ] Build it: `/develop seller onboarding and profile form split`

### 10. HTTP client out of the fetcher hook

`useFetcher` owns the axios instance, the interceptors, the session end policy and four module level flags in one 254 line hook.
**Done when:** the client and its interceptors live in a module outside React, the hook stays a thin wrapper, the session end and email refusal flows behave as before, and the existing hook tests pass unchanged.
- [ ] Build it: `/develop http client out of the fetcher hook`

### 11. Product card layout tokens

The card holds itself together with `h-[40px]`, `h-[55px]`, `mb-[-15px]`, `h-[100px]` and a clamp applied twice, once as a class and once inline.
**Done when:** the card lines up in a grid without fixed pixel heights on text blocks, the inline style is gone, and the layout holds at 200 percent zoom and in the second locale.
- [ ] Build it: `/develop product card layout tokens`

## Slice 3: Account screens

Five screens redrawn from the reference mockups in `C:/Users/ADMIN/Downloads/` (`Профиль-html`, `Оформление заказа-html`, `Мои заказы-html (1)`, `Продажи-html`, `Заказ — детали-html`). The mockup is the design source of truth for its screen: the spec transcribes its exact colours, sizes and states, and `/check verify` puts the built screen beside the rendered mockup at 390 and 1280 wide, so a screen that drifts from its file is a defect. Each feature section names its own `.dc.html` file. The pickers stay Radix Select and Popover with Calendar, so no screen here uses a native `select` or `input[type=date]`. The mockups were drawn without the shared header, so their own top tabs are not part of these features: `Navbar/index.tsx:105` and `MobileMenuSheet` already lead to `/orders`, `/seller/orders` and `/profile`. Feature 13 absorbs row 6 (checkout form decomposition) when it lands, because the checkout leaves the cart page as one and the same change.

### 12. Design tokens and the profile screen · done

The storefront dark theme is shadcn `neutral`: `--card` prints `#171717`, `--border` about `#222222`, `--ring` `#737373`. The mockups are zinc: page `#09090b`, card `#0c0c0e`, border `#27272a`, muted `#a1a1aa`, focus outline `#52525b`. `/profile` is a flat list of forms under a `Separator`, with no header, no avatar and no role.
**Done when:** the dark theme carries the mockup values plus `--success`, `--destructive-soft` and `--destructive-line`, the four redesigned screens and five existing screens (home, category, product, cart, wishlist) render with no contrast regression at 390 and 1280 wide, and `/profile` shows the avatar initial header, the profile data card with read only birthday and gender, the two role cards, the security card and the red account removal card, with every existing action still working.
**Reference:** `C:/Users/ADMIN/Downloads/Профиль-html/Main.dc.html`
- [x] Design it (spec): `/architect design tokens and the profile screen`
- [x] Build it: `/develop design tokens and the profile screen`
- [x] Verify it: `/check verify design tokens and the profile screen`
- [x] Test it: `/test design tokens and the profile screen`

### 13. Checkout on its own route · done

Checkout is a boolean in the cart page (`showCheckout`, `apps/customer/src/features/pages/Cart/index.tsx:18`), so it has no address of its own, cannot be linked and loses the browser back button. The form itself is one Card in one column with the summary at its bottom. code in `apps/customer/src/features/pages/Checkout/`, `apps/customer/src/common/helpers/checkoutSelection.ts`
**Done when:** `/checkout` is a route of its own under `(content)`, the cart hands the selected lines over in `sessionStorage` and the route reconciles them against the live cart, the screen is two columns with a sticky summary, delivery and payment are radio cards, the pickers keep Radix in theme tokens, and the submit button stays disabled with a hint naming the missing field until the form is valid.
**Reference:** `C:/Users/ADMIN/Downloads/Оформление заказа-html/Checkout.dc.html`
- [x] Design it (spec): `/architect checkout on its own route` — spec [0024](../../specs/customer/0024-checkout-on-its-own-route/index.md)
- [x] Build it: `/develop checkout on its own route`
  - [x] Route, handoff and reconcile: `/checkout` under `(content)` with its loading, failure and redirect states, the ids written by `useCartSelection` and the reconcile against `useGetCart` (AC-1 to AC-7)
  - [x] Form split into named sections, the label and hint tables in `lib/`, and the existing nine checkout tests moved along (AC-16, AC-17)
  - [x] Screen redrawn from the mockup: two columns, sticky summary, radio cards, Radix pickers at the control geometry (AC-9 to AC-13)
  - [x] Hint, refusals, the derived pickup branch and both catalogs wired, gates green (AC-8, AC-14, AC-15, AC-17, AC-18)
- [x] Verify it: `/check verify checkout on its own route` — 2026-11-17, all 18 AC met on the live stack after the delivery date fix (`docs/specs/customer/0024-checkout-on-its-own-route/verify.md`, Run log and Fix sections); two gaps stay deferred (no back to the cart control, transparent picker surfaces)
- [x] Test it: waived 2026-11-17, no separate `/test` pass was run for this feature; the coverage that exists is 399 cases in 73 files in the customer suite, the nine moved checkout cases unchanged plus the `DeliveryDateField` regression for the date fix

### 14. Orders screen: stats, tabs, search · done

One card per order with a link to the detail, an empty state and nothing else: no numbers, no filter, no search, and the card cannot show what was inside the order. The list route answers `orderItemsCount` and one preview image only.
**Done when:** the screen prints three stats (orders, spent, received), the tabs group the list by delivered and canceled, the search finds an order by its number and by any product name inside it, each order group lists its own lines, and the only action is `Открыть заказ`.
**Reference:** `C:/Users/ADMIN/Downloads/Мои заказы-html (1)/Main.dc.html`
- [x] Design it (spec): `/architect orders screen stats tabs search` — spec [0025](../../specs/customer/0025-orders-screen-stats-tabs-search/index.md)
- [x] Build it: `/develop orders screen stats tabs search` — 2026-11-16, all 10 tasks of the spec build plan landed; api 436 tests and types green, customer lint 0 errors and 421 tests green, root check-types and customer build green
  - [x] Gateway read: `status` and `q`, the lines, the three counts and the spent total in one `RepeatableRead` transaction (AC-1 to AC-6) — `apps/api-astrum/src/modules/order/order-list-query.ts`, `order.service.ts`, `order.mapper.ts`
  - [x] Data layer and readers: the new types, `useGetOrders(filters)`, `orderListKey`, the Navbar badge and the six revalidating hooks (AC-1, AC-9, AC-16) — `apps/customer/src/hooks/order/`
  - [x] Tiles, tabs and search: three stats, three tabs with their counts, the debounced search field (AC-7, AC-8, AC-9) — `features/pages/Orders/components/StatsRow/`, `components/OrdersToolbar/`, `hooks/useOrderSearch.ts`
  - [x] Groups and lines from the mockup: header fields, the whole card as a link, the line rows with their state (AC-10, AC-11, AC-14) — `components/OrderGroup/`, `components/OrderLineRow/`; the old `OrderCard/` is deleted
  - [x] States, catalogs and gates: three empty states, the failure block with its retry, both catalogs, lint, test, types, build (AC-12, AC-13, AC-15, AC-17) — `lib/emptyState.ts`, `components/OrdersStates/`, both `orders` catalogs
- [x] Verify it: `/check verify orders screen stats tabs search` — 2026-11-16, PASS on the runtime proof: shape, filters, search, tiles, three empty states, failure block, geometry at 1280 and 390, light theme, cancel revalidation; AC-13 failed first (nine toasts) and passed after the fix in `common/helpers/showLoadFailureOnce.ts`. Evidence in the spec's `verify.md`.
- [x] Test it: waived 2026-11-16, no separate `/test` pass was run for this feature; the coverage that exists is the customer suite at 425 cases in 80 files and the api suite at 436 cases in 52 suites, and `common/helpers/showLoadFailureOnce.ts` still carries no suite of its own

### 15. Seller sales screen · done

The seller panel is one read only table with a pagination and four state screens, and it reports no money at all: no revenue, no units sold, no count of delivered or canceled orders. code in `apps/customer/src/features/pages/SellerOrders/`, `apps/api-astrum/src/modules/order/seller-order-query.ts`, `apps/api-astrum/src/modules/order/seller-order.service.ts`
**Done when:** the panel prints four stats over the whole shop (revenue and units over the delivered lines only, delivered and canceled over every line, the delivery fee excluded), `GET /api/seller/orders` answers the rows, the counts and the money in one `RepeatableRead` transaction, the tabs group by the line status with `OUT_OF_STOCK` in the canceled bucket, the search finds by order number and product name, the table is redrawn in the palette with the six mockup columns, and no control writes anything.
**Reference:** `C:/Users/ADMIN/Downloads/Продажи-html/Sales.dc.html`
- [x] Design it (spec): `/architect seller sales screen` — spec [0026](../../specs/customer/0026-seller-sales-screen/index.md)
- [x] Build it: `/develop seller sales screen` — 2026-11-17, all 12 tasks of the spec build plan landed; api 52 suites / 455 tests and its types green, customer 83 files / 444 tests and lint 0 errors, root check-types 5/5, customer build green
  - [x] Gateway read: the query parser, the three reads in one transaction, the flat line rows, and the counts with the money from one aggregate (AC-1 to AC-5) — `seller-order-query.ts`, `seller-order.service.ts`
  - [x] Money formatter takes a locale through `Intl.NumberFormat`, and 21 call sites in 13 files move with it (AC-14) — one shared `amountListText` too
  - [x] Data layer and shared blocks: the hook with filters and page, and the tile, tab strip, search field and failure block extracted for both screens (AC-7, AC-8, AC-13) — `hooks/seller/useSellerOrders.ts`, `features/general/{StatTile,FilterTabs,SearchField,FailureBlock}`
  - [x] The screen: four tiles, the toolbar, the six column table with its stacked mobile layout, the states through `lib/emptyState.ts` and the pager (AC-6, AC-9 to AC-12) — `components/{StatsRow,SalesToolbar,SalesTable,SalesRow,SalesStates,SalesPager}/`
  - [x] Catalogs in both languages, dead keys gone, gates green (AC-15, AC-16) — 20 keys per catalog, equal sets
- [x] Verify it: `/check verify seller sales screen` — 2026-11-17, PASS on the runtime proof: seven key answer, line grain of the page, the canceled pair in filter and counts, four refusal codes, search by name fragment and order tail with the aggregates untouched, counts and money against SQL with the delivery fee out, four tiles, three tabs, six columns, the pager and its last page effect, the six states, tokens and geometry at 1280 and 390, both catalogs, gates green. The first run failed on AC-14 (the cart line price printed `$24054.80 за штуку`) and found two defects beside it (a failure toast over the `403` screen, a status pill wrapping to two lines); after the fix the second run re-drove those three and every criterion is met. Evidence in the spec's `verify.md`.
- [x] Test it: waived 2026-11-17, no separate `/test` pass was run for this feature; the coverage that exists is the customer suite at 448 cases in 84 files (the three assertions the fix added included), the api suite at 52 suites / 455 cases, lint 0 errors / 13 warnings, root check-types 5/5, and the behaviours `/check verify` proved live recorded in the spec's `verify.md`
### 16. Order page redesigned from the mockup · done

The screen the decomposition in row 3 left: a two column grid with the overview and the summary, the delivery card and the items card stacked under it. The mockup lays it out as one left card carrying the order header with the number and the copy control, the line list with brand, name, kind and quantity, the pickup point block and the payment block, and a right column carrying the paid total, its breakdown and the delivery progress. The mockup's own palette (`#101114` page, `#17181c` card, `#26282e` border) differs from the theme tokens spec 0023 shipped (`#09090b`, `#0c0c0e`, `#27272a`), so the screen keeps the current tokens and the mockup supplies the structure. Three blocks it draws have nothing behind them in the schema or the gateway (the receipt actions, the discount and savings line, the support contact), and they stay out of this feature.
**Done when:** `/orders/[id]` renders that structure on the live data: the left card with the order number, a copy control, the line count, the order date and the order status badge; the line rows with brand, name, kind, quantity, the line amount and its unit price pill; the pickup point block and the payment block; the right column with the paid total, the goods and delivery breakdown and the delivery progress with its four steps; the blocks the data cannot back are absent; the cancel and pay actions, the payment checking branch, the loading and the not found states behave as before; the copy is in both catalogs and the screen holds at 1280 and 390 wide in both themes.
**Reference:** `C:/Users/ADMIN/Downloads/Заказ — детали-html/Order.dc.html`
- [x] Design it (spec): `/architect order page redesigned from the mockup` — spec [0027](../../specs/customer/0027-order-page-redesign/index.md)
- [x] Build it: `/develop order page redesigned from the mockup` — 2026-11-17, all nine tasks of the spec build plan landed; api types and 142 order tests green, customer types, lint (0 errors) and 451 tests green, `next build` green
  code in `apps/customer/src/features/pages/Orders/OrderPage/` (`components/OrderScreen`, `OrderPageHeader`, `OrderLine`, `OrderTotalCard`, `OrderReceivingCard`, `OrderPickupBlock`, `OrderPaymentBlock`, `CopyOrderNumber`, `Pill`, rewritten `DeliveryProgress` and `OrderStatusBadge`, `lib/pills.ts`), the read in `apps/api-astrum/src/modules/order/order.service.ts` and `order.mapper.ts`, both `orders` catalogs
  - [x] The gateway read and the client types: three bounded lookups inside `getOrderById`, the four mapper fields, the type mirrors and every fixture literal (AC-1, AC-9)
  - [x] The shell: the wrapper and the grid, the header with its copy control, the line rows (AC-2, AC-3, AC-6)
  - [x] The right column and the left card's sub blocks: the total, the breakdown, the receiving block with its rail, the pickup and payment blocks (AC-4, AC-5)
  - [x] The pills on the theme tokens and the copy control's two toast paths (AC-7, AC-8)
  - [x] The retirements and both catalogs: the dead components, the dead constants, the twelve retired keys, the greps of AC-11 (AC-10, AC-11)
- [x] Verify it: `/check verify order page redesigned from the mockup` — 2026-11-17, PASS: the four new read values with the two leaks gone and the ownership `404`; the header with its copy control and its two toast paths; three line rows with shop, kind, quantity, server side line amount and the `Out of stock` pill on the one non normal line; the pickup and the delivery sub blocks; the paid total with its breakdown and the received or expected date printed once; the rail at 0 % on `PENDING` and 100 % on `DELIVERED`; the canceled order without a receiving block; three pill tones measured from the tokens; no overflow at 1280 and 390 with two tracks and one, sticky at 96px; the same day under both locales; every state of the screen this database can produce. Four provider states (the pay press, the return branch, the unconfirmed copy, a real cancellation) stay unproven and are named in the spec's `verify.md`. Evidence in that file; closed `done` on 2026-11-17, `Test it` waived with the coverage that exists
- [x] Test it: waived 2026-11-17 with the close, no separate `/test` pass was run for this feature; the coverage that exists is the customer suite at 451 cases in 85 files, the api suite at 52 suites / 459 cases, lint 0 errors / 13 warnings, root check-types 5/5, the `next build` of `/develop`, and the behaviours `/check verify` proved live recorded in the spec's `verify.md`. Four provider states of the pay path (the press, the return branch, the unconfirmed copy, a real cancellation) stay unproven there, so they are the hole a later `/test` should close

## Legend

- **Next step** = the first unticked box.
- **Status**: `planned` → `in-progress` → `done`, plus `existing` (built before this scope) and `dropped`.
- A row tagged `needs a decision` runs `/architect` first; the tag drops once its spec is captured.
- **Workflow tag** beside a heading (for example `· GA`) overrides the project default for that feature.
