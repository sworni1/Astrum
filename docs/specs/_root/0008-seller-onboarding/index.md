# 0008. Seller onboarding from the storefront

**Date**: 2026-11-09
**Status**: Accepted

## Summary

Today a user becomes a seller only when an engineer runs a database script. This decision adds one page where a signed in user with a confirmed address opens a shop by naming it and pressing one button. The gateway creates exactly one shop for that account, and the storefront shows the seller area at once. A second press creates nothing and renames nothing.

## Requirements

**User stories**:

- As a signed in user, I want to open my own shop from the storefront so that I can start selling without asking an engineer.
- As a new seller, I want the seller area to appear right after I open the shop so that I can continue in the same session.
- As the shop, I want one shop per account and no shop for an unconfirmed address so that ownership and the account rule stay unambiguous.

**Acceptance criteria**:

- **AC-1**: A new page exists at `/seller/onboarding` inside the `(content)` route group, so it carries the storefront navbar, footer and confirmation banner. The existing session guard in `apps/customer/src/proxy.ts` protects it: a request without a valid `__auth` cookie is redirected to `/auth/signin`, and the page adds no second session check of its own.
- **AC-2**: The profile page renders a `Sell on Astrum` section after `EditProfileForm` and before `ChangePasswordForm`, only while `profileData.isSeller` is `false`. The section explains the step in one sentence and links to `/seller/onboarding`. It is absent when `isSeller` is `true`, and nothing is rendered while the profile is loading or failed, so no placeholder flashes.
- **AC-3**: The onboarding page has these states and never shows two at once: a loading skeleton while the profile loads; a failure screen with a retry that revalidates the profile; the form when the account does not sell and is `ACTIVE`; the same form with the submit button disabled and a notice that the address must be confirmed when the account is `PENDING`; a state screen that the account already sells, with a link to `/seller/orders`, when `isSeller` is `true`; and a success card with the stored shop name and a link to `/seller/orders` after a successful call. The success card wins over the already sells state for the rest of that page visit. The already sells state wins over the `PENDING` notice, because the account status only affects the form for an account that does not sell.
- **AC-4**: The form has one required field, `name`, with a visible label, a hint of the rule, and a client schema that applies the same normalization and length rule as AC-6 (NFC, trim, collapse whitespace, reject `Cc` and `Cf`, count code points). A test table runs the same cases through the client schema and the server DTO, so the two cannot drift. An invalid value shows inline error text under the field and sends nothing. The submit button shows a busy state and accepts no second click while the request is in flight. The input and the button are reachable by keyboard, carry the project `focus-visible` ring, and the button is at least 32 px high.
- **AC-5**: `POST /api/seller/onboarding` with `{ name }` creates exactly one `Business` row for the authenticated user: `id` is `biz_` plus a UUID, `name` is the normalized name, `ownerUserId` is the account id, and `createdAt` takes its default. It answers `200 { isSeller: true, businessName }`, where `businessName` is the stored value. The route mounts `requireActiveAccount` before the DTO validation and before the controller.
- **AC-6**: The server normalizes the name before it writes: it applies Unicode NFC, trims the value, collapses every run of whitespace to one space, and rejects control characters (`Cc`), invisible format characters (`Cf`, which include the right to left override and the zero width joiner), and any result shorter than 2 or longer than 60 Unicode code points with `422 VALIDATION` and a field error for `name`. The response returns exactly the stored value. Names are not unique, and no reserved name or moderation rule applies in this feature.
- **AC-7**: A repeated call with a valid body from an account that already owns a shop answers `200` with the existing shop and its stored name, creates no second row, and does not rename the shop, whatever name the request carries. Two concurrent calls settle the same way: the insert is a single statement, not wrapped in a transaction, so a unique violation on `Business.ownerUserId` leaves the connection usable; the losing call answers from a fresh read of the winner row.
- **AC-8**: An account in `PENDING` is refused `403 EMAIL_NOT_CONFIRMED` and creates no row, whatever the body carries. The route answers `503 ACCOUNT_STATUS_UNAVAILABLE` when the account status cannot be read, and `500` on any other database failure. A `401` keeps the existing fetcher behaviour.
- **AC-9**: After a successful call the page awaits `mutateProfile()` from `useUser`, so the navbar `Sales` item appears without a reload, then shows the success card with the stored shop name and a success toast. The success state renders only when the response carries `isSeller: true`, and the full profile comes from the revalidation. The profile section and the page both stop offering the action once the profile reads `isSeller: true`.
- **AC-10**: A refusal shows text from the `seller` catalog keyed by the response `code`, never the server `message`: `422 VALIDATION` shows the catalog text for `name` under the field, `403 EMAIL_NOT_CONFIRMED` shows the confirmation text in a toast and revalidates the profile so the form switches to the `PENDING` state, and `503 ACCOUNT_STATUS_UNAVAILABLE`, `500` and a client timeout show the generic failure with a retry action. No refusal creates a row.
- **AC-11**: Every string the page and the profile section show lives in the `seller` namespace in both `apps/customer/messages/en.json` and `apps/customer/messages/ru.json`, both catalogs complete and in parity, and no component carries hardcoded English or Cyrillic text. The existing `messages.test.ts` covers the new keys.
- **AC-12**: The `not a seller` state of the seller panel (`403 SELLER_NOT_ASSIGNED`) gains an action that links to `/seller/onboarding`. The `intake is not switched on` copy no longer tells the seller to ask an operator, in both catalogs. The profile entry depends on no flag, and the `503` gate with its disabled screen was removed on 2026-11-13. Every other panel state keeps its current content and behaviour.
- **AC-13**: `Business.name` is a required `String` in the shared Prisma schema and in the `apps/api-astrum` copy, which is byte identical to it. `apps/auth-astrum` and `apps/worker` are trimmed subsets that carry no `Business` model, so neither is touched and neither generated client changes. The migration adds the column as nullable, backfills `Shop ` plus the last 6 characters of `id` for every existing row, then sets `NOT NULL`. Every `business.create` and `business.createMany` in code, scripts and tests sets a name, and `pnpm prisma:generate` rebuilds the shared client and the gateway client.
- **AC-14**: The new behaviour is covered by tests: a gateway service spec for creation, normalization, the idempotent repeat, the unique index race and the no rename rule; a gateway route spec proving the account gate runs before the controller and a `PENDING` account is refused with no create; a vitest suite for the onboarding hook (success, `422`, `403`, network failure); a page states test (form, `PENDING` disabled, already sells, success card precedence, retry), a profile section test for the entry and its absence for a seller, a panel state test for the new action, and the `seller` catalog parity test. The order integration specs and the assignment script keep passing with the required column. `pnpm quality-gate` is green.
- **AC-15**: The page uses the storefront content container at the width of the profile page, one column, and stacks without horizontal scrolling at 360 px. The profile section matches the spacing and typography of the existing profile forms. Every control is reachable by keyboard and uses the shared `focus-visible` ring. After a successful submit, focus moves to the success card heading and the card is announced as a status message.

