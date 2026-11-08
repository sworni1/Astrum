# 0007. Seller order panel

**Date**: 2026-11-08
**Status**: In Progress

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The shop has no seller screen. The gateway already answers a seller's own order lines and accepts line status changes (spec 0002), but a seller has nowhere to look and nothing to click. This decision adds one page inside the existing storefront, at `/seller/orders`, that lists the seller's lines grouped by order and moves an eligible line through the agreed status flow. No new app, no new table and no change to the order API: one profile field (`isSeller`), one access gate and a small operator script to hand a business to a user.

## Requirements

**User stories**:

- As a seller, I want one screen that shows the order lines my shop must fulfil, so that I can confirm, ship, deliver or cancel them without talking to a database.
- As a seller, I want the screen to offer only the moves my line may actually take, so that a wrong click cannot corrupt an order.
- As the shop, I want the panel to hold no authority of its own, so that every permission and every stock change still runs through the gateway rules of spec 0002.

**Acceptance criteria**:

- **AC-1**: A new page exists at `/seller/orders` inside the `(content)` route group, so it carries the storefront navbar, footer and confirmation banner. The existing session guard in `apps/customer/src/proxy.ts` protects it: a request without a valid `__auth` cookie is redirected to `/auth/signin`, and the page adds no second session check of its own.
- **AC-2**: `GET /api/users/me` answers one new boolean field `isSeller`, derived on every request from a `Business` row whose `ownerUserId` equals the authenticated `userId`. It states ownership only and is independent of the account state, so an owner whose address is still unconfirmed also reads `isSeller: true`; the account state comes from the existing `status` field of the same response. No owner id, business id or business name is exposed, the token and the session record carry no role, and every other field keeps its current shape and value. The storefront `UserData` type gains the field.
- **AC-3**: The navigation renders a `Sales` item, in the desktop navbar and inside `MobileMenuSheet`, only while `isSeller` is `true`; the item links to `/seller/orders`. The navbar reads the profile once through `useUser` and passes the flag into the sheet, so no seller endpoint is called to decide this. When `isSeller` is `false` or still unknown the item is absent. Assigning or revoking a business reaches the navigation when the profile is revalidated (page load, sign in, opening the panel), while the API enforces the change on the next request.
- **AC-4**: The page renders one group per order, in the order and line order the API returns, and inside each group one dense row per line. A group header shows the order number, the last 8 characters of the order id (the display convention the customer order list already uses, with the full id as the row title, because `Order.id` is a cuid and the shop has no human readable number), the creation date and time formatted in the browser time zone (the request config pins `timeZone: "UTC"`, so the zone is passed explicitly), and a count of the lines in that group by status. A line row shows the product thumbnail and name (both linking to `/products/{productId}` in the same tab), the quantity, the unit price, the line subtotal (unit price times quantity, rounded to two decimals for display because a float multiply returns `59.97000000000001`), a status chip and the actions that line allows. Status labels are the shared `orders.itemStatus` messages reached through one exported status to catalog key map, lifted out of the customer order screen so both read one table. The panel shows no order total, no delivery address, no payment detail, no customer identity and never a line from another business, because those values are absent from the response by spec 0002.
- **AC-5**: Pagination is server driven with a page size of 20: `Back` and `Next` controls plus a `Page N of M` label built from `page` and `totalPages`, with `Back` disabled on page 1 and `Next` on the last page. The page holds the last successful page in component state, so a page change shows a loading strip over the existing rows instead of an empty table, while the first load shows the skeleton. An answer with `orders` empty and `total` above 0 (the requested page stopped existing after cancellations) makes the panel request the last page instead of rendering `Page 3 of 2`. A response with `total` of 0 renders the empty state and no pagination controls.
- **AC-6**: Each line offers exactly the actions its status allows and nothing else: `PENDING` offers `Confirm`, `Out of stock` and `Cancel`; `CONFIRMED` offers `Ship` and `Cancel`; `SHIPPED` offers `Deliver`; `CANCELLED`, `OUT_OF_STOCK`, `DELIVERED`, `RETURNED`, `BACKORDERED` and `REPLACED` offer no action and render the status chip alone. A status value outside that list renders the raw value with no actions instead of crashing the screen.
- **AC-7**: `Cancel` and `Out of stock` open a confirmation dialog that names the product and states the effect (Cancel returns the quantity to stock; Out of stock changes no stock), and only the confirm button sends the request. Closing the dialog writes nothing and leaves the line unchanged.
- **AC-8**: `Confirm`, `Ship` and `Deliver` send their request on click without a dialog. A line whose request is in flight shows a busy state on its action and accepts no second click, so one line never has two status changes in flight at once.
- **AC-9**: A successful change replaces that line from the `PATCH` response body and then revalidates the current page, so a change somebody else made inside the same order also lands on screen and the group counts follow.
- **AC-10**: A refused change shows a toast whose text comes from the `seller` catalog keyed by the response `code`, because the server `message` is English prose and is never displayed, with `from` and `to` filled in when present: `409 INVALID_STATUS_TRANSITION`, `404 ORDER_ITEM_NOT_FOUND`, `422 VALIDATION` (whose payload also carries field errors), `403 EMAIL_NOT_CONFIRMED` and `503 SELLER_ORDER_WORKFLOW_DISABLED`, then revalidates the current page. `503 ACCOUNT_STATUS_UNAVAILABLE` shows the same toast with a retry action. A `500` or a client timeout shows the generic failure text with a retry action. A `401` keeps the existing fetcher behaviour.
- **AC-11**: The page has these states and never shows two at once: a loading skeleton; the empty state when `total` is 0; the `not a seller` screen for `403 SELLER_NOT_ASSIGNED`; the `order intake is not switched on` screen for `503 SELLER_ORDER_WORKFLOW_DISABLED`; and a failure screen with a retry action for `500`, `503 ACCOUNT_STATUS_UNAVAILABLE` and a client timeout. A `PENDING` account still reads the list, sees a notice that statuses can be changed only after the address is confirmed, and has every action disabled. A `401` keeps the existing fetcher behaviour (session ends, redirect to sign in).
- **AC-12**: Every string the page shows lives in a new `seller` namespace in both `apps/customer/messages/en.json` and `apps/customer/messages/ru.json`, with both catalogs complete and in parity, and components carry no hardcoded English or Cyrillic text. Dates go through the `next-intl` formatter, so the same page reads correctly in both languages.
- **AC-13**: `PATCH /api/order-items/:orderItemId/status` runs `requireActiveAccount` before `requireSellerOrderWorkflow` and before the controller, so a `PENDING` account receives `403 EMAIL_NOT_CONFIRMED` and writes nothing, whatever the feature flag says. The read route `GET /api/seller/orders` stays open to a `PENDING` owner, matching the rule of spec 0005 that an unconfirmed account signs in and browses and is refused on writes. The ownership rule, the transition table, the stock return and the flag semantics of spec 0002 are unchanged.
- **AC-14**: `pnpm db:assign-business <email>` (package script `assign-business` in `packages/Astrum-db`, root alias `db:assign-business`) gives one business to the user with that email inside a single transaction and prints the business id, how many products it owns and how many unassigned businesses remain. It prefers an unassigned `Business` that owns at least one product, falls back to any unassigned `Business`, and creates a new `Business` row when none is left, because no seed creates one today. It refuses with a clear message and a non zero exit when the email matches no user and when the user already owns a business. It uses the `prisma` client exported by `@astrum/db`, which falls back to `packages/Astrum-db/.env`, and it is not reachable over HTTP.
- **AC-15**: The new behaviour is covered by tests: vitest suites for the list hook (200 with pages, 403 not a seller, 503 disabled), for the status mutation (success updates and revalidates, 409 surfaces the code) and for the page states; a vitest test proving the client action map matches the transition table of spec 0002 for all nine statuses; a gateway test for `isSeller` true and false; and a gateway test proving a `PENDING` account is refused the write and served the read. `pnpm quality-gate` is green.
- **AC-16**: The panel is a dense table on the desktop breakpoint (compact row height, one visible border per group, sticky column labels) and stacks into cards below `sm` with no horizontal scrolling at 360 px. Every action is reachable by keyboard, shows the project's `focus-visible` ring, and has a target of at least 32 px in height.

