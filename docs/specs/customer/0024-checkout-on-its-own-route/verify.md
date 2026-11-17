# 0024. Checkout on its own route — verify

Run from the repository root on the dev stack (`pnpm dev`, storefront on `:3000`, gateway on `:3580`). Each step names the criterion it proves. Commands that read the database use the container's own environment, because the repo `.env` and the volume can disagree on the role.

## 1. The route exists and the boolean is gone (AC-1)

**Status**: passed · both paths exist, `grep "showCheckout\|CheckoutScreen"` returns nothing, the page imports `@/features/pages/Checkout` only.


```
ls apps/customer/src/app/\(content\)/checkout/page.tsx apps/customer/src/features/pages/Checkout/index.tsx
```

Expected: both paths exist.

```
grep -rn "showCheckout\|CheckoutScreen" apps/customer/src
```

Expected: no match. A single match means the cart still swaps its body for a checkout.

```
grep -rn "cart/page\|features/pages/Cart" apps/customer/src/app/\(content\)/checkout/page.tsx
```

Expected: no match, because the route imports from `@/features/pages/Checkout` only.

## 2. The handoff carries ids and nothing else (AC-2)

**Status**: passed · every `sessionStorage` call sits in `src/common/helpers/checkoutSelection.ts`, `useCartSelection` is the only writer, the stored value is the id array, and the live cart wrote `["2ed57cb9…","3b701cac…"]` in render order.


```
grep -rn "sessionStorage" apps/customer/src --include=*.ts --include=*.tsx
```

Expected: one write site, inside `apps/customer/src/features/pages/Cart/hooks/useCartSelection.ts`, and one read site inside the checkout feature, both importing the same constant from `@/common/constants/checkout`, plus the guard `typeof window !== "undefined"` on the read. A `setItem` inside `CheckoutButton` or inside the checkout feature means two writers for one key.

```
grep -rn "JSON.stringify\|JSON.parse" apps/customer/src/features/pages/Cart apps/customer/src/features/pages/Checkout apps/customer/src/common/constants/checkout.ts
```

Expected: the stored value is an array of ids. A stringified row object means the handoff carries prices and the reconcile is bypassed.

Manual: sign in, add two products, tick one on `/cart`, open devtools, Application, Session Storage, `http://localhost:3000`. Expected: the key from `src/common/constants/checkout.ts` holds a JSON array with exactly the one ticked product id.

## 3. Rows come from the live cart (AC-3)

**Status**: passed · `useGetCart` feeds the screen and the subtotal lives in `lib/reconcileLines.ts` with 5 cases; a quantity change to 3 read back as `3 pcs` and ₽5992.80 after a reload.


```
grep -rn "useGetCart" apps/customer/src/features/pages/Checkout
```

Expected: the page feature reads the cart through the hook, not through the handoff.

```
grep -rn "price\s*\*\|subtotal" apps/customer/src/features/pages/Checkout/lib
```

Expected: the subtotal is computed from the live row's `price` and `quantityInCart` inside the `lib/` helper, with its unit test beside it.

Manual: on `/checkout`, change a line's quantity on `/cart` in a second tab, then reload `/checkout`. Expected: the row and the subtotal show the new quantity and the new line total, which proves nothing was snapshotted.

## 4. Empty or unusable handoff redirects (AC-4)

**Status**: passed · an empty key and unknown ids both replace the location with `/cart` and raise one info toast (`Pick at least one item to check out`). The failure branch was reached by blocking `*api-gateway/cart*` (the gateway stayed up), which rendered `Failed to load cart` with Retry and no redirect.


Manual, twice:

1. On `/cart`, tick a line, click the checkout button, then clear the key in Session Storage and press enter in the address bar on `/checkout`. Expected: the location changes to `/cart`, one info toast says nothing is selected, and no form flashes in between.
2. On `/cart`, tick a line, click the checkout button, then delete that product from the cart in a second tab and reload `/checkout`. Expected: the same redirect and the same toast.

3. With the cart read cached from an earlier visit, stop the gateway and reload `/checkout`. Expected: a failure line with a retry and no redirect. A redirect here means the page treated a failed read as an empty selection, which is the state that sends a customer to the cart with the wrong explanation.