## Decision

**Chosen option**: Option 2: Create a new shop with a required name on a dedicated page.

The storefront gets `/seller/onboarding` with one name field and one button, and the gateway gets `POST /api/seller/onboarding`, which always creates a fresh `Business` row for the authenticated, confirmed account and answers idempotently on a repeat.

**Implementation skills**: none consulted (the installed `.agents/skills` entries are the workflow skills and the Redis skills, neither of which shapes this decision).

## Feature design

**Data model sketch**:

| Entity | Key | Fields | Change |
| --- | --- | --- | --- |
| `Business` | `id` primary key, `biz_<uuid>` | `name` required, `ownerUserId` unique and nullable, `createdAt` | new `name` column |
| `User` | `id` primary key | `email`, `status` | none |
| `Product` | `businessId` foreign key | existing fields | none |
| `OrderItem` | `businessId` foreign key | existing fields | none |

Relationships: one `User` to zero or one `Business` through the unique `ownerUserId`; one `Business` to many `Product`; one `Business` to many `OrderItem`.

The migration adds `name` as nullable, backfills `Shop ` plus the last 6 characters of `id`, then sets the column `NOT NULL`. The shared schema and the `apps/api-astrum` copy, which is byte identical, change together; `apps/auth-astrum` and `apps/worker` carry trimmed subsets with no `Business` model, so neither file changes.