## Decision

**Chosen option**: Option 1: One page inside the existing storefront.

The panel is one route in `apps/customer` at `/seller/orders`, built from the shipped seller API, with the seller identity carried by a new `isSeller` field on `GET /api/users/me`, the seller routes closed to unconfirmed accounts, and a small operator script for business assignment.

**Implementation skills**: none consulted (no community skill in this repo covers Next.js UI work; the installed `.agents/skills` entries are the workflow and Redis skills, neither of which shapes this decision).

## Feature design

**Data model sketch**:

Nothing new is persisted. The panel reads what spec 0002 stores.

| Entity      | Fields read                                                                          | Notes                                                                                           |
| ----------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `Order`     | `id`, `createdAt`                                                                    | Read through the seller list response only; lines from other businesses never leave the gateway |
| `OrderItem` | `id`, `productId`, `name`, `previewImage`, `quantity`, `price`, `currency`, `status` | Checkout snapshots, so the row survives a product rename or delete                              |
| `Business`  | `id`, `ownerUserId`                                                                  | Read by the gateway to answer `isSeller` and to scope every seller query                        |
| `User`      | `id`, `status`                                                                       | `status` gates the seller routes through `requireActiveAccount`                                 |

**State transitions**:

The panel mirrors the server table and adds nothing to it.

