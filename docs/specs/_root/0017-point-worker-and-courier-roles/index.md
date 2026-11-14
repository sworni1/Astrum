# 0017. Point worker and courier roles

**Date**: 2026-11-14
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md)._

## Summary

A parcel has one hand today, the seller's, and no account can stand at a collection point or deliver a parcel. This decision gives an account two possible jobs: staff of one collection point, or courier. A confirmed, signed in person takes the job from a page in the storefront, in one deliberate action, and the profile and the navigation show it at once. The gateway gains two role tables, two role guards, and two reads that the handover features will build on.

## Requirements

**User stories**:

- As a signed in person, I want to become staff of my collection point so that I can hand parcels over without an engineer touching the database.
- As a signed in person, I want to become a courier so that I can deliver parcels without naming a point.
- As a worker, I want to move to another point later so that a new workplace does not need a new account.
- As the shop, I want one row per account per role and a point that really exists so that a handover can never be attributed to nobody.

**Acceptance criteria**:

- **AC-1**: Three new pages exist inside the `(content)` route group, so each carries the storefront navbar, footer and confirmation banner: `/staff/onboarding`, `/point` and `/courier`. The existing session guard in `apps/customer/src/proxy.ts` protects all three through its `matcher`, and none of them adds a second session check of its own.
- **AC-2**: The profile page renders a `Work on Astrum` section after `SellOnAstrum` and before `ChangePasswordForm`. For an account that holds no role it explains the step in one sentence and links to `/staff/onboarding`. For an account that holds a role it names the roles held from `staffRoles` alone, links to `/point` and `/courier` for the roles held and, when `POINT_WORKER` is held, reads `GET /api/staff/point` and only then prints the point name and the point change control of AC-8: while that read is in flight the line shows a loading text, and a failed read shows a retry line, never a claim that the account works nowhere. Nothing renders while the profile is loading or failed, so no placeholder flashes. The change control is disabled with the confirmation notice while `profileData.status` is `PENDING`, because the write it sends would be refused.
- **AC-3**: `/staff/onboarding` offers the actions for the roles the account does not hold yet, and shows a confirmation line with a link to the matching page for each role it already holds. The point action is a select of the active points plus its submit button; the courier action is a single button. A submit with no point chosen sends nothing and shows inline error text under the select, and a `422 VALIDATION` answer shows that same text keyed on the `pickupPointId` property the gateway returns. Both buttons show a busy label and accept no second click while their request is in flight. Both actions are disabled, with a notice that the address must be confirmed, while `profileData.status` is `PENDING`. A loading skeleton shows while the profile loads and a failure screen with Retry shows when the profile read fails. An empty active point list disables the point action and says that no point is open right now, with a Retry that revalidates `usePickupPoints`, and a failed point read shows its own failure line with the same Retry. After a successful action the page shows a success card naming the stored role through its `staff` label and, for the point, the point name and address, then awaits `mutateProfile()` so the navigation updates. The success card wins over the confirmation lines for the rest of that page visit. A role already held wins over the `PENDING` notice for that role, because the account status only affects an action that is still available.
- **AC-4**: `POST /api/staff/point-worker` with `{ pickupPointId }` creates exactly one `PointWorker` row for the authenticated account: `id` takes its cuid default, `userId` is the account id, and `pickupPointId` is the value from the body. It answers `200 { staffRoles, point }`, where `staffRoles` lists every role the account holds after the call and `point` is `{ id, name, address, isActive }` read from the stored point. The router mounts `requireActiveAccount` before `validateDto(CreatePointWorkerDto, { status: 422, code: "VALIDATION" })` and before the controller.
- **AC-5**: A `pickupPointId` that matches no row is refused `409 UNKNOWN_PICKUP_POINT`, and a row whose `isActive` is false is refused `409 PICKUP_POINT_INACTIVE`. Neither creates a row, and the response `code` is what the screen branches on. The point is read with one statement before the insert, and no transaction or row lock is taken: a point switched off between the read and the insert still leaves a worker attached to it, which is a state the reads and the handover features handle on their own (AC-9, AC-13).
- **AC-6**: A repeated `POST /api/staff/point-worker` from an account that already holds the role answers `200` with the stored row and its point, creates nothing and changes no point, whatever `pickupPointId` the request carries. Two concurrent calls settle the same way: the unique index on `PointWorker.userId` decides the winner, the insert is one statement that is not wrapped in a transaction, so a unique violation leaves the connection usable, and the losing call answers from a fresh read of the winner row.
- **AC-7**: `POST /api/staff/courier` takes no body, mounts `requireActiveAccount`, and creates exactly one `Courier` row for the authenticated account with `id` from its cuid default. It answers `200 { staffRoles, point: null }`. A repeat answers `200` with the account's roles, creates nothing, and two concurrent calls settle through the unique index on `Courier.userId` the same way AC-6 describes.
- **AC-8**: `PATCH /api/staff/point-worker` with `{ pickupPointId }` changes the point on the caller's own row and nothing else. The router mounts `requireActiveAccount`, then `requirePointWorker`, then `validateDto(CreatePointWorkerDto, { status: 422, code: "VALIDATION" })`, in that order, and the handler writes only the row whose `userId` is the authenticated id. So a `PENDING` account is refused `403 EMAIL_NOT_CONFIRMED` whatever the body carries, an `ACTIVE` account that holds no point role is refused `403 NOT_POINT_WORKER` before the body is validated, and only an `ACTIVE` point worker reaches validation. The refusals of AC-5 apply unchanged to this call, and a request naming the point already stored answers `200` with the current row while writing nothing. The change select starts on the point the `GET /api/staff/point` answer carries, and a successful call revalidates that read so the section and `/point` both show the new name.
- **AC-9**: `GET /api/staff/point` mounts `requirePointWorker` and answers `200 { staffRoles, point }`, including a point whose `isActive` is false, so the screen can say the point is switched off. An account that holds no point role is refused `403 NOT_POINT_WORKER`, and a role read that fails answers `503 STAFF_ROLE_UNAVAILABLE` instead of a refusal, so an outage never reads as a missing role. A `PENDING` account may still read: `requireActiveAccount` is mounted on the routes that write, as it is on the seller onboarding route, and never on a read.
- **AC-10**: `GET /api/staff/courier` mounts `requireCourier` and answers `200 { staffRoles, point: null }`. An account that holds no courier role is refused `403 NOT_COURIER`, and a failed role read answers `503 STAFF_ROLE_UNAVAILABLE`. `requirePointWorker` and `requireCourier` read the caller's own row by `userId` in one indexed read and put it on the request, so no handler re-reads the role; the point route then reads the `PickupPoint` row for the name, address and `isActive` the request does not carry. Both guards are the ones features 19 and 20 mount on their own routes.
- **AC-11**: `GET /api/users/me` answers one new field, `staffRoles`, holding `"POINT_WORKER"` and `"COURIER"` in that fixed order for the roles the account holds and `[]` for an account that holds none. It comes from the same single query as `isSeller`, through the two optional relations on `User`. `userInfo` also backs the answers of `PATCH /api/users/me` and `PATCH /api/users/me/password`, so the field ships on all three responses. The storefront type `UserData` gains the same field, and every hand written mock of those responses is updated in the same change.
- **AC-12**: The navbar and the mobile menu sheet each gain two items: `/point` under `nav.point` with the `MapPin` icon when `staffRoles` includes `POINT_WORKER`, and `/courier` under `nav.courier` with the `Truck` icon when it includes `COURIER`, both icons from `lucide-react`, which the navbar already imports. Both items sit beside the `Sales` item and keep their order between them. The sheet takes the roles as a `staffRoles` prop beside `isSeller`, because it reads no hooks of its own. Both items appear without a reload after a successful call on `/staff/onboarding`, because that page awaits `mutateProfile()`.
- **AC-13**: `/point` shows a skeleton while its read is in flight, then the role heading, the point name, its address, and a banner that the point is switched off when `point.isActive` is false, plus one line saying the order queue arrives in the next feature. It offers no control that pretends to work and prints no invented count. A `403 NOT_POINT_WORKER` shows the no role screen with an explanation and a link to `/staff/onboarding`, `503 STAFF_ROLE_UNAVAILABLE`, `500` and a client timeout show a failure screen with Retry that re-reads. A `401` paints no state of its own: the fetcher already ends the session and reloads. `/courier` mirrors the page without a point.
- **AC-14**: Every refusal a screen shows comes from the response `code`, read through `refusalCode` from `@/common/helpers/apiRefusal`, which reads the code on any status, and never from the server `message`; the fetcher helper of the same name reads only `401` and `403` and is not the extractor for these codes. Every new string lives in the `staff` namespace in both `apps/customer/messages/en.json` and `apps/customer/messages/ru.json`, and both catalogs carry the same keys: `title`, `subtitle`, the two role labels, the form labels and hints, the validation text, the loading, failure, retry, no active point, point load failure, confirmation notice, already held, switched off and no role states, the two success cards, the change control, the queued orders line for the next feature, and the refusal copy. The two navigation labels live under `nav`. The pickup sentences already shipped in the `cart` namespace are reused for an unknown or a closed point instead of being copied into `staff`: `cart.unknownPickupPoint`, `cart.pickupInactive`, `cart.pickupUnavailable`, `cart.pickupLoadFailed` and `cart.pickupRetry`. No component carries hardcoded English or Cyrillic text, and the existing `messages.test.ts` covers the new namespace through its per namespace parity and placeholder passes.
- **AC-15**: Every control on the three pages is reachable by keyboard and carries the project `focus-visible` ring, the select and the buttons are at least 32 px high, the pages use the storefront content container and stack without horizontal scrolling at 360 px, and after a successful action focus moves to the success card heading, which is announced as a status message.
- **AC-16**: `PointWorker` and `Courier` are added to `packages/Astrum-db/prisma/schema.prisma`, and the same edit is copied into the three copies under `apps/api-astrum`, `apps/auth-astrum` and `apps/worker`, so all four files stay byte identical. They are identical today, all four at 460 lines, whatever spec 0008, AC-13 says about trimmed subsets. Each copy gains the two models, `User.pointWorker`, `User.courier` and `PickupPoint.workers`. One migration, `20261114120000_staff_roles`, creates both tables with `id` as the primary key, a unique index on `userId` in each, a foreign key to `User` with `ON DELETE CASCADE`, and a foreign key from `PointWorker.pickupPointId` to `PickupPoint` with `ON DELETE RESTRICT`. `pnpm db:generate` rebuilds all four generated clients.
- **AC-17**: The behaviour is covered by tests: gateway service specs for the point grant (create, unknown point, inactive point, repeat, race, no point change on repeat), the courier grant (create, repeat, race) and the point change (move, same point, unknown point, inactive point); guard specs for both roles proving `403 NOT_POINT_WORKER` and `403 NOT_COURIER`, `503 STAFF_ROLE_UNAVAILABLE` on a failed read, and the gate order, where a `PENDING` account with an invalid body is refused `403 EMAIL_NOT_CONFIRMED`; route specs for all five endpoints; storefront suites for the onboarding page states, the profile section, the `/point` and `/courier` states, the two navigation items and the mobile sheet, each staff hook on success, refusal and network failure, and the catalog parity run; the suites that build a `UserData` literal are updated for the new field, in `apps/customer/src/features/layout/Navbar/__tests__/index.test.tsx`, `apps/customer/src/features/pages/Profile/__tests__/Profile.test.tsx` and `apps/customer/src/features/pages/SellerOnboarding/__tests__/SellerOnboarding.test.tsx`. `pnpm quality-gate` is green.
- **AC-18**: Every successful grant and every point change writes one structured log line carrying the account id and, where one applies, the point id: `staff.point-worker.granted`, `staff.courier.granted`, `staff.point-worker.moved`. A repeat writes none, and a refusal keeps the log line the refusing guard or handler already writes.

