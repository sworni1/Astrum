# 2026-11-08 · Seller order panel

Spec: [0007-seller-order-panel](../specs/_root/0007-seller-order-panel/index.md).

## Added

- `apps/customer/src/app/(content)/seller/orders/page.tsx`, the `/seller/orders` route inside the content
  group, so the page arrives with the storefront navbar, the footer and the confirmation banner, and the
  session guard in `src/proxy.ts` protects it. The page adds no second session check of its own.
- `apps/customer/src/features/pages/SellerOrders/index.tsx`, the panel: a skeleton on the first load, one
  block per order, a thin loading strip over the rows while another page is fetched, `Back` and `Next` with
  a `Page N of M` label read from the answer, and a fallback to the last page when the requested page
  stopped existing. The five screens (`not a seller`, `intake not switched on`, empty, failure with a
  retry, and the notice for an unconfirmed account) never show two at once.
- `apps/customer/src/features/pages/SellerOrders/SellerOrderGroup/index.tsx`, the order header: the number
  as the last eight characters of the id with the full id as the title, the creation date and time in the
  browser zone (the request config pins `UTC`), and one count badge per status present in that group.
- `apps/customer/src/features/pages/SellerOrders/SellerOrderLine/index.tsx`, the dense line row: thumbnail
  and name both linking to `/products/{productId}`, quantity, unit price, the subtotal rounded to two
  decimals, and the status chip. A thumbnail from an external host goes past the optimizer
  (`unoptimized`), because `placehold.co` answers SVG and the optimizer rejects that answer; the
  placeholder sits on 4147 of 4747 catalogue products.
- `apps/customer/src/features/pages/SellerOrders/SellerOrderLine/LineActions.tsx`, the buttons a status
  allows, one change in flight per line with a spinner and no second click, and the dialog that guards
  `Cancel` and `Out of stock`. The other three actions send at once.
- `apps/customer/src/features/pages/SellerOrders/actionMap.ts`, the client mirror of the transition table
  of spec 0002 with the target status per action and the two confirming actions; `format.ts` (browser
  zone, rounded subtotal, counts by status), `pageData.ts` (`pageWithLine`), `refusals.ts` (a refusal
  turned into a toast by its `code`, with a retry only for the two retryable answers), `grid.ts` (one grid
  class shared by the sticky labels and every row, with a fixed action track) and `StateScreen.tsx`.
- `apps/customer/src/hooks/seller/`: `useSellerOrders` (page size 20, `keepPreviousData`, no retry on
  error), `useSellerOrderItemStatus` (one status change for one line, handing the answered line back
  before the page is revalidated) and `sellerError` (`sellerErrorCode`, `sellerRefusalBody`,
  `sellerErrorKind`), exported through `apps/customer/src/hooks/index.ts`.
- `apps/customer/src/common/helpers/itemStatus.ts`, one status to catalog key table for the
  `orders.itemStatus` messages, so the customer order screen and the panel read one label table.
- `GET /api/users/me` answers `isSeller`: `UserService.userInfo` reads `business: { select: { id: true } }`
  and returns `isSeller: business !== null` after dropping the relation, so the answer carries no business
  id, no owner id and no business name. `UserData` in the storefront gains the field.
- `requireActiveAccount` in front of `PATCH /api/order-items/:orderItemId/status`, before
  `requireSellerOrderWorkflow` and the controller, so an unconfirmed account is refused with
  `403 EMAIL_NOT_CONFIRMED` and writes nothing. The read route stays open to the same account.
- `packages/Astrum-db/scripts/assignBusiness.ts` with the `assign-business` script in that package and the
  root alias `db:assign-business`: it hands one business to the user with the given address inside one
  transaction, printing the business id, its product count and the unassigned businesses left, and it
  refuses an unknown address and an address that already owns a business with a non zero exit.
- The `Sales` entry: `NavItem` gains a `label` that becomes `aria-label` and `title`, and both the desktop
  item and the entry inside `MobileMenuSheet` render only while `isSeller` is true. The navbar reads the
  profile once through `useUser`, so no seller endpoint is called to decide this.
- A `nav.sales` label and a whole `seller` namespace in `apps/customer/messages/en.json` and
  `apps/customer/messages/ru.json`: title, subtitle, count with the Russian plural form, column labels,
  five actions, both dialogs, pagination, the five screens and seven refusal toasts.