**State transitions**:

None. A `Business` row is created once by this feature, and the feature never changes its owner or its name. The page states are listed in AC-3.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
| --- | --- | --- | --- | --- | --- |
| `/api/seller/onboarding` | POST | `name`: string, required | `isSeller: true`, `businessName`: string | Session cookie, `ACTIVE` account | `422 VALIDATION`, `403 EMAIL_NOT_CONFIRMED`, `503 ACCOUNT_STATUS_UNAVAILABLE`, `500`, `401` from the fetcher |

The new router is added to the existing `app.use("/api", authenticateToken, sellerOrderRoutes)` line, so one request passes one `authenticateToken`; the route path on that mount is `/seller/onboarding`. Inside the router the order is `requireActiveAccount`, then `validateDto(CreateOnboardingDto, { status: 422, code: "VALIDATION" })`, then the controller.

**Value sourcing**:

| Action | Value produced or displayed | Source |
| --- | --- | --- |
| Create the shop | Shop id | The gateway, `biz_` plus `randomUUID()` |
| Create the shop | Stored name | The request `name`, normalized by the DTO transform |
| Success card | Shop name | The `businessName` field of the `POST` response |
| Navbar `Sales` item | Visibility | `useUser().profileData.isSeller`, revalidated by `mutateProfile()` |
| Profile section | Visibility | `useUser().profileData.isSeller` |
| PENDING notice | Visibility | `useUser().profileData.status` |
| Success toast and card | Visibility | Local `created` state set from the response |
| Refusal copy | Text | The response `code` into the `seller` catalog |
| Panel entry | Link target | Static `/seller/orders` |
| Onboarding entry from the panel | Link target | Static `/seller/onboarding` |
| Backfill name | Seed value | `Shop ` plus the last 6 characters of `Business.id` |

**Key invariants**:

- One account owns at most one `Business`, enforced by the unique index on `ownerUserId`.
- Onboarding always creates a new row. It never claims, reassigns or renames an existing row.
- A repeat with a valid body returns the existing shop and leaves its name untouched.
- The stored name is the normalized value, and the response returns exactly that value.
- A `PENDING` account creates nothing.
- `/api/users/me` still exposes no business id and no business name; the name is returned only by the onboarding response.
- The success card wins over the already sells state until the page is left, so the result of the action is not replaced by the state it produced.
- The buyer facing pages never show a shop name in this feature.
- Deleting a seller account leaves the `Business` row unowned through the `SetNull` rule; onboarding never claims it, so only the operator script can reassign it.
- A successful creation writes one structured `seller.onboarding.completed` log line with the account id and the new business id; a repeat writes none.

**Security model**:

The session stays in the `__auth` HttpOnly cookie. The gateway verifies it, reads the one `session:<sid>` record, and passes the account id to the handler. `requireActiveAccount` reads `User.status` by primary key on every call and refuses a `PENDING` account before any body is validated. The handler writes only the row whose `ownerUserId` is the authenticated id, so there is no path to write another account's shop. The response carries the caller's own shop name and no business id. The name is user content and is rendered as text, so React escapes it on every surface that later shows it. No payment, health or regulated personal data enters the feature, so no compliance scope applies. No rate limit is added in this feature: every call requires a live session, a repeat is one indexed read that creates nothing, and the account level controls (the registration and confirmation limits) remain the bound on how many accounts can ask.