## Decision

**Chosen option**: Option 2: two role tables granted from a page in the storefront.

Two new tables, `PointWorker` and `Courier`, one row per account per role, granted through `POST /api/staff/point-worker` and `POST /api/staff/courier` from `/staff/onboarding`, with the point changed by `PATCH /api/staff/point-worker` and each role read by its own guarded endpoint. The role shows in the profile and in the navigation from `GET /api/users/me`, which gains `staffRoles`.

**Implementation skills**: none consulted. The installed skills in `AGENTS.md` are the workflow skills and the storefront coding standard, and the storefront standard (S1 to S5) already governs where the new components and hooks live, so it is followed through `apps/customer/AGENTS.md` rather than as a separate skill.

## Feature design

**Data model sketch**:

| Entity | Key | Fields | Change |
| --- | --- | --- | --- |
| `PointWorker` | `id` cuid primary key | `userId` unique, `pickupPointId` required, `createdAt`, `updatedAt` | new |
| `Courier` | `id` cuid primary key | `userId` unique, `createdAt` | new |
| `User` | existing | adds `pointWorker PointWorker?` and `courier Courier?` | relations only |
| `PickupPoint` | existing | adds `workers PointWorker[]` | relation only |

Relationships: one `User` to zero or one `PointWorker`, one `User` to zero or one `Courier`, one `PickupPoint` to many `PointWorker`. The two tables are independent, so an account can hold both roles.