```
grep -rn "replace(" apps/customer/src/features/pages/Checkout
```

Expected: the redirect uses `router.replace`, so the dead address does not stay in history.

## 5. A partial handoff keeps what is left (AC-5)

**Status**: passed · one removed id leaves one row, the line `Part of your selection is no longer available` under the subtitle, and the subtotal at ₽1997.60 for the surviving row.


Manual: tick two lines on `/cart`, go to `/checkout`, remove one of them from the cart in a second tab, reload `/checkout`. Expected: one row remains, one muted line says part of the selection is no longer available, and the subtotal covers the remaining row only. Removing both rows must fall back to step 4.

```
grep -rn "reconcile" apps/customer/src/features/pages/Checkout
```

Expected: the helper has a unit test covering three cases (all found, some found, none found).

## 6. The cart remembers the ticks (AC-6)

**Status**: passed · the browser back button from `/checkout` restores both ticks and ₽3591.50. Premise correction: the screen carries no in screen back control, so that half of the step cannot be exercised, see the gaps below.


Manual: tick two lines on `/cart`, go to `/checkout`, press the in screen back button. Expected: `/cart` shows the same two lines ticked and the summary prints the same count. Repeat with the browser back button. Expected: the same.

```
grep -rn "useEffect\|useState(" apps/customer/src/features/pages/Cart/hooks/useCartSelection.ts
```

Expected: the key is read in the state initialiser or in an effect that runs once, and written on every change, with no unconditional `window` access at module scope.

## 7. Success replaces the history entry (AC-7)

**Status**: passed · the submit kept `history.length` at 5, cleared the key, reached `/orders/cmwjllkch…`, and back landed on `/cart`, which then read `Your cart is empty`.


Manual: complete an order. Expected: the order screen opens, the storage key is gone, and the browser back button lands on `/cart` rather than on a checkout form. Then check the cart reads empty of the bought lines.

```
grep -rn "router.replace\|router.push" apps/customer/src/hooks/order/useCheckout.ts
```

Expected: `router.replace` on success. A `router.push` leaves the filled form one step back.

## 8. A reload keeps the lines and resets the choices (AC-8)

**Status**: passed · after a reload the two lines stayed and the method, address and date reset while payment came back as ONLINE_CARD.


Manual: on `/checkout`, choose a method, a date and an address, then reload. Expected: the same lines are listed, and the method, the date and the address are empty again while payment is `ONLINE_CARD`.

```
grep -rn "localStorage\|sessionStorage" apps/customer/src/features/pages/Checkout
```

Expected: the only storage use in the feature is the read of the ids, so no draft can survive.

## 9. The geometry matches the mockup (AC-9, AC-10)

