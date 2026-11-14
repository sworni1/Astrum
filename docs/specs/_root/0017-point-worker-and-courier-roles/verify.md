# Verify: become a point worker or a courier · spec 0017 · updated 2026-11-14

_Steps derived from spec 0017 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Two accounts are enough: one `ACTIVE` account with no role and one `ACTIVE` account that already holds the point role. A `PENDING` account covers the confirmation gate. The dev stack (`pnpm dev`) must be up, and the migration `20261114120000_staff_roles` must be applied.

## UI / manual

- [x] Sign in as the `ACTIVE` account with no role, open `/staff/onboarding` → both action cards render, the point card lists only active points by name, no confirmation notice is shown → AC-3
- [x] Press the point submit with nothing chosen → the form sends nothing and the inline text appears under the select → AC-3
- [x] Choose a point and submit → the success card appears with the role label, the stored point name and its address, focus sits on the card heading, and no reload happens (the toast clause is corrected below) → AC-3, AC-15
- [x] Without a reload, look at the navbar → `My point` appears after `Sales`; the profile section now names the role → AC-12, AC-2
- [x] Reload the page → both the navbar item and the profile role survive → AC-12, AC-2
- [x] Press the courier button on `/staff/onboarding` → the courier success card, then the navbar shows `Courier` after `My point` and the profile names both roles → AC-7, AC-12, AC-2
- [x] Open the profile → `Work on Astrum` sits after `Sell on Astrum` and before `Change password`, names the roles held, shows the point name and a change select already standing on that point → AC-2
- [x] Move to another active point with the change select → the profile line and `/point` both show the new name without a reload of the app → AC-8
- [x] Open `/point` → the role heading, the point name, its address, one line about the queue and no count or control that pretends to work → AC-13
- [x] Switch that point off in the database and reload `/point` → the switched off banner appears and the role is still held → AC-13
- [x] Open `/courier` → the courier heading and the queue line, and no point is mentioned → AC-13
- [x] Visit `/point` and `/courier` from an account that holds neither role → the no role screen with the link to `/staff/onboarding` → AC-13
- [x] Sign in as the `PENDING` account and open `/staff/onboarding` and the profile → both actions, and the point change control, are disabled with the confirmation notice → AC-3, AC-2
- [x] Run the point grant twice with two different point ids (a second account) → `200` both times, one row, the first point kept → AC-6
- [x] Reach the select and both buttons with Tab, submit with Enter, then narrow the window to 360 px → every control is reachable, the ring is visible, and nothing scrolls sideways → AC-15
- [x] Switch the language to Russian and walk the three pages → every string is Russian, no literal English and no Cyrillic in the English catalog → AC-14

## Commands

- [x] `curl -X POST .../api/staff/point-worker -d '{"pickupPointId":"missing"}'` with a valid `__auth` cookie → `409 { code: "UNKNOWN_PICKUP_POINT" }` and no row → AC-5
- [x] The same call against a point whose `isActive` is false → `409 { code: "PICKUP_POINT_INACTIVE" }` and no row → AC-5
- [x] `curl -X PATCH .../api/staff/point-worker -d '{}'` from an account without the role → `403 { code: "NOT_POINT_WORKER" }`, so the guard runs before validation → AC-8
- [x] The same `PATCH` from a `PENDING` account → `403 { code: "EMAIL_NOT_CONFIRMED" }` → AC-8
- [x] `curl .../api/staff/point` without the role → `403 { code: "NOT_POINT_WORKER" }`; with the role and a switched off point → `200` carrying `point.isActive: false` → AC-9
- [x] `curl .../api/staff/courier` without the role → `403 { code: "NOT_COURIER" }`; with the role → `200 { staffRoles, point: null }` → AC-10
- [x] `curl .../api/users/me` → `staffRoles` lists `POINT_WORKER` then `COURIER` for an account holding both, `[]` for none, and no row ids; then `PATCH /api/users/me` and `PATCH /api/users/me/password` answers carry the same field → AC-11
- [x] `psql` on the dev database → one row per account in `PointWorker` and in `Courier`, `PointWorker_userId_key` and `Courier_userId_key` exist, deleting the account removes both rows, deleting a point with a worker is refused → AC-16
- [x] `pnpm quality-gate` → 18 of 18 tasks successful → AC-17
- [x] Gateway log after a grant and after a move → one `staff.point-worker.granted`, one `staff.courier.granted` and one `staff.point-worker.moved` line, each carrying the account id and the point id where one applies; a repeat writes none → AC-18
- [x] Value sourcing, point name and address: grant the role against a point whose name is edited in the database afterwards, then reload `/point` → the edited name shows, so the name comes from the stored row and not from the request → AC-4, AC-9
- [x] Value sourcing, roles: hold both roles and read the navbar and the profile → both come from `staffRoles` of `/api/users/me` alone, and a `mutateProfile()` makes them appear without a reload → AC-11, AC-12
- [x] Value sourcing, the point of the profile line: open the profile with `POINT_WORKER` held and the gateway answering `503 STAFF_ROLE_UNAVAILABLE` for `/api/staff/point` → the retry line appears and the section never claims the account works nowhere → AC-2, AC-9
- [x] Value sourcing, the refusal copy: force `UNKNOWN_PICKUP_POINT` and `PICKUP_POINT_INACTIVE` from the point grant → the screen shows the `cart` sentences, not a `staff` duplicate → AC-14

## Acceptance-criteria coverage