The invariant "a point worker names a point, a courier names none" is held by the structure itself: `PointWorker.pickupPointId` is a required column and `Courier` has no such column, so no check constraint and no service rule is needed to keep it.

**State transitions**:

No state machine. A row is created once and never deleted by this feature. The only mutation after creation is the `pickupPointId` of a `PointWorker` row, which `PATCH /api/staff/point-worker` rewrites in place.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
| --- | --- | --- | --- | --- | --- |
| `/api/staff/point-worker` | POST | `pickupPointId`: string, required | `staffRoles`, `point` | Session cookie, `ACTIVE` account | `422 VALIDATION`, `409 UNKNOWN_PICKUP_POINT`, `409 PICKUP_POINT_INACTIVE`, `403 EMAIL_NOT_CONFIRMED`, `503 ACCOUNT_STATUS_UNAVAILABLE`, `500` |
| `/api/staff/courier` | POST | none | `staffRoles`, `point: null` | Session cookie, `ACTIVE` account | `403 EMAIL_NOT_CONFIRMED`, `503 ACCOUNT_STATUS_UNAVAILABLE`, `500` |
| `/api/staff/point-worker` | PATCH | `pickupPointId`: string, required | `staffRoles`, `point` | Session cookie, `ACTIVE` account, `POINT_WORKER` | `403 EMAIL_NOT_CONFIRMED`, `503 ACCOUNT_STATUS_UNAVAILABLE`, `403 NOT_POINT_WORKER`, `503 STAFF_ROLE_UNAVAILABLE`, `422 VALIDATION`, `409 UNKNOWN_PICKUP_POINT`, `409 PICKUP_POINT_INACTIVE`, `500` |
| `/api/staff/point` | GET | none | `staffRoles`, `point` | Session cookie, `POINT_WORKER` | `403 NOT_POINT_WORKER`, `503 STAFF_ROLE_UNAVAILABLE`, `500` |
| `/api/staff/courier` | GET | none | `staffRoles`, `point: null` | Session cookie, `COURIER` | `403 NOT_COURIER`, `503 STAFF_ROLE_UNAVAILABLE`, `500` |
| `/api/users/me` | GET | none | existing fields plus `staffRoles` | Session cookie | unchanged |