- Tests: `apps/customer/src/features/pages/SellerOrders/` (`index.test.tsx` 12, `refusals.test.ts` 6,
  `actionMap.test.ts` 4, `format.test.ts` 4, `messages.test.ts` 4, `pageData.test.ts` 4),
  `apps/customer/src/hooks/seller/` (`useSellerOrders.test.tsx` 4, `useSellerOrderItemStatus.test.tsx` 2),
  `apps/customer/src/common/helpers/itemStatus.test.ts` (2),
  `apps/customer/src/features/layout/Navbar/index.test.tsx` (5),
  `apps/api-astrum/src/modules/order/seller-order-access.spec.ts` (4),
  `apps/api-astrum/src/modules/order/seller-order.transitions.spec.ts` (1, the client map against the
  server table for all nine statuses) and `apps/api-astrum/src/modules/user/user.service.spec.ts` (4).

## Changed

- `apps/api-astrum/src/modules/order/seller-order.service.ts` exports `ALLOWED_LINE_TRANSITIONS`, so the
  parity test reads the server table instead of repeating it.
- `apps/customer/src/features/pages/Orders/OrderPage/index.tsx` drops its private `ITEM_STATUS_KEYS` table
  and reads `itemStatusKey` from the shared helper.
- `apps/customer/src/common/types/order.types.ts` gains `SellerOrderLine`, `SellerOrderGroup` and
  `SellerOrdersPage`; `user.types.ts` gains `UserData.isSeller`.
- `package.json` and `packages/Astrum-db/package.json` carry the new script alias.
- `docs/scope/_root/scope.md` moves slice 5 from `planned` to `in-progress` with the design, build, verify,
  test and review boxes ticked, and `docs/scope/index.md` rollup follows.

## Removed

- The duplicated status to catalog key table inside the customer order page, now one helper module.

## Verified

- `pnpm quality-gate` on 2026-11-08: 18 of 18 tasks green. Customer 70 tests in 15 files, api 107 passed
  and 10 skipped, auth 44, worker replayed from the turbo cache. Lint reports 8 warnings and no error.
- All 23 steps of [verify.md](../specs/_root/0007-seller-order-panel/verify.md) are closed against the live
  storefront and gateway on 2026-11-08. Among them: 25 orders split into 20 and 5 with `Page 1 of 2` and
  `Page 2 of 2`; a page change at 1500 ms latency on 21 orders kept all 20 rows under the strip and the
  label moved only after the answer landed (that clause failed first, the fix has a reproduction test);
  `Cancel` returned the quantity to stock once (`Product.quantity` 6 to 7) and the dialog closed without
  writing left the line alone; a line moved by the same seller through the api answered `409` and the toast
  named `CANCELLED` to `CONFIRMED`, then the group rendered `Cancelled: 1`; a second gateway on `:3591`
  with the flag off answered `503` and the screen read `Order intake is not switched on`; an unconfirmed
  owner got `403 EMAIL_NOT_CONFIRMED` on the `PATCH` while the same cookie's `GET` answered `200`; a 360 px
  viewport measured `scrollWidth` equal to `innerWidth`, and the Russian screen read `Продажи`, `Страница 1
  из 1` with the dates following the locale.
- The assignment script was run live for the assigning case, the unknown address and the already owned
  business, each with the expected output and exit code.

## Open

- The seller list has no status filter and no order level status. Both need a parameter and a field in
  `GET /api/seller/orders`, which extends spec 0002, so finished groups stay visible and sink only by date
  until then.
- Nothing tells a seller about a new line: no mail and no badge on the `Sales` item.
- `Deliver` acts without a dialog, and `Cancel` cannot be undone from the screen because it returns stock
  once. Recovery stays a database change.
- The `create a business when none is free` branch of the assignment script is reviewed but not exercised
  live. `seedFromExcel.ts` still writes product `businessId` values such as `biz_excel_N` without the
  matching `Business` row, and the unused `useUpdateOrderItemStatus` hook stays in place. Both are named in
  the spec's Follow up.
- The page fallback keeps one lint warning (`react-hooks/set-state-in-effect` in `index.tsx`): the last
  page can only be requested by writing state when the answer says the current page is gone.