**Status**: passed · measured at 1280 and 390 (wrapper 1080 with 48/24/72 padding, title 28/700/-0.56px, columns 520 and 360, sticky top 96, card 14px on #27272a over #0c0c0e, header 20/24, body 24 with a 22 gap, tile 44 with radius 10, submit 44/8/15px), `scrollWidth` equalled 390 at the narrow width. The mockup `.dc.html` was not rendered beside it: the numbers were compared to the transcribed geometry table instead.


Manual at 1280 wide on `/checkout`, reading computed styles in devtools:

- wrapper: `max-width` 1080px, `padding-top` 48px, `padding-left` 24px, `padding-bottom` 72px
- page title: `font-size` 28px, `font-weight` 700, `letter-spacing` about -0.56px
- page subtitle: 15px, colour `#a1a1aa`, 6px below the title
- columns: the left column computed `flex-basis` 520px and the summary 360px, with the summary `position: sticky` and `top` 96px
- card: `border-radius` 14px, `border-color` `#27272a`, `background` `#0c0c0e`
- card header: `padding` 20px 24px, a 1px bottom border
- card body: `padding` 24px, row gap 22px
- tile: 44px by 44px, `border-radius` 10px
- submit: `height` 44px, `border-radius` 8px, `font-size` 15px

Then set the viewport to 390 wide. Expected: one column, the summary and its submit button after the form, and no horizontal scrollbar (`document.documentElement.scrollWidth` equals the viewport width).

Screenshot the built screen beside `C:/Users/ADMIN/Downloads/Оформление заказа-html/Checkout.dc.html` rendered at the same width, and name any deliberate difference from the Assumed list in the spec (checked fill `#18181b`, hover and disabled from the button variant, no product subtitle, sticky offset 96px).

## 10. Radio cards and Radix pickers (AC-11, AC-12)

**Status**: passed · radio cards flip to `border-foreground bg-secondary` (#fafafa over #18181b), no native date or select exists, the pickup `Select` opens with ArrowDown (Enter does not open it) and the chosen point prints its address in a 13px muted line. Correction: the same address also repeats inside the trigger.


Manual: on `/checkout`, the delivery method and the payment method render as bordered rows with a radio, not as dropdowns. Click one in each list. Expected: the chosen row takes the foreground border and the secondary fill, the other rows do not.

```
grep -rn "type=\"date\"\|<select" apps/customer/src/features/pages/Checkout
```

Expected: no match. The date control is a Popover trigger and the point control is a `Select` trigger, both at `h-10`.

Manual keyboard walk: tab to the pickup trigger, press Enter, arrow down, press Enter. Expected: the list opens, moves and closes with the keyboard, and the chosen point prints its address in a 13px muted line under the trigger. Tab to the date trigger and open it with Enter. Expected: the calendar opens in the theme, the past dates are disabled, and no native picker appears.

## 11. The summary and the hint (AC-13, AC-14)

**Status**: passed · hint order ran `Choose a delivery method` then `Enter a delivery address` or `Choose a pickup point` then `Choose a delivery date`, and the submit enabled only at the end. With the points read blocked the pickup card turns disabled with `No pickup point is open right now`, and with the shipping read blocked the hint names the delivery list. The grep path is `components/CheckoutHint.tsx`, a file and not a folder.


Manual on an empty form: the submit is disabled and the hint names the shipping method. Choose a method: the hint names the delivery date, or the pickup point when the chosen method is a pickup one. Choose everything: the hint disappears and the submit enables.

```
grep -rn "checkoutHint\|hintField" apps/customer/src/features/pages/Checkout
```

Expected: one `lib/` table holds the field order and its catalog keys, with a test that walks the three states.

```
grep -c "text-\[13px\]" apps/customer/src/features/pages/Checkout/components/CheckoutHint/index.tsx
```

Expected: one, and the element is centred, which the rendered screenshot shows.

Hint for a block that names no field, using the database:

```
docker exec astrum-db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "UPDATE \"ShippingMethod\" SET \"isActive\" = false;";'
```

Reload `/checkout`. Expected: the destructive line with its retry inside the receipt card, a disabled submit, and a hint naming the delivery list rather than a field. A dead submit with no hint is the state this step exists to catch. Restore the rows afterwards:

```
docker exec astrum-db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "UPDATE \"ShippingMethod\" SET \"isActive\" = true;";'
```

## 12. Every established refusal still fires (AC-15)

**Status**: passed · a method deactivated mid session answered one toast `That delivery method is no longer offered. Pick another one.` with the choice cleared and the list refilled, a USD method answered `That delivery method is priced in another currency.` with the choice kept, a PENDING account answered the failure toast with the confirmation banner on screen, and a blocked shipping read rendered `Delivery is unavailable right now.` with Retry inside the receipt card and a disabled submit.


```
docker exec astrum-db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, name, \"isActive\", \"isPickup\", price, currency FROM \"ShippingMethod\" ORDER BY name;"'
```

Switch one active method off, then submit an order with it:

```
docker exec astrum-db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "UPDATE \"ShippingMethod\" SET \"isActive\" = false WHERE name = '"'"'<name>'"'"';"'
```

Expected in the browser: one toast naming that the method is no longer offered, the method cleared, the list refilled without it, and no order row created. Switch it back on afterwards and confirm the list holds it again.

Then break the shipping read (stop the gateway, reload `/checkout`) and confirm the red line with its retry button appears inside the receipt card and the submit stays disabled.

Currency mismatch, which must not clear the choice:

```
docker exec astrum-db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "UPDATE \"ShippingMethod\" SET currency = '\''USD'\'' WHERE name = '\''<name>'\'';";'
```

Choose that method, submit. Expected: one toast naming the currency mismatch, the method still chosen, and no order row. The method must not be cleared and the list must not be refetched, because `refusalReaction` treats only the unknown and inactive codes that way. Restore the currency afterwards.

Auth check: sign in with an account whose email is unconfirmed, reach `/checkout`, submit. Expected: the failure toast fires and the global confirmation banner is on screen. There is no new client gate and no redirect.

## 13. The form is split and the suite moved with it (AC-16)

**Status**: passed · 6 cases in `CheckoutForm.test.tsx` and 3 in `PickupPointField.test.tsx`, and no file above 200 lines.


```
wc -l apps/customer/src/features/pages/Checkout/index.tsx apps/customer/src/features/pages/Checkout/components/*/index.tsx
```

Expected: no file above 200 lines, and none above 400, which is the standard's ceiling.

```
grep -rcE "^\s*(it|test)\(" apps/customer/src/features/pages/Checkout --include=*.test.tsx
```

Expected: nine cases across the moved suites, 6 from the form suite and 3 from the pickup point suite, counted on 2026-11-16 before the move. A smaller number means a case was deleted rather than updated. A plain `grep -c "it("` overcounts, because the `submit()` helper in the form suite matches too.

## 14. Copy and money (AC-17)

**Status**: passed · both catalogs carry the same 80 `cart` keys, `formatMoney` covers every amount, no currency symbol in a `.tsx`. Correction: the Cyrillic grep matches only `it(...)` titles inside the test files.


```
grep -rn "[А-Яа-я]" apps/customer/src/features/pages/Checkout --include=*.tsx
```

Expected: no match, since every printed string comes from the catalog.

```
python -c "import json;a=json.load(open('apps/customer/messages/en.json',encoding='utf-8'))['cart'];b=json.load(open('apps/customer/messages/ru.json',encoding='utf-8'))['cart'];print(sorted(set(a)^set(b)))"
```

Expected: an empty list, so both catalogs carry the same keys.

```
grep -rn "₽\|\\$\|€" apps/customer/src/features/pages/Checkout --include=*.tsx
```

Expected: no match. Every amount goes through `formatMoney`.

## 15. Gates (AC-18)

**Status**: passed · lint 0 errors (13 pre existing warnings), test 395 passed in 72 files, check-types 5 of 5 packages, build lists `ƒ /checkout`.


```
pnpm --filter @astrum/customer lint && pnpm --filter @astrum/customer test && pnpm check-types && pnpm --filter @astrum/customer build
```

Expected: all four green, with the output quoted in the report. A `test` failure naming the moved checkout suites means the import paths were not updated with the move.


## Run log · 2026-11-17

**Verdict**: PASS · the one blocking defect was fixed and re-driven by this run, see the Fix section at the end. 2 named gaps stay open.

**Fixtures**: account `check0024.1794900001@example.com` created through `POST /api/auth/register` on the auth service and set to `ACTIVE` by SQL, because the confirmation letter never reached Mailpit during this run (three earlier letters do sit there for other accounts, so the worker was alive for those). Two cart products, `3b701cac…` (3D очки Palmexx) and `2ed57cb9…` (3D ручка Funtastique). Two orders were created by this run, `cmwjlka3s0003n4vdbwyqp2f7` and `cmwjllkch0006n4vdqfs2g7rn`, and both stay in the database with the throwaway account. One cart line was left behind (3 oчки at quantity 3) and the storage key holds its id.

**Harness switches**: `Emulation.setDeviceMetricsOverride` at 1280 and at 390 for the geometry read, and `Network.setBlockedURLs` three times (the cart read, the pickup points read, the shipping methods read) to reach the failure branches without stopping the gateway. Synthetic pointer events do not select a Radix `Select` option, so the pickup point was chosen with ArrowDown then Enter.

**Session loss**: the browser answered `401 SESSION_MISSING` once, after the account was flipped to `PENDING` and back to `ACTIVE`, and a fresh sign in restored it.

### Defect found at the first run, fixed and re-driven by this run

- **The delivery date prints one day earlier than the day chosen.** Picking 25 prints `November 24, 2026`, picking 26 prints the 25th, picking 28 prints the 27th, while the order screen prints `November 25, 2026` for the same stored value, so the data is right and only the checkout print is shifted. Cause: `apps/customer/src/i18n/request.ts:15` pins next-intl to `timeZone: "UTC"`, and the calendar hands `DeliveryDateField` a local midnight (`2026-11-25T00:00+03:00`, which is `2026-11-24T21:00Z`), so `format.dateTime(field.value, { dateStyle: "long" })` renders the UTC day. The screens that already print a correct day (`CourierOrderCard`, `PointOrderCard`, `SellerOrders`) pass `timeZone: browserTimeZone()` explicitly. Route: `/debug-code checkout on its own route`.

### Gaps

- **No in screen way back to the cart.** Step 6 names an in screen back button and the screen has none (no link, no button), so only the browser back button and the navbar reach `/cart`. Recorded in the deferred list.
- **Both pickers paint a transparent surface.** The popover content carries `bg-background` yet computes `opacity: 0` with an `enter` animation that never settles, and the `Select` panel computes `rgba(0, 0, 0, 0)`, so the receipt fields show through the calendar and through the pickup list. The same primitives are shared with other screens, so this is recorded as a defect outside this spec rather than a checkout failure.

### Not observed

- The mockup rendered beside the built screen. The geometry table was measured numerically instead, so a drift the numbers do not carry (icon weight, spacing between the title block and the columns) is unproven.
- The in screen back button, for the reason above.

## Fix · 2026-11-16 · the delivery date printed one day earlier

**Cause confirmed** with a unit repro, not only by reading: `new Date(2026, 10, 25)` under `TZ=Europe/Moscow` is `2026-11-24T21:00:00.000Z`, so a formatter pinned to UTC renders `November 24, 2026`.

**Fix**: `components/fields/DeliveryDateField.tsx` now passes `timeZone: browserTimeZone()` to `format.dateTime`, the same explicit zone the four screens that already printed a correct day pass (`CourierOrderCard`, `PointOrderCard`, `SellerOrderRow`, `SellerOrderBand`). The global pin in `src/i18n/request.ts` stays, because the server cannot know the browser zone.

**Regression test**: `components/fields/__tests__/DeliveryDateField.test.tsx`, one case that renders the field with a local midnight value and asserts the printed day and the zone handed to the formatter. It failed before the fix (`November 24, 2026` against `November 25, 2026`) and passes after. Customer suite: 396 passed in 73 files, `tsc --noEmit` clean, eslint clean on the two files.

**Observed live · 2026-11-16**: a forged dev session for the throwaway account `check0024.1794900001@example.com`, then the real flow: `/cart`, tick the line, `Proceed to Checkout (1 item)`, `/checkout`, open the calendar, pick 25. The trigger printed `November 25, 2026` at 1280 and at 390, the browser zone read `Europe/Moscow`, and `document.documentElement.scrollWidth` equalled the viewport at both widths (1273 at 1280, 390 at 390, so no horizontal scroll). Screenshots: `checkout-date-1280.png` and `checkout-date-390.png` in the scratch directory. Cleanup: the Redis session key was deleted, the cart then redirected to `/auth/signin`, the token file was removed, no order was placed and no row changed.

**Still open, untouched**: no in screen way back to the cart, and the transparent picker surfaces. The calendar painted solid at both widths in this run, so that gap needs its own reproduction before it is called real.


**Re-driven by /check verify on 2026-11-17** after the fix: the real `/checkout` on the dev stack, the throwaway account, one live line at quantity 3. Picking 25 printed `November 25, 2026`, picking 26 printed the 26th, picking 28 printed the 28th, and the submit stayed disabled until a method was chosen, so the hint and the enable rule are unchanged. The customer suite now reports 399 passed in 73 files (`pnpm --filter @astrum/customer test`), the moved nine checkout cases included. The transparent picker surface still reproduces in this run: the calendar and the pickup list both paint over the receipt rows with no solid panel behind them, so the deferred item stays open.