All five staff routes are added as one `staffRoutes` router inside the existing `app.use("/api", authenticateToken, sellerOrderRoutes, sellerOnboardingRoutes, shippingRoutes, pickupRoutes)` call, never as a second `app.use("/api", authenticateToken, ...)` mount: a second mount with the same prefix runs `authenticateToken` twice on every request that matches it, and reordering the mounts can regress an existing route. Inside that router the order is `requireActiveAccount` where the route writes, then `requirePointWorker` or `requireCourier` where the route needs a role, then `validateDto`, then the controller.

`CreatePointWorkerDto` declares `@Expose() @IsString() @Length(1, 64) pickupPointId!: string`, because `validateDto` builds the instance with `excludeExtraneousValues: true`: a field without `@Expose()` is stripped before validation, which turns a valid body into `422`.

**Value sourcing**:

| Action | Value produced or displayed | Source |
| --- | --- | --- |
| Grant a point role | `PointWorker.id` | The database default (`cuid()`) |
| Grant a point role | `PointWorker.userId` | The account id `authenticateToken` puts on the request |
| Grant a point role | `PointWorker.pickupPointId` | The request body, after `validateDto` |
| Grant either role | `staffRoles` in the response | Both relations of `User`, read in the same query |
| Grant a point role | Point name and address on the success card | The stored `PickupPoint` row, read before the insert |
| Point select on the onboarding page | The choice list | `GET /api/pickup-points` through `usePickupPoints`, active rows only, ordered by name |
| Change the point | The new `pickupPointId` | The request body |
| Profile section | Which roles are held | `useUser().profileData.staffRoles` |
| Profile section | The point name | `GET /api/staff/point` through a staff hook, mounted only while `POINT_WORKER` is held |
| Profile section | The point choice list | `usePickupPoints` |
| Navbar and mobile sheet | Which items appear | `useUser().profileData.staffRoles`, revalidated by `mutateProfile()` |
| `/point` page | Point name, address, and the switched off banner | `GET /api/staff/point`, including `point.isActive` |
| `/point` and `/courier` | Refusal copy | The response `code` into the `staff` catalog |
| Navbar and mobile sheet | Item labels | `nav.point` and `nav.courier` in both catalogs |
| Profile section | The confirmation notice that disables the change control | `useUser().profileData.status`, read as `PENDING` |
| Profile section | The point name and the change control | `GET /api/staff/point`, rendered only on a successful answer |
| `/staff/onboarding` | The empty point list copy and its Retry | `usePickupPoints().points` and its `mutate` |
| `/staff/onboarding` | The busy label on either action | Local state of the request in flight |
| `/staff/onboarding`, the profile section, `/point` | The unknown or closed point copy | The response `code` into the `cart` keys `unknownPickupPoint` and `pickupInactive` |
| `/staff/onboarding` | The success card role label | The stored role in the response `staffRoles`, through the `staff` role labels |