**Configuration required**:

None. The seller order routes carry no workflow flag since 2026-11-13 (see spec 0007), so a newly created seller lands straight in the panel.

**Critical test scenarios**:

- Happy path: a signed in `ACTIVE` user opens `/seller/onboarding`, enters a name, presses the button, the row is created, the profile revalidates, the `Sales` item appears and the success card shows the stored name, verifies **AC-5**, **AC-9**.
- Repeat: the same account calls the endpoint again with another name, gets `200`, the original name, one row and no rename, verifies **AC-7**.
- Race: two concurrent calls from the same account, one wins the unique index, the loser answers from a fresh read after the failed insert, one row exists, verifies **AC-7**.
- Normalization: `"  My   Shop  "` stores `My Shop`; a decomposed accent is stored in NFC; one character, 61 code points, a control character and a right to left override answer `422` with a `name` field error, verifies **AC-6**.
- Auth and state: a `PENDING` account is refused `403 EMAIL_NOT_CONFIRMED` with no row; a `401` ends the session through the fetcher; a `503 ACCOUNT_STATUS_UNAVAILABLE` and a `500` show the failure toast with retry, verifies **AC-8**, **AC-10**.
- Entry points: a non seller sees the profile section and, with the order workflow flag on, the panel action; a seller sees neither, and a direct visit to the page shows the already sells state, verifies **AC-2**, **AC-3**, **AC-12**.
- States: an account that already sells and is `PENDING` (an email change just happened) sees the already sells state, not the form, and the panel read still answers, verifies **AC-3**.
- Copy and layout: both catalogs in parity, no literal copy in components, no horizontal scroll at 360 px, every control reachable by keyboard, and the success card takes focus and is announced, verifies **AC-11**, **AC-15**.
- Schema: the migration backfills every existing row with a name, the shared schema and the gateway copy match while the auth and worker subsets stay untouched, the script and the integration fixtures create businesses with names, verifies **AC-13**.

## Build plan

Tracer Bullet: make the database column and one end to end thread first (a real `POST` from the page), then add the entry points, the remaining states and the tests. The migration is small but changes the shared schema and the gateway copy, so it lands first and unblocks the gateway and the fixtures.

1. Schema, migration and consumers: add `Business.name` to the shared schema and the gateway copy (`apps/api-astrum`, byte identical), write the three step migration (nullable column, `Shop ` plus the last 6 characters of `id`, then `NOT NULL`), leave the trimmed auth and worker schemas alone, give the assignment script's create branch a name, update the order integration fixtures, run `pnpm prisma:generate` so the shared client and the gateway client are rebuilt, satisfies **AC-13**. — done: both schema copies identical, migration `20261109120000_business_name_required` applied to the live database (column `NOT NULL`, no nameless row), all four clients regenerated, the script and the four fixtures set a name.
2. Gateway endpoint: new `src/modules/seller/` with the route, controller, service and `CreateOnboardingDto` whose transform normalizes the name; add the new router to the existing `app.use("/api", authenticateToken, sellerOrderRoutes)` line next to `sellerOrderRoutes`, so one request passes one `authenticateToken`; mount `requireActiveAccount` first and `validateDto` second; log one `seller.onboarding.completed` line on creation; write the service spec (create, normalization, repeat, race, no rename) and the route spec (gate order, `PENDING` refused), satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**. — done: `apps/api-astrum/src/modules/seller/` with the shared decorator free `shop-name` rule, 17 specs green, the gate order proved by a `PENDING` call with an invalid body answering 403.
3. Storefront page and hook: `useBecomeSeller` over `postItem`, the `SellerOnboarding` page with the form, the client schema, the success card, the already sells state, the `PENDING` notice and the failure retry; `mutateProfile()` on success; the `seller` catalog keys in both languages, satisfies **AC-1**, **AC-3**, **AC-4**, **AC-9**, **AC-10**, **AC-11**. — done: page, hook and zod schema built, one shared name table runs through the client schema and the gateway rule, 64 storefront tests green.
4. Entry points: the `Sell on Astrum` section on the profile and the action on the panel's not a seller state, satisfies **AC-2**, **AC-12**. — done: the profile section renders only for a confirmed non seller, the panel links to onboarding, both catalogs updated and the disabled copy no longer names an operator.
5. Layout and accessibility pass: the profile width container, one column, the 360 px stack, the shared focus ring, the 32 px target and the keyboard walk, satisfies **AC-15**. — done: profile width container, one column, shared focus ring and a 32 px button are in, and a successful call moves focus to the success heading inside a `role="status"` card; the live 360 px and keyboard walk stays a `/check verify` step.
6. Tests and gate: the hook suite, the page states suite, the catalog parity run and `pnpm quality-gate` across the workspace; close the build only after the live stack shows the row, the flip and the panel, satisfies **AC-14**. — done: hook, page states, profile section and panel suites green, `pnpm quality-gate` 18 of 18 tasks green, the order and seller order integration specs pass with `ORDER_DB_TESTS=1`; the live row and flip belong to `/check verify`.

