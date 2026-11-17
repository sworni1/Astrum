# 0024. Checkout on its own route

**Date**: 2026-11-16
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

Checkout stops being a boolean inside the cart page and becomes the address `/checkout` under `(content)`. The cart hands the selected product ids over in `sessionStorage` and the route reconciles them against the live cart, so a refresh, a link and the browser back button all behave like a real page. The screen is redrawn from the reference mockup: two columns with a sticky summary, radio cards for delivery and payment, Radix pickers kept at the mockup's control geometry, and a submit button that stays disabled with a hint naming the field still missing. The 199 line form file is split on the way, because the checkout leaves the cart page as one change.

## Requirements

**User stories**:

- As a customer, I want the checkout to have an address, so that a refresh, the back button and a second tab do not throw my selection away.
- As a customer, I want to see what I am buying and what it costs on the same screen, so that I can fix a line before I pay.
- As a customer, I want the screen to tell me which field still blocks the order, so that I do not hunt for it.
- As the shop, I want the money and the stock to stay server decided, so that the browser never becomes the source of a price.

**Acceptance criteria** (the contract):

- **AC-1**: `/checkout` is a route of its own at `apps/customer/src/app/(content)/checkout/page.tsx`, rendering the page feature `apps/customer/src/features/pages/Checkout/`. The boolean is gone: `apps/customer/src/features/pages/Cart/index.tsx` holds no `showCheckout` state, does not render a checkout, and `apps/customer/src/features/pages/Cart/components/CheckoutScreen.tsx` is deleted. Session handling is unchanged: `apps/customer/src/proxy.ts` already redirects an unauthenticated request on this path to `/auth/signin`, and the screen adds no auth of its own.
- **AC-2**: `apps/customer/src/common/constants/checkout.ts` exports one storage key and its type, and `useCartSelection` is its only writer: it writes the selected product ids into `sessionStorage` under that key as a JSON array of strings, in the order the cart renders its rows, on every selection change. The write is wrapped, so a storage that refuses (private mode, a quota error) leaves the click alive and the route falls to AC-4. The summary button only navigates to `/checkout` and writes nothing, so one place owns the key.
- **AC-3**: The checkout route reads the live cart through `useGetCart` (SWR key `/cart`) and keeps only the rows whose id is in the handed array. Every value on screen comes from the live row (`name`, `previewImage`, `quantityInCart`, `price`), never from the handoff, and the rows keep the order the `/cart` answer carries, which is the array the cart page renders. That read runs no `orderBy` (`apps/api-astrum/src/modules/cart/cart.service.ts:91`), so the criterion is that the client never reorders the answer, not that the server sorts it. The subtotal is the sum of `price * quantityInCart` over the kept rows.
- **AC-4**: The route decides in three states and decides nothing before the cart answer exists. While the read is loading it renders the skeleton and redirects nothing. When the read fails it renders the failure line with its retry, never the empty verdict, because a failed read is not an empty selection. Once the answer exists and the key is absent, unreadable, empty, or none of the handed ids is in the live cart, the route replaces the location with `/cart` and raises one info toast under a catalog key of its own (`cart.nothingSelected`, not `cart.noItemsSelected`, which is a form error). No form and no summary render in that state, and no order can be started from it.
- **AC-5**: When at least one handed id is missing from the live cart and at least one row remains, the screen renders the remaining rows plus one muted line saying part of the selection is no longer available. That line is absent when every handed id was found.
- **AC-6**: `/cart` restores its checkboxes from the same key on mount and writes the key on every selection change, so a customer who returns from `/checkout` (the in screen button or the browser back button) finds the same lines ticked. The storage read is guarded so it never runs during the server render, and an id the live cart no longer holds is dropped rather than restored as a phantom tick.
- **AC-7**: A successful order removes the key inside `useCheckout`, revalidates `/cart` and `/orders` as today, and calls `router.replace` (replacing the `router.push` at `apps/customer/src/hooks/order/useCheckout.ts:74`) to `/orders/{id}`. The browser back button from the order screen therefore lands on `/cart`, not on a filled checkout form.
- **AC-8**: A reload of `/checkout` keeps the reconciled selection (the handoff key survives a reload) and resets every form choice to its default: no shipping method, no delivery date, no address, payment `ONLINE_CARD`. No form draft is persisted anywhere, and the `isPickup` branch that the schema and the delivery block read is derived from the chosen method (`methods.find(...)?.isPickup ?? false`) rather than held in its own state, so a reload can never pair a pickup method with an address field left over from an earlier choice.
- **AC-9**: The screen matches the mockup geometry at 1280 and 390 wide: a wrapper of `max-w-[1080px]` with `pt-12 px-6 pb-[72px]`, the `h1` at 28px weight 700 with `tracking-[-.02em]`, the subtitle at 15px in the muted foreground 6px below, then two columns through `flex flex-wrap items-start gap-6`: the left column `flex-1 basis-[520px] min-w-0` holding three cards in the mockup order, the right column `basis-[360px] max-w-[360px]`, and the summary sticky at `lg:top-24` (96px, because the app navbar is 64px tall and sticky, while the mockup's `top: 24px` assumes no header). At 390 wide the two columns stack and the summary with its submit button follows the form.
- **AC-10**: The three left cards match the mockup: selected items (header icon and a title carrying the line count, then one row per line with a 44px image tile, the name, a `quantityInCart` line and the line total), receipt (pickup point or courier address, shipping method, delivery date), payment. Each card is `rounded-xl border border-border bg-card`, its header `flex items-center gap-3 border-b border-border px-6 py-5` with a 20px icon and a 16px weight 600 title, its body `flex flex-col gap-[22px] p-6`. Rows between lines are separated by a 1px `border-border` rule.
- **AC-11**: Shipping method and payment are radio cards, not selects: `flex items-center gap-3 rounded-lg border border-input bg-background px-4 py-3.5`, checked state `border-foreground bg-secondary`, a 16px radio whose accent colour is the primary. A shipping card prints the method name and `formatMoney(method.price, toCurrency(method.currency))`, each card its own currency, because a mixed currency list is exactly the case the server refuses with `SHIPPING_CURRENCY_MISMATCH` and one shared currency would mislabel it. A pickup method whose points are unavailable renders disabled with its reason line inside the card, and unavailable covers a failed points read as well as an empty list, so a failed read cannot leave a clickable pickup card above a dead point control. The three payment cards print the labels from `CHECKOUT_METHOD_KEYS` and keep the form's `paymentMethod` field, with `ONLINE_CARD` as the default.
- **AC-12**: The pickup point keeps the `Select` primitive and the delivery date keeps `Popover` plus `Calendar`, both in theme tokens at the mockup's control geometry (`h-10 rounded-md border-input bg-background px-3 text-sm`, focus `ring` 2px with offset 1). No native `select` and no `input[type=date]` is introduced, although the mockup draws both. The chosen pickup point's address prints as a 13px muted line directly under the trigger, and only when a point is chosen.
- **AC-13**: The summary card always renders, whatever the shipping list is doing (today the form hides it while the list is empty), and it holds, in order: its header title, a subtotal row and a shipping row (14px, label in the muted foreground, value in the foreground), a 1px separator, the total row (label 16px weight 600, value 24px weight 700 with `tracking-[-.02em]`), the submit button, and the hint below it. The submit button is a real `type="submit"` inside the summary card while one `<form>` element wraps both columns, and it is `h-11 w-full rounded-md text-[15px] font-semibold` on the primary variant. Before a method is chosen the shipping row prints `formatMoney(0, currency)` on the same currency fallback the total uses, so the block never prints an empty cell.
- **AC-14**: The submit is disabled while the form is invalid, while the shipping list is loading, unavailable or failed, while no shipping method is chosen, and while a pickup method has no point. In those states the hint under the button names the first missing required field in form order (shipping method, then pickup point or delivery address, then delivery date), and at most one field is named. The order and the catalog keys of those fields live in one table in the feature's `lib/`, with a test. The hint is 13px, muted and centred. It is absent only while the button is enabled, so every blocked submit carries a line: the table also holds a row for a block that names no field (the shipping list loading, unavailable or failed, the points list unavailable) with its own catalog key.
- **AC-15**: Every refusal spec 0009 and spec 0013 established still behaves: an unavailable or failed shipping list keeps the destructive line with its retry button inside the receipt card and disables the submit; `409 UNKNOWN_SHIPPING_METHOD` and `SHIPPING_METHOD_INACTIVE` revalidate the list, clear the method and show one toast, while `SHIPPING_CURRENCY_MISMATCH` shows its own toast and leaves the choice untouched, which is what `refusalReaction` does today (`apps/customer/src/hooks/order/checkoutErrors.ts:48`); an unconfirmed account still answers `403 EMAIL_NOT_CONFIRMED`, surfaces as the failure toast, and is explained by the global confirmation banner. No new endpoint, no new request and no client side gate is added.
- **AC-16**: The 199 line form file is gone. The page feature composes named sections (`SelectedLines`, `ReceiptSection`, `PaymentSection`, `SummaryCard`), the submit and the refusal handling stay in one hook, and the constants, the label tables and the hint table live in `lib/` with tests. Every test case that exists today still passes: 6 cases in `CheckoutForm/__tests__/index.test.tsx` and 3 in `formFields/__tests__/PickupPointField.test.tsx`, nine in all, counted with `grep -cE "^\s*(it|test)\("` on 2026-11-16, which is the nine the scope row already counts. No case is deleted; a case whose assertion quotes a string the redraw renames is updated in the same commit.
- **AC-17**: Every string the screen prints comes from the `cart` catalog, in both `apps/customer/messages/en.json` and `apps/customer/messages/ru.json`, and both files keep the same key set. `grep -rn "formatMoney"` covers every amount on the screen, no currency symbol is written in a `.tsx` file, no Cyrillic literal sits in a `.tsx` file, and the delivery date prints through `useFormatter` with `dateStyle: "long"` as it does today.
- **AC-18**: `pnpm --filter @astrum/customer lint`, `pnpm --filter @astrum/customer test`, `pnpm check-types` and `pnpm --filter @astrum/customer build` are green, with the real output quoted in the report.

## Decision

**Chosen option**: Option 1: a real route with an ids only handoff in `sessionStorage` and a reconcile against the live cart.

The cart writes which product ids were ticked and nothing else. The route reads the live cart, keeps the rows that are still there, and computes the subtotal from the server's prices and quantities. The screen is then redrawn from the mockup as two columns with a sticky summary, the form file is split into named sections, and the pickers stay Radix at the mockup's control geometry.

**Assumed:** (a) the mockup's checked radio card fill `#121215` prints as `bg-secondary` (`#18181b`), six points off, because a token for a six point difference is noise and the checked state is already carried by the border; (b) the mockup's `#e4e4e7` button hover and `opacity .4` disabled state come from the existing primary `Button` variant (`hover:bg-primary/90`, `disabled:opacity-50`) instead of two new values; (c) the mockup's product subtitle (a size or a variant line under the name) is not printed, because the cart read selects no description field, and only the quantity line remains; (d) the summary sticks at `lg:top-24` rather than the mockup's 24px, because the application navbar is 64px tall and sticky.

**Implementation skills**: none consulted. The storefront follows `apps/customer/AGENTS.md` (S1 to S5) and `CODE_REVIEW.md`; the design source is the mockup named below.

## Feature design

**Design source**: `C:/Users/ADMIN/Downloads/Оформление заказа-html/Checkout.dc.html` (the `.dc.html` export). Its values live in two places and both were read: the class rules in `<helmet><style>` and the inline `style` attributes on the containers. The mockup holds no media query, so its columns collapse through `flex-wrap` alone.

**Palette**: the mockup uses the zinc palette spec 0023 already pinned into `apps/customer/src/app/index.css`, so no token changes. `#09090b` is `background`, `#0c0c0e` is `card`, `#27272a` is `border` and `input`, `#a1a1aa` is `muted-foreground`, `#52525b` is `ring`, `#fafafa` is `foreground` and `primary`, `#09090b` is `primary-foreground`, `#18181b` is `secondary`. Two mockup values carry no token and are handled in Assumed (a) and (b) above.

**Geometry table** (mockup value, then the utility that prints it):

| Element | Mockup | Utility |
|---|---|---|
| wrapper | max 1080px, 48px top, 24px sides, 72px bottom | `mx-auto w-full max-w-[1080px] pt-12 px-6 pb-[72px]` |
| page title | 28px, 700, tracking -.02em | `text-[28px] font-bold tracking-[-.02em]` |
| page subtitle | 15px, muted, 6px below | `mt-1.5 text-[15px] text-muted-foreground` |
| block gap | 28px between title block and columns | `flex flex-col gap-7` |
| columns | 24px gap, wrap, align start | `flex flex-wrap items-start gap-6` |
| left column | basis 520px | `flex-1 basis-[520px] min-w-0 flex flex-col gap-5` |
| summary column | basis 360px, min 300px, sticky top 24px | `basis-[360px] max-w-[360px] w-full lg:sticky lg:top-24` |
| card | 14px radius, 1px border, card fill | `rounded-xl border border-border bg-card` |
| card header | 20px / 24px padding, 1px bottom rule, 12px gap | `flex items-center gap-3 border-b border-border px-6 py-5` |
| card title | 16px, 600, tracking -.01em | `text-base font-semibold tracking-[-.01em]` |
| card body | 24px padding, 22px gap | `flex flex-col gap-[22px] p-6` |
| field | 8px gap, label 14px 500 | `flex flex-col gap-2 text-sm font-medium` |
| control | 40px, 8px radius, 1px border, page fill, 14px | `h-10 rounded-md border border-input bg-background px-3 text-sm` |
| control focus | 2px ring, 1px offset | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1` |
| radio card | 14px / 16px padding, 10px radius | `rounded-lg border border-input bg-background px-4 py-3.5` |
| tile | 44px, 10px radius, secondary fill, 1px border | `h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary` |
| hairlines | 1px border colour | `border-t border-border` |
| summary rows | 14px, space between | `flex justify-between gap-4 text-sm` |
| total row | label 16px 600, value 24px 700 | `text-base font-semibold` and `text-2xl font-bold tracking-[-.02em]` |
| submit | 44px, 8px radius, 15px 600 | `h-11 w-full rounded-md text-[15px] font-semibold` |
| hint | 13px, muted, centred | `mb-0 flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground` |

**State table**:

| State | Treatment |
|---|---|
| control focus | 2px `ring`, 1px offset, no border change |
| radio card unchecked | `border-input bg-background` |
| radio card checked | `border-foreground bg-secondary` (Assumed a), radio accent primary |
| radio card disabled | `opacity-50 cursor-not-allowed` and its reason line in the destructive colour |
| submit disabled | primary variant's `disabled:opacity-50`, cursor from the primitive |
| loading | the shipping and pickup triggers keep the loading label on the trigger itself, as spec 0009 and spec 0013 wrote them |
| refusal | destructive line plus retry inside the receipt card, one toast for a coded refusal |

**Component inventory**:

- New: `Checkout` (`index.tsx` composition), `SelectedLines`, `ReceiptSection`, `PaymentSection`, `SummaryCard`, `CheckoutHint`, and `lib/` tables (`checkout-line` helpers, the hint table, the class constants and the label maps).
- Moved from `Cart/components/CheckoutForm/components/`: the pickup point field, the courier address field, the delivery date field, and the shipping method field rebuilt as radio cards.
- Deleted: `CheckoutScreen.tsx`, `SelectedItemsSummary.tsx`, `OrderSummary.tsx`, `SubmitButton.tsx`, and the old form `index.tsx`.
- Edited in place: `useCheckout` (the `router.replace` and the key removal of AC-7) and `useCartSelection` (the persistence of AC-6).
- Kept untouched: `checkoutErrors.ts`, `idempotency.ts`, `useShippingMethods`, `usePickupPoints`, `useGetCart`.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| cart to checkout handoff | the ticked product ids | `useCartSelection` state, written to the key from `src/common/constants/checkout.ts` |
| checkout line rows | name, image, quantity, price | the live `GET /cart` answer (`cartPublicSelect`), never the handoff |
| line total | price times quantity | derived, printed by `formatMoney` |
| subtotal | sum over the kept rows | derived, printed by `formatMoney` |
| delivery price | the chosen method's price | `useShippingMethods` (`GET /api/shipping-methods`, spec 0009) |
| currency of every amount | the chosen method's currency, else the first method's, else `Currency.RUB` | the rule `CheckoutForm` already applies |
| total | subtotal plus delivery price | derived, printed by `formatMoney` |
| line count in the card title | length of the kept rows | derived |
| pickup point name and address | `PickupPoint.name`, `PickupPoint.address` | `usePickupPoints` (spec 0013) |
| payment labels | three catalog keys | `CHECKOUT_METHOD_KEYS` in `src/common/helpers/paymentMethods.ts` |
| hint field name | the first missing required field | the `lib/` hint table plus the `cart` catalog |
| delivery date on the trigger | the chosen date | form state, printed by `useFormatter` |
| order id after submit | the created order's id | the `POST /orders` answer (spec 0001, spec 0003) |

**Key invariants**:

- The handoff carries product ids only. Price, quantity and availability always come from the server read.
- The subtotal is computed on numbers and printed only through `formatMoney`. The server decides the real total at order creation.
- One storage key, exported once from `src/common/constants/checkout.ts`, written only by `useCartSelection` and read only by the checkout route.
- The storage read never runs during a server render (a `typeof window` guard), a read or a write that throws is treated as an empty key, and the route redirects on a loaded answer only.
- The checkout offers only what the server accepts, and every refusal surfaces.

**Security model**: `apps/customer/src/proxy.ts` already sends an unauthenticated request on this path to `/auth/signin`, and `apps/customer/src/app/(content)/layout.tsx` verifies the session. The cart read is scoped to the session user, and order creation sits behind `authenticateToken` and `requireActiveAccount` in the gateway. The screen adds no authorization rule and no client side gate, and an unconfirmed account keeps browsing and keeps its refusal at the order, as spec 0005 decided.

**Configuration required**: none. No new variable, no schema change, no migration.

**Critical test scenarios**:

- Happy path: tick two lines in `/cart`, press the checkout button, land on `/checkout`, choose a method, a date and a payment, submit, land on the order screen and press back to find `/cart` with the same lines gone, verifying **AC-2**, **AC-3**, **AC-7**, **AC-13**.
- Empty handoff: open `/checkout` directly with nothing in `sessionStorage`, and open it with ids whose rows are gone, both redirected to `/cart` with the toast, verifying **AC-4**.
- Partial handoff: hand over two ids, remove one row from the cart in a second tab, reload, and see one remaining row plus the unavailable line, verifying **AC-5**.
- Refresh: reload `/checkout` and find the lines kept and every form choice reset, verifying **AC-8**.
- Hint order: with nothing chosen, read the hint, choose a method, read it again, then a date, and confirm the button enables only when everything the chosen method needs is present, verifying **AC-14**.
- Refusals: with a method deactivated in the database, submit and receive one toast plus a refilled list and a cleared method, verifying **AC-15**.
- Auth: open `/checkout` without the `__auth` cookie and land on `/auth/signin`, verifying **AC-1**.

## Build plan

The project builds Tracer Bullet: a thin thread through every layer first, thickened afterwards. Here the thread is a real order placed on the new address with the old form inside it, so the route, the handoff and the reconcile are proven before a single pixel moves.

1. Add `src/common/constants/checkout.ts` (the key and its type) and the feature's `lib/` pure helpers: `reconcileLines(liveRows, ids)` and the hint table with its pick function, each with a test, satisfies **AC-3**, **AC-5**, **AC-14**. — done: `src/common/constants/checkout.ts`, `src/common/helpers/checkoutSelection.ts` (guarded read/write/clear, shared by two features so it sits in `common/`), `features/pages/Checkout/lib/reconcileLines.ts` and `lib/hints.ts`, with 5 and 7 cases in their own suites.
2. Create the route `apps/customer/src/app/(content)/checkout/page.tsx` and `src/features/pages/Checkout/index.tsx`, reading the live cart and the handed ids through the loading and failure branches before any verdict, then the redirect branch, the empty case, the partial note, and the existing form mounted inside so an order can be placed on the new address, satisfies **AC-1**, **AC-3**, **AC-4**, **AC-5**, **AC-7**. — done: `hooks/useCheckoutRoute.ts` returns loading/failed/empty/ready and redirects only on a loaded answer; live proof of the empty redirect with its `cart.nothingSelected` toast.
3. Repoint the cart: `useCartSelection` writes the key on every change and restores it on mount, and `CheckoutButton` becomes a link to `/checkout` that writes the key first, satisfies **AC-2**, **AC-6**. — done: one writer (`useCartSelection`), the button is now `<Button asChild><Link href="/checkout">` and writes nothing; the live cart wrote `["ef5a45d5…","af96278f…"]` and `/checkout` reconciled both rows.
4. Move the form into the `Checkout` feature and split it into `SelectedLines`, `ReceiptSection`, `PaymentSection` and `SummaryCard`, moving the label and class tables into `lib/`, and delete `CheckoutScreen.tsx`, satisfies **AC-16**, **AC-17**. — done: `Cart/components/CheckoutForm/` and `CheckoutScreen.tsx` deleted, 6 + 3 cases moved to the new folders and green, `grep` finds no `showCheckout`.
5. Redraw to the mockup: the wrapper and the column grid, the card shell, radio cards for shipping and payment, Radix triggers at the control geometry, the pickup address line, and the sticky summary, satisfies **AC-9**, **AC-10**, **AC-11**, **AC-12**, **AC-13**. — done: rendered at 1280 and 390 against `Checkout.dc.html`; the screenshot shows two columns, the sticky summary, the three cards and the radio cards with the checked `border-foreground bg-secondary` state.
6. Wire the submit: one `<form>` around the grid, the real submit button inside the summary card posting through `useCheckout`, and the hint reading the `lib/` table, satisfies **AC-13**, **AC-14**, **AC-8**. — done: live hint sequence "Choose a delivery method to continue" → "Enter a delivery address to continue" (courier) and "Choose a pickup point to continue" (pickup), submit disabled in each state.
7. Finish the paths: the key removal and the `router.replace` inside `useCheckout`, the shipping refusals landing in the receipt card, and the derived `isPickup` with the resets after a reload, satisfies **AC-7**, **AC-15**, **AC-8**. — done: `useCheckout` clears the key and replaces the history entry; `isPickup` is derived from the chosen method in `useCheckoutForm`, so no reset is needed after a reload.
8. Add the catalog keys to both message files, then run the gates: lint, test, check-types and build, satisfies **AC-17**, **AC-18**. — done: both catalogs carry the same 80 `cart` keys; `check-types` clean, `test` 395 passed (72 files), `lint` 0 errors, `build` includes `ƒ /checkout`.

## Consequences

**Positive**:

- The checkout has an address: it survives a refresh, it can be linked, and the back button walks back through real history.
- The customer's ticked lines come back when they return to the cart, so leaving the checkout no longer costs the whole selection.
- The 199 line form becomes five named sections, which is what scope row 6 asked for, and the tests move with the components instead of being rewritten.
- The screen finally uses the palette spec 0023 pinned, with no new hex value and no new token.

**Negative / tradeoffs**:

- The route depends on a client side storage read. A customer who opens `/checkout` in another browser, or after `sessionStorage` was cleared, is sent back to `/cart` and has to tick the lines again. This is the accepted cost of not inventing a server side cart selection in this feature.
- The cart page gains an effect that writes on every selection change, which is one more place to keep in step with the ticked state.
- The mockup's product subtitle is dropped, so the rows read thinner than the drawing until the cart read carries a description.
- The mockup's native date and point controls are replaced by Radix triggers at the same geometry, so the two controls differ from the drawing in behaviour and not only in colour.

**Neutral**:

- `CheckoutScreen.tsx` and the `showCheckout` boolean disappear, and the form suite moves to the new folder.
- `useCreateOrder` stays unused, as spec 0003 already recorded.
- No server change, no migration and no configuration change, so a rollback is a revert of one storefront commit.

## Follow-up

- [ ] Cart currency. The `/cart` read selects no currency (`cartPublicSelect` in `apps/api-astrum/src/common/prisma-selects/product.select.ts`), so the checkout keeps taking it from the shipping method with a ruble fallback, and the deferred item in `docs/scope/_root/scope.md` stays open. This spec does not fix it.
- [ ] Line subtitle. The mockup prints a size or variant line under the product name, and `/cart` selects no description. Adding it needs the gateway select widened plus the client type, in its own change.
- [ ] Out of stock on a selected line. `ProductCartProps` declares `isOutOfStock` but `cartPublicSelect` never sends it, so the checkout prints no stock badge and relies on the server refusing an over stock order.
- [ ] `useCreateOrder` is still unused and still sends no idempotency key (spec 0003 follow-up).
- [ ] Scope row 6 (checkout form decomposition) is absorbed by this feature and closes against the same change, as the slice 3 note in `docs/scope/customer/scope.md` says.

## Rationale

The reasoning, the options weighed and the tradeoffs: see [rationale.md](rationale.md).