**Key invariants**:

- One `PointWorker` row per account and one `Courier` row per account, each enforced by a unique index on `userId`.
- A `PointWorker` row always names an existing point, enforced by the required foreign key with `ON DELETE RESTRICT`.
- A courier row carries no point, because the column does not exist.
- A repeat of a grant creates nothing, changes no point, and answers `200`.
- Granting a role never touches `Business`, so a seller may also be staff and a courier at once.
- Switching a point off leaves every worker attached to it: the role is not revoked, and the screens handle the inactive point.
- Deleting an account deletes its role rows through `ON DELETE CASCADE`.
- No read answers another account's role row, because every query keys on the authenticated id.
- `/api/users/me` keeps returning no business id and no staff row id, only the role names.

**Security model**:

The session stays in the `__auth` HttpOnly cookie and the gateway reads the account id from it. Every write is gated by `requireActiveAccount`, which reads `User.status` by primary key on each call and refuses a `PENDING` account with `403 EMAIL_NOT_CONFIRMED`. The role guards read the caller's own row by `userId` and refuse an account without the role with `403 NOT_POINT_WORKER` or `403 NOT_COURIER`, answering `503 STAFF_ROLE_UNAVAILABLE` when the read itself fails, so an outage never reads as a missing role. No endpoint accepts an account id from the request, so there is no path to grant or move another account's role.

The grant is self service on purpose: the scope row says a person becomes staff in one deliberate action from the profile, and this feature adds no invitation, approval or operator step. That means any confirmed account can attach itself to any active point and then, once feature 19 ships, hand over that point's parcels. The role itself carries no money and no personal data, so the blast radius is a wrong handover, not a breach, but the decision is recorded in Consequences and in Follow-up as a rule still owed. No payment, health or regulated personal data enters the feature, so no compliance scope applies. No new rate limit is added: every call needs a live session, a repeat is one indexed read that creates nothing, and the registration and confirmation limits stay the bound on how many accounts can ask.

**Configuration required**:

None. No new environment variable, secret or dependency is introduced.

**Critical test scenarios**:

