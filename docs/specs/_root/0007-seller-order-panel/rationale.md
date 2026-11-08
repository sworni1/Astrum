# 0007 · Seller order panel: decision record

_This is the decision record. The build spec (summary, requirements, design, build plan) lives in [index.md](index.md); the verification steps live in [verify.md](verify.md)._

## Context

Spec 0002 made every order line remember the business that owned its product at checkout, gated the seller routes behind `SELLER_ORDER_WORKFLOW_ENABLED`, and left the screen to this feature. The gateway therefore already serves `GET /api/seller/orders` (orders with only the caller's lines, paginated) and `PATCH /api/order-items/:orderItemId/status` (five allowed transitions, stock returned once on cancellation, order status recomputed in the same transaction). The storefront has none of it: the navigation knows categories, wishlist, cart, orders and profile, and `/orders` lists the customer's own orders only.

Three gaps stand between the API and a usable panel. A signed in user cannot learn whether they are a seller, because `GET /api/users/me` returns the profile without any business information. The seller status route sits behind the session check but not behind the account status check, so an account whose address is still unconfirmed can change line statuses and return stock. And nothing in the repo can give a business to a user in a repeatable way: the Excel seed creates products with business identifiers, while every `Business.ownerUserId` stays empty, so the owner assignment is a manual SQL statement away from every demo.

The scope row also fixes the shape of the work: a seller signs in with the normal account, sees only their own lines grouped by order, uses clear actions to move eligible lines, and any request for another seller's lines is refused. The tag is GA, because a wrong click here changes stock and order state.

The cost of not deciding is a seller surface that stays on paper while the API it needs drifts.

## Options considered

### Option 1: One page inside the existing storefront

Add `/seller/orders` to `apps/customer`, reuse its session, `/api-gateway` rewrite, shadcn primitives, message catalogs and hooks layout, and read the shipped seller API as it is.

**Pros**:
- No new deployment unit, no second Next app to build, secure and keep in sync with the cookie and the rewrite.
- The session, the refusal handling in `useFetcher` and the confirmation banner already work.
- A seller and a customer see one product, one design language.

**Cons**:
- The storefront bundle grows by one feature that most visitors never open.
- A seller surface lives next to customer pages in one route tree, so a future split into a separate app would move code.

### Option 2: A separate seller application

Build `apps/seller`, its own Next app, own cookie handling, own design system wiring and own deployment.

**Pros**:
- A hard boundary between customer and seller code, free to diverge in navigation and layout.
- Seller traffic can scale and deploy on its own.

**Cons**:
- A second front end to build, test, deploy, monitor and keep on the same rewrite, session and catalog conventions.
- The shared pieces (`useFetcher`, refusal handling, messages, primitives) would be copied or extracted into a package first, so the first screen costs a refactor.

### Option 3: A seller mode inside the existing `/orders` page

Keep one page and switch its content by `isSeller`, for example with a tab.

**Pros**:
- No new route, no new navigation entry.
- The customer's order view is already there to copy from.

**Cons**:
- One page serving two different data sources and two permission models makes both harder to read and to test.
- A seller who is also a customer loses one of the two views behind a switch.

### Option 4: Server rendered panel with no client state library

Render the page as a server component that calls the gateway with the cookie forwarded, and post actions through server actions.

**Pros**:
- No client data layer, first paint carries real rows.
- Refusals are handled once on the server.

**Cons**:
- Status changes still need client feedback (busy state, toast, dialog), so a client layer arrives anyway.
- Every action would re render the route on the server, and the existing interactive patterns in this package use SWR for exactly this reason.

## Rationale

The gateway already owns every rule this screen depends on: ownership through `Business.ownerUserId`, the transition table, the stock return in one transaction, and the feature flag. A second front end would deliver no new rule, only a second copy of the session, the rewrite and the refusal handling, which is the failure this repo has already paid for once when two Prisma clients drifted. A page inside the storefront reuses the pieces that are hard to get right (cookie, `/api-gateway` rewrite, `useFetcher` refusal handling, catalogs) and keeps the seller one navigation click from the shop they sell in. The cost is bundle weight and a mixed route tree, both cheap next to a second deployment.

`isSeller` on the profile read is the smallest honest identity signal: the ownership rule of spec 0002 is "the current database row, never a role in the token", and a boolean derived from that row on each request keeps that promise while giving the navigation something to gate on. The alternative of probing `GET /api/seller/orders` from the layout would either show the entry to nobody until the first answer or spend a request per page for every signed in visitor, most of whom sell nothing. The extra query on a profile read is the cheaper trade.

The account gate is not cosmetic: `requireActiveAccount` exists precisely because an unconfirmed address must not write, and a line status change writes stock. Putting it in front of the seller status route closes a hole that spec 0002 left open because it did not touch the middleware layer, while the list stays readable for the same account, as spec 0005 requires.

Dense rows instead of cards were chosen for this screen on the owner's call. A seller works through a queue, and a card gives the same vertical space to one order that the table gives to five.
