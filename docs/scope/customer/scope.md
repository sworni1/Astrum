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
| 6   | Checkout form decomposition                | Slice 2  | planned     |
| 7   | Optimized image decomposition              | Slice 2  | planned     |
| 8   | Cart money and selection                   | Slice 2  | planned     |
| 9   | Seller onboarding and profile form split   | Slice 2  | planned     |
| 10  | HTTP client out of the fetcher hook        | Slice 2  | planned     |
| 11  | Product card layout tokens                 | Slice 2  | planned     |
| 12  | Design tokens and the profile screen       | Slice 3  | done        |
| 13  | Checkout on its own route                  | Slice 3  | planned     |
| 14  | Orders screen: stats, tabs, search         | Slice 3  | planned     |
| 15  | Seller sales screen                        | Slice 3  | planned     |

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
- [ ] Build it: `/develop checkout form decomposition`

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

Four screens redrawn from the reference mockups in `C:/Users/ADMIN/Downloads/` (`Профиль-html`, `Оформление заказа-html`, `Мои заказы-html (1)`, `Продажи-html`). The exact colours, sizes and states are copied into the specs, so the build never opens a `.dc.html` file, and the pickers stay Radix Select and Popover with Calendar, so no screen here uses a native `select` or `input[type=date]`. The mockups were drawn without the shared header, so their own top tabs are not part of these features: `Navbar/index.tsx:105` and `MobileMenuSheet` already lead to `/orders`, `/seller/orders` and `/profile`. Feature 13 absorbs row 6 (checkout form decomposition) when it lands, because the checkout leaves the cart page as one and the same change.

### 12. Design tokens and the profile screen · done

The storefront dark theme is shadcn `neutral`: `--card` prints `#171717`, `--border` about `#222222`, `--ring` `#737373`. The mockups are zinc: page `#09090b`, card `#0c0c0e`, border `#27272a`, muted `#a1a1aa`, focus outline `#52525b`. `/profile` is a flat list of forms under a `Separator`, with no header, no avatar and no role.
**Done when:** the dark theme carries the mockup values plus `--success`, `--destructive-soft` and `--destructive-line`, the four redesigned screens and five existing screens (home, category, product, cart, wishlist) render with no contrast regression at 390 and 1280 wide, and `/profile` shows the avatar initial header, the profile data card with read only birthday and gender, the two role cards, the security card and the red account removal card, with every existing action still working.
- [x] Design it (spec): `/architect design tokens and the profile screen`
- [x] Build it: `/develop design tokens and the profile screen`
- [x] Verify it: `/check verify design tokens and the profile screen`
- [x] Test it: `/test design tokens and the profile screen`

### 13. Checkout on its own route · planned

Checkout is a boolean in the cart page (`showCheckout`, `apps/customer/src/features/pages/Cart/index.tsx:18`), so it has no address of its own, cannot be linked and loses the browser back button. The form itself is one Card in one column with the summary at its bottom.
**Done when:** `/checkout` is a route of its own under `(content)`, the cart hands the selected lines over in `sessionStorage` and the route reconciles them against the live cart, the screen is two columns with a sticky summary, delivery and payment are radio cards, the pickers keep Radix in theme tokens, and the submit button stays disabled with a hint naming the missing field until the form is valid.
- [x] Design it (spec): `/architect checkout on its own route`
- [ ] Build it: `/develop checkout on its own route`
- [ ] Verify it: `/check verify checkout on its own route`
- [ ] Test it: `/test checkout on its own route`

### 14. Orders screen: stats, tabs, search · planned

One card per order with a link to the detail, an empty state and nothing else: no numbers, no filter, no search, and the card cannot show what was inside the order. The list route answers `orderItemsCount` and one preview image only.
**Done when:** the screen prints three stats (orders, spent, received), the tabs group the list by delivered and canceled, the search finds an order by its number and by any product name inside it, each order group lists its own lines, and the only action is `Открыть заказ`.
- [x] Design it (spec): `/architect orders screen stats tabs search`
- [ ] Build it: `/develop orders screen stats tabs search`
- [ ] Verify it: `/check verify orders screen stats tabs search`
- [ ] Test it: `/test orders screen stats tabs search`

### 15. Seller sales screen · planned

The seller panel is one read only table with a pagination and four state screens, and it reports no money at all: no revenue, no units sold, no count of delivered or canceled orders.
**Done when:** the panel prints four stats over the whole set (revenue, units sold, delivered, canceled), the tabs filter by the same grouping as the customer screen, the search finds by order number and product name, the table is redrawn in the palette with the six mockup columns, and no control sends a request.
- [x] Design it (spec): `/architect seller sales screen`
- [ ] Build it: `/develop seller sales screen`
- [ ] Verify it: `/check verify seller sales screen`
- [ ] Test it: `/test seller sales screen`

## Legend

- **Next step** = the first unticked box.
- **Status**: `planned` → `in-progress` → `done`, plus `existing` (built before this scope) and `dropped`.
- A row tagged `needs a decision` runs `/architect` first; the tag drops once its spec is captured.
- **Workflow tag** beside a heading (for example `· GA`) overrides the project default for that feature.