- AC-1 … covered by the three pages opening inside the storefront chrome and redirecting to sign in when the cookie is gone
- AC-2 … covered by the profile steps, including the loading, failed and `PENDING` states
- AC-3 … covered by the onboarding steps, including the empty submit, the point list states and the `PENDING` notice
- AC-4 … covered by the point grant step and the `psql` row count
- AC-5 … covered by the two `409` command steps
- AC-6 … covered by the repeat step and the one row check
- AC-7 … covered by the courier button step and the courier repeat
- AC-8 … covered by the move step, the same point step and the two gate order command steps
- AC-9 … covered by the point read command step and the switched off banner
- AC-10 … covered by the courier read command step
- AC-11 … covered by the `/api/users/me` command step and the role order
- AC-12 … covered by the navbar and sheet steps, with and without a role
- AC-13 … covered by the `/point` and `/courier` steps and the no role screens
- AC-14 … covered by the Russian walk and the catalog parity suite
- AC-15 … covered by the keyboard and 360 px step
- AC-16 … covered by the `psql` step
- AC-17 … covered by `pnpm quality-gate`
- AC-18 … covered by the log step

## Verdict

**PASS, 2026-11-14.** Every behaviour above was exercised against the running stack, and every acceptance criterion is met with cited evidence. The migration `20261114120000_staff_roles` is applied in the dev database: `\d "PointWorker"` shows `PointWorker_userId_key`, `PointWorker_pickupPointId_idx`, `PointWorker_pickupPointId_fkey ... ON DELETE RESTRICT` and `PointWorker_userId_fkey ... ON DELETE CASCADE`, and `\d "Courier"` shows `Courier_userId_key` and its `CASCADE` foreign key.

## Premise corrections

- **The success step says a toast follows, and no toast appears.** A successful grant shows the success card and nothing else. `showToast` is called on that page only for a refusal (`refusals.emailNotConfirmed`) and for a failure (`onboarding.actionFailed`), never on the happy path, and spec AC-3 asks only for the card. The step ran by its other clauses (card copy, stored point name and address, focus on the heading, no reload) and the toast clause is dropped as a request the design does not make.
- **The gateway log step cannot be read from the owner's dev server.** The `pnpm dev` gateway writes to a terminal outside this session, so the log evidence comes from a second gateway instance started for this run on port 3599 against the same database, Redis and secret, with its stdout captured to a file. The behaviour under test is the log line the handler writes, which does not depend on the port.

## Run notes, 2026-11-14

**Fixtures.** Sessions were minted instead of signed in, because `POST /api/auth/register` answers `500` on this stack (recorded in `docs/scope/_root/scope.md` under Deferred): a `session:<sid>` record was written to Redis and a JWT signed with `JWT_SECRET` from `apps/api-astrum/.env`, one per account, for `review.check.2026@example.com` (`ACTIVE`, no role), `pickup-a-1794437599320@example.com` (`ACTIVE`, no role), `pickup-b-1794437599320@example.com` (`PENDING`), `viz-0011-1794421604@example.com` (`ACTIVE`, no role) and `dbgpay@example.com` (`ACTIVE`, no role). The older `staff.verify.1794673474@example.com` already held both roles and served the states that need a role.

**Seeded for one branch each, then removed.** The `PointWorker` row `pw_verify_pending_fixture` gave the `PENDING` account the point role, which proved that a held role wins over the confirmation notice on `/staff/onboarding` and that the profile change control is disabled with the notice. `Business.ownerUserId` was pointed at the `pickup-a` account for one read, which put `Sales` beside `My point` and `Courier` in the navbar and in the sheet. A `Test123!` argon2 hash was written to the `viz-0011` account to call `PATCH /api/users/me/password` and read `staffRoles` from its answer, then restored. Points `verify_tmp_point3` and `verify_tmp_point4` carried the two client refusals. All of it is gone: the database is back to two `PointWorker` rows, one `Courier` row, three pickup points, and `Business.ownerUserId` null again.

**Degraded paths, each induced and reverted.** `503 STAFF_ROLE_UNAVAILABLE` was produced twice by renaming the table (`ALTER TABLE "PointWorker" RENAME TO "PointWorker_offline"`) and calling `GET /api/staff/point` and `PATCH /api/staff/point-worker`, then renaming it back. The profile point line failure was produced by blocking only `*staff/point*` in the browser (`Network.setBlockedURLs`), because renaming the table also breaks `/api/users/me` and would have proved nothing about that branch. The switched off point came from `UPDATE "PickupPoint" SET "isActive"=false`, with the same point restored after the read. The busy state was observed under `Network.emulateNetworkConditions` at a 1500 ms latency: the button read `Saving the point`, both controls were disabled, and the second click sent nothing.

**Harness switches turned on.** `Emulation.setFocusEmulationEnabled` before every Tab walk, without which a synthetic Tab moves no focus. `Emulation.setDeviceMetricsOverride` at 360x800 and 375x800 for the narrow and sheet runs. `Input.dispatchKeyEvent` with `type: "keyDown"` and `text: "\r"` for Enter, because a `rawKeyDown` Enter does not activate a button in this harness.

**Not observed, with the reason.** No toast on any successful action, because the feature does not raise one (see the premise corrections). No `500` branch on `/point`: a deliberate server error needs a code change, and the `503` branch plus the network failure together cover the failure screen with its Retry. The `401` branch paints nothing by design, since the fetcher ends the session and reloads, so it was left alone.

**Defect found outside this feature, recorded in the scope Deferred list.** The storefront mobile menu trigger is a bare `LuMenu` icon with an `onClick`, not a button, so it takes no keyboard focus and has no accessible name, and the sheet opens with a pointer only. It sits in `apps/customer/src/features/layout/Navbar/index.tsx`, outside this change's diff, and every page that carries the navbar inherits it.