## Consequences

**Positive**:

- A user opens a shop without an engineer, a script or database access.
- One shop per account is a unique index, not a convention.
- The shop has a real name from the first minute, so a later shop page has data to show.
- The endpoint is idempotent, so a double click or a retry cannot create a second shop.

**Negative / tradeoffs**:

- The seller panel stays empty after onboarding until the seller facing product screen ships. The feature delivers the door, not the stock.
- The name is stored but shown only on the success card; no later screen reads it yet, and no reserved name, impersonation or moderation rule applies until the shop profile spec.
- The required column forces synthetic names on every seeded shop (`Shop <suffix>`).
- The assignment script and onboarding now do different things: the script reuses a seeded shop, onboarding always creates a new one, so the demo path and the product path diverge.
- No screen lets a seller rename the shop or leave seller status.

**Neutral**:

- The tag is GA, so `/check verify`, `/test` and a review on another model follow the build.
- One migration is required; the shared schema and the gateway copy change together, and the migration runs before the new gateway. No request path creates a `Business` today, so the `NOT NULL` step cannot meet a nameless row written by old code; the assignment script is updated in the same change.
- The seller order routes carry no workflow flag since 2026-11-13.
- No new environment variable, secret or dependency is introduced.

## Follow-up

- [ ] The seller facing product screen (create, edit, publish); the gateway route and DTO exist, the storefront surface does not. This is the next spec if a seller must complete a cycle in one session.
- [ ] A shop profile screen and name editing; it needs a read endpoint and amends the privacy rule of spec 0007, AC-2.
- [ ] Leaving seller status or closing a shop, with the effect on products, order lines and the unique `ownerUserId`.
- [ ] Show the shop name in the seller panel once a shop read exists.
- [ ] Document the assignment script as a demo and operator tool, now that self service exists.
- [ ] The Excel seed still writes product `businessId` values without matching `Business` rows, carried from spec 0007; the required `name` does not change that defect.
- [ ] The shop profile spec must settle the name policy before a name is public: reserved names, impersonation, moderation, and editing.
- [ ] `POST /api/products` runs behind `authenticateToken` only, with no `requireActiveAccount` and no workflow flag; decide whether the account gate belongs there.
- [ ] `packages/Astrum-db/AGENTS.md` and `apps/worker/AGENTS.md` say the api, auth and worker schemas must stay byte identical; auth and worker are trimmed subsets with no `Business` model. `/sync` should correct both statements.
- [ ] Decide what happens to a shop when its owner deletes the account; today `Business.ownerUserId` becomes null and the operator script can reassign the shop and its products.