- Happy path, point: a signed in `ACTIVE` account opens `/staff/onboarding`, picks an active point, presses the button, the row exists, the profile revalidates, the `Point` item appears, and the success card shows the stored point name, verifies **AC-4**, **AC-12**, **AC-15**.
- Happy path, courier: the same account presses the courier button, one `Courier` row exists, the `Courier` item appears, and the profile section names both roles, verifies **AC-7**, **AC-2**.
- Point list edge: the page opened with no active point disables the point action, says no point is open, and its Retry revalidates the read; a second click on a busy action sends no second request, verifies **AC-3**.
- Repeat: the point endpoint called twice with two different point ids answers `200` twice, keeps one row and the first point, verifies **AC-6**.
- Race: two concurrent grant calls from one account, one wins the unique index, the loser answers `200` from a fresh read, one row exists, verifies **AC-6**, **AC-7**.
- Point refusals: an unknown id answers `409 UNKNOWN_PICKUP_POINT`, an inactive point answers `409 PICKUP_POINT_INACTIVE`, and neither writes a row, verifies **AC-5**.
- Moving the point: `PATCH` with another active point rewrites the row and the profile shows the new name, the same point answers `200` with no write, and an account without the role is refused `403 NOT_POINT_WORKER` before an invalid body is validated, verifies **AC-8**.
- Role guards: `GET /api/staff/point` from an account without the role answers `403 NOT_POINT_WORKER`, `GET /api/staff/courier` answers `403 NOT_COURIER`, a failing role read answers `503 STAFF_ROLE_UNAVAILABLE`, and a `PENDING` account with an invalid grant body is refused `403 EMAIL_NOT_CONFIRMED`, verifies **AC-9**, **AC-10**.
- Profile read: `/users/me` answers `[]`, one role, and both roles in the fixed order, and every storefront mock of that read carries the field, verifies **AC-11**.
- Screens without a role: a direct visit to `/point` and to `/courier` shows the no role screen with the link to onboarding, verifies **AC-13**.
- Inactive point: a worker whose point is switched off sees the switched off banner on `/point` and still holds the role, verifies **AC-13**.
- Copy and layout: both catalogs in parity, no literal copy in components, no horizontal scroll at 360 px, every control reachable by keyboard, and the success card takes focus and is announced, verifies **AC-14**, **AC-15**.
- Schema: all four copies stay identical after the edit, the migration creates both tables with their indexes and foreign keys, and all four generated clients are rebuilt, verifies **AC-16**.
- Logging: a grant and a move each write one line with the account id, a repeat writes none, verifies **AC-18**.

## Build plan

Tracer Bullet: one thin thread end to end first (schema, then the two grant calls, then the page that calls them, then the navigation items), then the remaining states, the point change and the guards that features 19 and 20 will reuse. The migration lands first because it unblocks the gateway module and every fixture that touches the two tables.

1. Schema, migration and generated clients: add `PointWorker` and `Courier` with their relations to all four byte identical schema copies, write the migration `20261114120000_staff_roles` with the unique indexes, the `CASCADE` foreign key to `User` and the `RESTRICT` foreign key to `PickupPoint`, and run `pnpm db:generate` so all four clients are rebuilt, satisfies **AC-16**.
   — done 2026-11-14: all four copies hash to `4aa7227…` at 486 lines, `prisma migrate deploy` applied `20261114120000_staff_roles`, and `psql \d "PointWorker"` / `\d "Courier"` show both tables with `PointWorker_userId_key`, `PointWorker_pickupPointId_idx`, `Courier_userId_key` and the two `CASCADE` plus one `RESTRICT` foreign key; `pnpm prisma:generate` rebuilt all four clients.
2. Gateway staff module: new `src/modules/staff/` with `requirePointWorker` and `requireCourier` guards that read the caller's row and put it on the request, the two grant handlers, the point change handler, the two reads, `CreatePointWorkerDto`, and `constants/staff.constants.ts` holding `VALIDATION`, `NOT_POINT_WORKER`, `NOT_COURIER` and `STAFF_ROLE_UNAVAILABLE`, while the two pickup refusals keep the wire values the order module already answers (`UNKNOWN_PICKUP_POINT`, `PICKUP_POINT_INACTIVE`); mount the router inside the existing `app.use("/api", authenticateToken, ...)` call; write the service, guard and route specs, satisfies **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-18**.
   — done 2026-11-14: `src/modules/staff/{staff.routes,staff.controller,staff.service}.ts`, `dto/create-point-worker.dto.ts`, `constants/staff.constants.ts`, guards in `src/middlewares/staffRole.ts`, router mounted once inside the existing `/api` chain; four suites (`staff.service`, `staff.guards`, `staff.routes`, `create-point-worker.dto`, 38 tests) green.
3. Profile read: extend `UserService.userInfo` with `staffRoles` from the two relations in the same query, extend the storefront `UserData` type, and update every hand written mock of the profile read, satisfies **AC-11**.
   — done 2026-11-14: one query selects `pointWorker` and `courier`, `staffRolesOf` orders them `POINT_WORKER`, `COURIER`; `UserData` carries `staffRoles`, and the mocks in `Navbar`, `Profile` and `SellerOnboarding` suites were updated in the same change.
4. Storefront page and hooks: the `staff` hooks over `postItem`, `patchItem` and `getData`, the `StaffOnboarding` page with its two actions, the client rule that blocks a submit with no point chosen, the busy state, the success card and every state of AC-3, the `/point` and `/courier` pages with their states from AC-13, and the `staff` and `nav` catalog keys in both languages, satisfies **AC-1**, **AC-3**, **AC-13**, **AC-14**.
   — done 2026-11-14: `src/hooks/staff/` (two reads, three mutations, the page state resolver), `src/features/pages/StaffOnboarding`, `PointWorkspace`, `CourierWorkspace`, routes under `(content)`, `staff` and `nav` keys in both catalogs.