| Line status                                                                     | Actions on screen             | Target status                            |
| ------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------- |
| `PENDING`                                                                       | Confirm, Out of stock, Cancel | `CONFIRMED`, `OUT_OF_STOCK`, `CANCELLED` |
| `CONFIRMED`                                                                     | Ship, Cancel                  | `SHIPPED`, `CANCELLED`                   |
| `SHIPPED`                                                                       | Deliver                       | `DELIVERED`                              |
| `CANCELLED`, `OUT_OF_STOCK`, `DELIVERED`, `RETURNED`, `BACKORDERED`, `REPLACED` | none                          | none                                     |

`Cancel` and `Out of stock` ask for confirmation, `Confirm`, `Ship` and `Deliver` act at once. The panel's map is a hint for the operator; the server table remains the only authority, and a refused move is always shown. The map lives in one exported module and a test compares it with the server table, so a forgotten action fails a test instead of quietly disappearing from the queue.

**API surface**:

| Endpoint                                | Method | Key inputs                                           | Key outputs                                                                                   | Auth                                     | Key errors                                                                                                                                                          |
| --------------------------------------- | ------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/seller/orders`                    | GET    | `page`, `limit` (optional, default 1 and 20, cap 50) | `orders[]` with `id`, `createdAt`, own `orderItems[]`; `page`, `limit`, `total`, `totalPages` | Session, active account, owned business  | `403 SELLER_NOT_ASSIGNED`, `403 EMAIL_NOT_CONFIRMED`, `422 VALIDATION`, `503 SELLER_ORDER_WORKFLOW_DISABLED`                                                        |
| `/api/order-items/{orderItemId}/status` | PATCH  | `status` (one of the five targets)                   | Updated line with its `orderId`                                                               | Session, active account, owning business | `404 ORDER_ITEM_NOT_FOUND`, `409 INVALID_STATUS_TRANSITION` with `from` and `to`, `403 EMAIL_NOT_CONFIRMED`, `422 VALIDATION`, `503 SELLER_ORDER_WORKFLOW_DISABLED` |
| `/api/users/me`                         | GET    | none                                                 | existing profile fields plus `isSeller` boolean                                               | Session                                  | unchanged (`500` on a database failure)                                                                                                                             |

The two seller rows above are shipped by spec 0002; the only change this feature makes to their contract is the added account gate (AC-13). The storefront calls all three through the existing `/api-gateway` rewrite.

**Value sourcing**:

| Action                   | Value produced or displayed                                    | Source                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Navigation shows `Sales` | `isSeller`                                                     | `GET /api/users/me`, derived by the gateway from `Business.ownerUserId`                                                                                                        |
| Page lists lines         | Order groups and line rows                                     | `GET /api/seller/orders` for the current page; nothing is read from `/api/orders`                                                                                              |
| Group header             | Order number                                                   | Last 8 characters of `order.id` from the response, a display convention, with the full id as the row title                                                                     |
| Group header             | Date and time                                                  | `order.createdAt` through the `next-intl` formatter with the browser time zone passed explicitly, because `src/i18n/request.ts` pins `timeZone: "UTC"`                         |
| Group header             | Counts by status                                               | Counted in the client over the lines of that group on this page                                                                                                                |
| Line row                 | Thumbnail, name, quantity, unit price, currency, status        | The line fields of the response, which are checkout snapshots                                                                                                                  |
| Line row                 | Line subtotal                                                  | `quantity` times `price` computed in the client and rounded to two decimals for display; currency symbol from `currency` through `getCurrencyEmoji`                            |
| Line row                 | Status chip text                                               | `line.status` through the one exported status to catalog key map, shared with the customer order screen                                                                        |
| Line row                 | Product link target                                            | `line.productId` into `/products/{productId}`                                                                                                                                  |
| Line row                 | Available actions                                              | `line.status` through the panel map (a client mirror of the server table, pinned by a parity test)                                                                             |
| Line row                 | Busy state                                                     | The mutation state of that one line in the client                                                                                                                              |
| Toast                    | Refusal text                                                   | The response `code` into the `seller` catalog, with `from` and `to` when present; the server `message` is not displayed                                                        |
| Pagination               | `Page N of M`, disabled ends                                   | `page`, `limit`, `total`, `totalPages` of the response                                                                                                                         |
| Page states              | `not a seller`, `intake not switched on`, `confirm your email` | Response codes `SELLER_NOT_ASSIGNED`, `SELLER_ORDER_WORKFLOW_DISABLED`, `EMAIL_NOT_CONFIRMED`; the disabled flag is never read from a client environment variable              |
| Assignment script        | Business given to a user                                       | `User.email` from the argument; the first `Business` with an empty `ownerUserId` that owns a product, else any empty one, else a newly created row; written in one transaction |

**Key invariants**:

- The client never decides what the server accepts; it only hides actions. Every mutation goes to `PATCH /api/order-items/:id/status` and every refusal is surfaced.
- Only lines the seller list returned are rendered. The panel never merges data from the customer order endpoints.
- No order total, address, payment detail or customer identity appears on the panel.
- `isSeller` comes from the gateway on each request, never from a token claim, a cookie value or a client store.
- One line has at most one status change in flight, and the button for it is disabled until the answer lands.
- A successful change is applied from the response body before the page is revalidated, so the screen never shows a status the server did not return.
- The status change answers only for an `ACTIVE` account and an owned business, in that order; the list answers for an owned business whatever the account state.

**Security model**:

The panel introduces no new data flow. The session stays in the `__auth` HttpOnly cookie, the gateway verifies it and reads the one `session:<sid>` record, every seller query filters by `Business.ownerUserId` for the authenticated user, and a foreign or missing line answers the same `404` (spec 0002, AC-7). The screen's action map is a usability affordance, not a permission: removing it in the browser gains nothing, because the server re checks ownership, the transition table and the order row lock on every call. The new gate closes the one hole the shipped routes left, an unconfirmed account changing statuses and stock. The panel shows no personal data of the buyer, so no new regulated data enters the browser. The assignment script runs on the operator's machine with the database URL from `.env`; it is not part of any image and exposes no route.

**Configuration required**:

- `SELLER_ORDER_WORKFLOW_ENABLED`: unchanged contract from spec 0002. It must be `true` in `apps/api-astrum` for the panel to work; while it is `false` the page shows the `intake is not switched on` screen. The value lives in `.env` (dev) and `.env.prod` (compose stack); both templates already carry it with `false`.
- No new environment variable, secret or credential is introduced by the storefront.

**Critical test scenarios**:

- Happy path: a user owning a business opens the panel, sees only their own lines grouped by order, confirms a `PENDING` line, ships the `CONFIRMED` line, delivers the `SHIPPED` line, and the screen follows each answer, verifies **AC-4**, **AC-6**, **AC-8**, **AC-9**.
- Destructive path: Cancel on a `CONFIRMED` line asks for confirmation, closing the dialog writes nothing, confirming it returns the quantity to stock once and the chip changes, verifies **AC-7**, **AC-9**.
- Refusal: a change sent for a line another seller moved first answers `409` with `from` and `to`, the toast carries that code, and the page revalidates, verifies **AC-10**.
- Identity: a user without a business sees no `Sales` item and the `not a seller` screen on a direct visit; `GET /api/users/me` answers `isSeller: false` and exposes no business identifier, verifies **AC-2**, **AC-3**, **AC-11**.
- Gate: a `PENDING` account owning a business still reads the list, sees the notice, is refused with `403 EMAIL_NOT_CONFIRMED` on a status change, and no line changes, verifies **AC-13**, **AC-11**.
- Flag: with `SELLER_ORDER_WORKFLOW_ENABLED=false` the panel shows the disabled screen and no action is offered, verifies **AC-11**.
- Pagination: 25 orders, so 20 on the first page and 5 on the second, with `Back` disabled on page 1, `Next` disabled on the last page and the label reading both numbers; the server pages orders and not lines, so one order never splits across pages, verifies **AC-5**.
- Empty: a seller whose lines are all from deleted products still reads the snapshot rows; a seller with no lines at all sees the empty state, verifies **AC-4**, **AC-11**.
- Copy and layout: both catalogs complete in English and Russian, no literal copy in components, no horizontal scroll at 360 px, every action reachable by keyboard, verifies **AC-12**, **AC-16**.
- States: `500`, `503 ACCOUNT_STATUS_UNAVAILABLE` and a client timeout each render the failure screen with a retry, and a page above the last one falls back instead of showing an empty table, verifies **AC-11**, **AC-5**.
- Parity: the client action map equals the transition table of spec 0002 for all nine statuses, verifies **AC-15**.
- Provisioning: the script assigns an unassigned business that owns products, creates one when none is free, refuses an unknown email, and refuses a user who already owns a business, verifies **AC-14**.

## Build plan

Tracer Bullet: stand one thin thread from the browser through the rewrite to the live seller list first, add the identity field that the navigation needs in the same pass, then thicken with actions, refusals, copy and tests. The order API needs no schema work; the only server change is a profile field and a middleware line.

1. Gateway identity and access: add `isSeller` to `UserService.userInfo` (one read of `Business` by `ownerUserId`) with `user.service.spec.ts`, mirror the field on `UserData` in the storefront, and put `requireActiveAccount` in front of the status route only, with a test proving a `PENDING` account is refused the write and still served the read, satisfies **AC-2**, **AC-13**. — done: `isSeller` derived from the `business` relation on the profile read, `UserData.isSeller` added, `requireActiveAccount` mounted first on the PATCH only; `user.service.spec.ts` (4 tests) and `seller-order-access.spec.ts` (4 tests) green
2. Thin thread: add `src/app/(content)/seller/orders/page.tsx` and a `SellerOrders` feature folder whose `useSellerOrders(page)` hook fetches page 1 through the rewrite, rendering read only order groups and line chips, plus the `not a seller`, `intake is not switched on` and failure screens and the `PENDING` read notice with its disabled actions, satisfies **AC-1**, **AC-4**, **AC-11**. — done: page route, `SellerOrders` feature folder, `useSellerOrders` hook, the four state screens and the `PENDING` notice
3. Navigation: render the `Sales` item in the desktop navbar and the mobile sheet only when `isSeller` is true, satisfies **AC-3**. — done: `useUser` read once in the navbar, `Sales` icon item with an `aria-label` and the sheet entry behind the same flag
4. Actions: the status to action map, the buttons with their busy state, `Confirm`, `Ship` and `Deliver` acting at once, the confirmation dialog for `Cancel` and `Out of stock`, and a `useSellerOrderItemStatus` mutation that applies the returned line and revalidates the current page, satisfies **AC-6**, **AC-7**, **AC-8**, **AC-9**. — done: `actionMap.ts`, per line busy state, the dialog for the two destructive moves, `useSellerOrderItemStatus` writing the answered line through `pageWithLine` and then revalidating
5. Refusals and paging: code based toasts with revalidation, the failure screen with retry, `Back` and `Next` with the `Page N of M` label, page bounds, the fallback to the last page, and the last page held in state while the next one loads, satisfies **AC-5**, **AC-10**. — done: `refusals.ts` keyed by code with a retry only for the two retryable answers, `Back` and `Next` with the label, `keepPreviousData` loading strip, fallback effect to the last page
6. Copy and layout: the `seller` namespace in both catalogs, the dense table with sticky labels, stacked cards below `sm`, keyboard focus rings and the minimum target height, satisfies **AC-12**, **AC-16**. — done: `seller` namespace in `en.json` and `ru.json` with key parity checked, sticky column labels, grid rows that become cards below `sm`, default button size (32 px) and the shared `focus-visible` ring
7. Operator script: `scripts/assignBusiness.ts` and the `assign-business` script in `packages/Astrum-db` with the root alias, its two refusals and its output line, satisfies **AC-14**. — done: script in one transaction with `assign-business` and `db:assign-business`; assigning, an unknown address and an already owned business were run live on the dev database, the create-when-none-free branch is reviewed but not exercised
8. Tests and gates: vitest suites for the list hook, the mutation, the page states and the action map parity, then `pnpm quality-gate` across the workspace, satisfies **AC-15**. — done: five customer test files and three gateway spec files; `pnpm quality-gate` green on all 18 tasks

## Consequences

**Positive**:

- A seller can work a queue on a real screen, and every action is the shipped route with its transaction and lock, not a new path.
- The seller identity is a boolean from the current database row, so revoking a business closes the listing on the next request, while the navigation entry follows on the next profile revalidation.
- An unconfirmed account can no longer change order state or stock, closing a gap spec 0002 left in the middleware layer.
- A demo or a verification run can create a seller account in one command instead of a remembered SQL statement.

**Negative / tradeoffs**:

- The storefront bundle gains a feature most visitors never open.
- The seller surface shares a route tree with customer pages, so a later split into its own app means moving code.
- `GET /api/users/me` now reads one extra row per call.
- The panel cannot show an order level status or a total, both excluded by spec 0002, so a seller reads progress from their lines and the group counts.
- The panel does not create sellers: ownership stays an administrative data change, and the script only makes it convenient.
- The list keeps finished orders: `total` counts every order that ever held one of the seller's lines, so delivered and cancelled groups stay visible and sink only by date until a status filter exists.
- `Deliver` runs without a dialog and cannot be undone from the screen, and `Cancel` returns stock once with no way back; recovery is a database change.
- The action map is a client copy of the server table, so it can drift silently; a parity test is the guard.

**Neutral**:

- The tag is GA, so `/check verify`, `/test` and a review on another model follow the build.
- No migration is needed; nothing in the schema changes.
- The dead client hook `useUpdateOrderItemStatus` stays unused; the panel brings its own mutation hook.

## Follow-up

- [ ] Filter the seller list by line status. It needs a query parameter in `GET /api/seller/orders`, which extends spec 0002, AC-5; postponed until the queue is long enough to scroll.
- [ ] Show the order level status in the seller list. It needs `status` in the same response and the same amendment to spec 0002.
- [ ] Delete the unused `useUpdateOrderItemStatus` hook, which the panel does not adopt.
- [ ] Decide how a seller learns about a new line (mail or a badge on the `Sales` item); nothing notifies them today.
- [ ] Decide whether a seller needs buyer contact and delivery information to hand an order over; spec 0002 excludes it on purpose, and pickup handover (scope slice 3) is where the question becomes concrete.
- [ ] Batch actions over several lines of one order, once a seller asks for them.
- [ ] A seller onboarding screen, if administrative assignment becomes a bottleneck (carried from spec 0002, Follow-up).
- [ ] The Excel seed writes product `businessId` values such as `biz_excel_N` without creating the matching `Business` row, which the foreign key added by spec 0002 rejects; the seed has to create its businesses. Found while checking this spec, out of its scope.
- [ ] Add the confirmation dialog to `Deliver` too, if a wrong handover happens in practice; today only `Cancel` and `Out of stock` ask.