5. Entry points: the `Work on Astrum` section on the profile with the role lines, the point name and the change control, and the two items in the navbar and the mobile menu sheet, satisfies **AC-2**, **AC-12**.
   — done 2026-11-14: `src/features/pages/Profile/actions/WorkOnAstrum/` renders after `SellOnAstrum`; `MapPin` and `Truck` items sit after `Sales` in the navbar and the sheet takes `staffRoles`.
6. Layout and accessibility pass: the content container on all three pages, one column, the 360 px stack, the shared focus ring, the 32 px targets, and the focus move to the success heading inside a `role="status"` card, satisfies **AC-15**.
   — done 2026-11-14: all three pages use `mx-auto max-w-screen-xl px-4`, one `max-w-xl` column, shadcn `SelectTrigger` and `Button` (36 px) keep the project focus ring, and `SuccessCard` focuses its heading inside the announced card.
7. Tests and the gate: the storefront suites for the page states, the profile section, the two pages, the navigation items, the hooks and the catalog parity, then `pnpm quality-gate` across the workspace, satisfies **AC-17**.
   — done 2026-11-14: `pnpm quality-gate` reports 18 of 18 tasks successful; `@astrum/customer` runs 349 tests in 67 files, `@astrum/api` includes the 38 new staff tests, and the catalog parity suite covers the new namespace in both languages.

## Consequences

**Positive**:

- A parcel can be handed over by somebody who is not its seller, which is what features 19 and 20 need and what blocks them today.
- One row per account per role is a unique index, not a convention, so no double click or retry can create a second one.
- The guards `requirePointWorker` and `requireCourier` ship here and are reused unchanged by both handover features.
- The role is visible in the profile and in the navigation at once, so a person sees the job they took without a reload.

**Negative / tradeoffs**:

- The grant is self service with no approval, so any confirmed account can attach itself to any active point. Until a rule exists, that person can hand over that point's parcels once feature 19 ships. This is the risk this decision accepts knowingly.
- The role rows are the only record of who took a job: the project has no audit table, so the structured log line is the trail, and a log rotation loses it.
- Two new tables and two guards for a feature that ships two thin pages. The pages exist mainly so the navigation never leads to a missing route, and their content is a placeholder until features 19 and 20 arrive.
- The storefront `UserData` type and every test mock of the profile read change, which touches suites that have nothing to do with staff.
- A person who stops working at a point cannot leave the role, because this feature has no exit action.

**Neutral**:

- The tag is GA, so `/check verify`, `/test` and a review on another model follow the build.
- One migration is required and runs before the new gateway. Both tables are empty on arrival, so there is no backfill and no `NOT NULL` step against existing rows.
- No request path reads either table before the migration, so the deploy order is migration first, gateway second, storefront third.
- The staff pages live in the `(content)` group, so they inherit the storefront chrome and the confirmation banner without new layout code.
- No new environment variable, secret or dependency is introduced.

## Follow-up

- [ ] The handover at the point (scope row 19) and the handover by the courier (scope row 20), which mount `requirePointWorker` and `requireCourier` on their own routes; the queue counts and the order lists belong there, not here.
- [ ] A rule for who may grant a staff role: an invitation, an operator approval, or a per point manager. Today any confirmed account grants itself any active point.
- [ ] Leaving a role, and what happens to the handovers it already recorded.
- [ ] An audit table for access changes. The structured log line is the only trail today, and feature 19 hands parcels over on the strength of these rows.
- [ ] Feature 19 must refuse a handover at a point whose `isActive` is false, even though the worker keeps the role. This spec promises only the screen banner.
- [ ] Spec 0008, AC-13 says the auth and worker schemas are trimmed subsets that carry no `Business` model, and all four copies are byte identical today, so that sentence is stale. `/sync` should correct it, or the next schema change is told to leave two files alone.
- [ ] The email address on a role change: a worker who moves to another point is not told by mail, because the letters feature is scope row 16.

**Rationale**: the reasoning, the options weighed, and why two tables beat one membership table are in [rationale.md](rationale.md).
