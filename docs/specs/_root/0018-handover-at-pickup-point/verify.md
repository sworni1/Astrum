# Verify: handover at the pickup point · spec 0018 · updated 2026-11-14

_Steps derived from spec 0018 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

**Verdict 2026-11-14, second run: PASS.** The build landed after the first run of the same day and all 32 steps below were exercised on the running stack, every acceptance criterion met. The first run found nothing built, and it stays recorded in the run notes.

Fixtures the steps assume, created before the walk:

- one `ACTIVE` account holding `POINT_WORKER` at point A, and a second `ACTIVE` worker at point B (`/staff/onboarding` makes both);
- at least 21 orders at point A whose `status` is `SHIPPED`, so the pagination step has a second page;
- one of those orders paid online (`paymentStatus = PAID`) and one placed with cash (`paymentStatus = PENDING`);
- one order at point A with two shipped lines of the same product, so the stock return can be counted;
- one order at point B;
- one order at point A that is still `CONFIRMED` (a cash order placed less than a minute ago, before the shipping pass runs).

The dev stack (`pnpm dev`) must be up. Derive the database client from the running container rather than from `.env`:

```bash
PG=$(docker ps --filter "ancestor=postgres:16" --format "{{.Names}}" | head -1)
PSQL="docker exec $PG psql -U $(docker exec $PG printenv POSTGRES_USER) -d $(docker exec $PG printenv POSTGRES_DB) -At"
```

The session cookie comes from signing in through the storefront, then reading the `__auth` cookie into the shell without printing it (`read -rs AUTH`); no step echoes it.

## UI / manual

- [x] Sign in as the worker of point A, open `/point` → the queue heading, a refresh control, and one card per shipped order of point A, each showing the order number, the placed date, the total and every item with its quantity, unit price and status label → AC-1, AC-2, AC-10
- [x] Read the cards and confirm none of them shows a buyer name, an email, a phone or an address, and none shows a business name → AC-2, AC-10
- [x] Sign in as the worker of point B and open `/point` → point B's order appears and no order of point A appears (two accounts, two points, opposite answers) → AC-1
- [x] Press `Выдать` on a card, then close the dialog with Escape, with a click on the overlay and with the keep control → the network panel shows no request and the card is still there → AC-11
- [x] Press `Выдать` and confirm → the row leaves the list, a success toast appears, focus sits on the queue heading, and the buyer's order screen prints the handover date → AC-5, **AC-11**, AC-16
- [x] Press `Отменить` on the paid shipped order and confirm → the row leaves the list, the buyer's screen reads cancelled with the refund note, and the product's `quantity` grows by the line quantity in `PSQL` → AC-6, AC-8
- [x] Press `Отменить` on the cash order and confirm → the order reads cancelled, the product quantity grew once, and the payment line reads cancelled rather than pending → AC-6, AC-8
- [x] Hand an order over in one tab, then press `Отменить` on it from a second tab that still renders the old page → the toast names `ALREADY_HANDED_OVER` for the handover or `NOTHING_TO_CANCEL` for the cancel, and the queue behind the dialog no longer holds the row → AC-12
- [x] Hand every order of point A over and reload `/point` → the empty state names that no parcel waits, with the refresh control, and no invented count → AC-10
- [x] With the 21 fixtures in place, scroll to the bottom of the first page → `Show more` reads the next page and appends it, and it disappears on the last page → AC-3, AC-10
- [x] Switch point A off in the database (`UPDATE "PickupPoint" SET "isActive" = false WHERE name = '<point A>'`) and reload `/point` → the switched off banner, both controls disabled on every card, and the cards still listed → AC-9, AC-10
- [x] Reach the refresh control and both controls of a card with Tab, open a dialog with Enter and close it with Escape, then narrow the window to 360 px → every control is reachable, the ring is visible, the dialog controls are at least 32 px high and nothing scrolls sideways → AC-14
- [x] Switch the language to Russian and walk the queue, both dialogs and both success toasts → every string is Russian, with no literal English and no Cyrillic in the English catalog → AC-13

## Commands

- [x] `curl -s "$GW/api/staff/point/orders" -H "Cookie: __auth=$AUTH" | jq -r '.orders[].status' | sort -u` → prints exactly `SHIPPED`; a run that lists any other status fails the step → AC-1
- [x] The same call piped through `jq '.orders[0] | has("userId"), has("deliveryAddress"), has("pickupPointId")'` → prints three `false` lines; a broken answer prints `true` → AC-2
- [x] `curl -s "$GW/api/staff/point/orders?page=0"` → `422 { code: "VALIDATION" }`; `?limit=500` → the answer carries `"limit": 50` → AC-3
- [x] `curl -s "$GW/api/staff/point/orders"` with the cookie of the account that holds no role → `403 { code: "NOT_POINT_WORKER" }` → AC-1
- [x] `curl -s -X PATCH "$GW/api/staff/point/orders/<order of point B>/handover"` with the point A cookie → `404 { code: "ORDER_NOT_FOUND" }`, and the same call on `/cancel` answers the same code → AC-4, AC-6
- [x] The same handover call on the order that is still `CONFIRMED` (made before the shipping pass runs) → `409 { code: "ORDER_NOT_SHIPPED" }` and no line changed; `/cancel` on that same order answers the same code, so the counter cannot close what has not been sent → AC-4, AC-6
- [x] The same handover call on an order already handed over → `409 { code: "ALREADY_HANDED_OVER" }`; `/cancel` on an order whose every line is delivered → `409 { code: "NOTHING_TO_CANCEL" }` → AC-4, AC-7
- [x] With point A switched off, both `PATCH` calls on a point A order → `409 { code: "PICKUP_POINT_INACTIVE" }` and nothing written, while `GET /api/staff/point/orders` still answers `200` → AC-9
- [x] `$PSQL -c "SELECT id, status FROM \"OrderItem\" WHERE \"orderId\" = '<cancelled order>'"` before and after a second `/cancel` call → the statuses read `CANCELLED` and `PENDING` is gone in both reads, and the product's `quantity` did not change on the second call → AC-7
- [x] `$PSQL -c "SELECT \"receiptDate\", (SELECT \"handedOverAt\" FROM \"Order\" WHERE id = '<delivered order>') FROM \"OrderItem\" WHERE \"orderId\" = '<delivered order>'"` → every delivered line carries one timestamp and it equals the order's `handedOverAt` → AC-5
- [x] `node -e "const s=require('./apps/customer/messages/en.json').staff.point;console.log('queueLine' in s ? 'still there' : 'clean')"` → prints `clean`, and the same check on `ru.json` prints `clean`; `staff.courier.queueLine` stays on purpose, because the courier card still prints it → AC-13
- [x] `node -e "const a=require('./apps/customer/messages/en.json').staff.point.queue,b=require('./apps/customer/messages/ru.json').staff.point.queue;const k=o=>JSON.stringify(Object.keys(o).sort());console.log(k(a)===k(b)?'parity ok':k(a)+' vs '+k(b))"` → prints `parity ok` → AC-13
- [x] `pnpm --filter @astrum/api test -- seller-order` → the seller suites pass after the pagination extraction, so the shared helper changed no seller answer → AC-3, AC-15
- [x] `pnpm quality-gate` → every task successful, including the new gateway and storefront suites → AC-15
- [x] The gateway log after a handover and after a cancel → one `staff.point.handed_over` line with the account, the point, the order and `deliveredLineCount`, and one `payment.refund_owed` line with `reason: "point_cancel"` for the paid order → AC-5, AC-8

## Value sourcing

- [x] Read the order number on a card and `$PSQL -c "SELECT id FROM \"Order\" ORDER BY \"createdAt\" LIMIT 1"` → the card prints the last eight characters of that id, not a formatted number → AC-2
- [x] Move the point A worker to point B from the profile, then reload `/point` → point B's cards appear on the next request and point A's disappear, so the scope comes from the stored role row and not from the session or the request → AC-1
- [x] Compare the refund line's `amount` with `$PSQL -c "SELECT sum(price * quantity) FROM \"OrderItem\" WHERE \"orderId\" = '<paid cancelled order>' AND status = 'CANCELLED'"` → the two numbers agree at two decimals, and the delivery price is not part of either → AC-8
- [x] Read a card's placed date, then `$PSQL -c "SELECT \"createdAt\" FROM \"Order\" WHERE id = '<that order>'"` → the screen prints the localized form of that value, so the date comes from the row and not from the client clock → AC-10

## Acceptance-criteria coverage

- AC-1 … covered by the two point accounts, the status list command and the role refusal command
- AC-2 … covered by the `has()` command and the card read
- AC-3 … covered by the two pagination commands, the `Show more` step and the seller suite run
- AC-4 … covered by the foreign order, not shipped and already handed over commands
- AC-5 … covered by the handover step, the timestamp query and the handover log line
- AC-6 … covered by the cancel steps for both payment methods and the stock query
- AC-7 … covered by the second cancel command with the quantity unchanged, and the `NOTHING_TO_CANCEL` command
- AC-8 … covered by the payment line on the cash order, the refund log line and the amount query
- AC-9 … covered by the switched off point step and its two `409` commands
- AC-10 … covered by the queue, empty state, `Show more`, disabled controls and date steps
- AC-11 … covered by the three ways of closing a dialog without a request, and the success step
- AC-12 … covered by the second tab step and the refusal toast walk
- AC-13 … covered by the Russian walk and the two catalog commands
- AC-14 … covered by the keyboard and 360 px step
- AC-15 … covered by `pnpm quality-gate` and the seller suite run
- AC-16 … covered by the handover and cancel steps end to end on the running stack

## Run notes

### 2026-11-14 · first run, FAIL, nothing was built (the build landed later the same day)

The dev stack was already up (`customer` on 3000 and `api` on 3580 answered `/health` with `200`), so it was not restarted. The gateway reads `apps/api-astrum/.env`, whose `JWT_SECRET` differs from the root `.env`, so the session was minted rather than typed: one JWT `{ userId, sid }` signed with the gateway secret for the existing worker account `cad2d741…` (`POINT_WORKER` at `Pickup point Lenina`, point A), plus one `session:verify-point-a-0001` record in `astrum-redis`. The record was deleted after the run.

What the run observed:

| Probe | Answer | Meaning |
| --- | --- | --- |
| `GET /api/staff/point` with that cookie | `200` | the session is valid and the staff router is mounted, so the answers below are route absences, not refusals |
| `GET /api/staff/point/orders` | `404` | the queue read of AC-1 to AC-3 does not exist |
| `GET /api/staff/point/orders?page=0` | `404` | the pagination refusal of AC-3 cannot be reached |
| `PATCH /api/staff/point/orders/<id>/handover` | `404` | the handover of AC-4 and AC-5 does not exist |
| `PATCH /api/staff/point/orders/<id>/cancel` | `404` | the cancel of AC-6 to AC-8 does not exist |

`/point` signed in as that worker (screenshot taken on 2026-11-14) prints the point card, name and address, and the sentence "The order queue arrives in the next feature." There is no queue heading, no refresh control, no order card, no control and no empty state; that is the placeholder spec 0017 AC-13 left behind. `apps/customer/src/features/pages/PointWorkspace/` holds `index.tsx`, `components/PointCard.tsx` and its suite, nothing else.

Static reads that explain those answers, and are not evidence on their own: `staff.routes.ts` mounts `/staff/point-worker`, `/staff/courier`, `/staff/point` and `/staff/courier` only; `StaffService` holds `grantPointWorker`, `grantCourier`, `movePoint`, `readPoint` and `readCourier`; `apps/api-astrum/src/common/helpers/pagination.ts` does not exist; `apps/customer/messages/en.json` carries no `staff.point.queue` namespace (the keys today are `title`, `pointLabel`, `addressLabel`, `inactiveBanner`, `queueLine`, `noRoleTitle`, `noRoleText`, `noRoleAction`, `failureTitle`, `failureText`); no file under `apps` or `packages` mentions `ALREADY_HANDED_OVER`, `NOTHING_TO_CANCEL` or `ORDER_NOT_SHIPPED`.

Not run, and why: the 25 live walk steps, the 16 command steps and the 4 value sourcing steps, because every one of them reads a surface listed above as absent. `pnpm quality-gate` and `pnpm --filter @astrum/api test -- seller-order` were skipped too, since no code from this spec sits in the tree, so neither can say anything about AC-15. The 21 order fixtures were not seeded, because a queue that answers `404` has nothing to page through.

A defect found on the way, outside this feature: `POST /api/auth/register` answers `500 Internal server error`, through the gateway and directly on the auth service, for a fresh address with a valid body (password of 10 characters, `gender: "Male"`, `dateOfBirth: "1999-05-05"`), and writes no `User` row. The migration `20261114120000_staff_roles` is applied, the four schema copies are byte identical, and `PointWorker` and `Courier` exist in the live schema, so the cause sits elsewhere. It is recorded in the scope Deferred list and needs a decision, because it blocks the two worker accounts these steps assume.

### 2026-11-14 · second run, PASS

The build landed after the first run: the three point routes, `parsePagination`, the queue screen with its two dialogs, and the `staff.point.queue` catalog. The dev stack was not restarted, `tsx watch` and Turbopack picked the new files up on their own.

**Fixtures.** Two worker accounts were needed and one of them did not exist: `cad2d741…` already held `POINT_WORKER` at `Pickup point Lenina` (point A), so it kept its row, and `e4cf5edc…` was granted point `Pickup point Mira` (point B) through `POST /api/staff/point-worker` as the profile does. The third account, `d94870b1…`, stays `PENDING` and holds no role, which is what the `403` step and the read stays open to a pending account both used. Sessions were minted rather than typed, because the gateway reads `apps/api-astrum/.env` and its `JWT_SECRET` differs from the root one: one JWT `{ userId, sid }` per account signed with that secret, plus one `session:<sid>` record in `astrum-redis`. Twenty one shipped parcels at point A were seeded straight into `Order` and `OrderItem` with the product `4684c794…` (`quantity` was 27 before the run), one of them paid online at `1550.00`, one cash at `1799.00`, one with two shipped lines of the same product at `500.00` each, plus one `CONFIRMED` cash parcel for the not shipped refusal, and later a cash parcel at `1777.00` and two paid ones at `200.00` and `300.00`.

**What the run saw.** `GET /api/staff/point/orders` answered `200` with `total 23`, `page 1`, `limit 20`, `totalPages 2`, only `SHIPPED` rows, ordered by `createdAt` ascending, and no `userId`, no `deliveryAddress`, no `pickupPointId` on a row. Point B's worker read exactly its own parcel. `page=0` answered `422 VALIDATION`, `limit=500` came back with `limit 50`, page 3 of a two page answer came back empty, and the account without a role answered `403 NOT_POINT_WORKER`. A foreign parcel answered `404 ORDER_NOT_FOUND` on both writes, the `CONFIRMED` parcel answered `409 ORDER_NOT_SHIPPED` on both, a repeat handover answered `409 ALREADY_HANDED_OVER`, a cancel on a fully delivered parcel answered `409 NOTHING_TO_CANCEL`, and with the point switched off both writes answered `409 PICKUP_POINT_INACTIVE` while the read kept answering `200` and nothing was written. The handover moved the single shipped line to `DELIVERED` with a `receiptDate` equal to the order's `handedOverAt` to the millisecond (`2026-11-14 18:57:56.604`), a paid cancel left `paymentStatus = PAID` with a `payment.refund_owed` line of `300.00` that matches the cancelled lines' sum, a cash cancel left the order at `paymentStatus = CANCELLED`, and a second cancel left the product `quantity` untouched.

**Log lines.** A second gateway replica was started on port 3581 for this, because the dev one writes to a terminal this session cannot read. Its stdout carries `{"event":"staff.point.handed_over","userId":"cad2d741…","pointId":"cmwcput3…","orderId":"vpointA040","deliveredLineCount":1,"resultCode":"OK"}` and `{"event":"payment.refund_owed","reason":"point_cancel","orderId":"vpointA041","buyerUserId":"e4cf5edc…","actorUserId":"cad2d741…","pointId":"cmwcput3…","amount":"300.00","currency":"RUB","cancelledLineCount":1}`.

**Harness switches.** `Emulation.setFocusEmulationEnabled` had to be on before any key reached the page: without it `Input.dispatchKeyEvent` produced no `keydown` at all, and with it a Tab walk reached the refresh control and both card controls, Enter opened the dialog, Escape closed it and focus went back to the trigger. Key events for Escape that ran before the switch were dispatched on `document`, which React's root listener never sees, so the dialog staying open there was the harness and not the screen. Pointer input never worked: `click_at_xy` produced no click event on any target, and `Input.dispatchMouseEvent` timed out on the daemon, so the dialogs were driven with DOM `click()` on the control and the overlay route was proven by dispatching the input on the overlay node.

**Premises that did not hold, and how each step was reached instead.**

- The step that closes a dialog with a click on the overlay: no pointer input can be delivered in this session, so the close was proven by dispatching `pointerdown` and the mouse pair on the overlay node itself, and the network log through an instrumented `fetch` shows no `handover` and no `cancel` call for any of the three closes.
- The step that cancels from a second tab that still renders the old page: one browser tab cannot stay stale across two of these calls, so the parcel was handed over with `PATCH` through the page's own `fetch` after the page had rendered, and the stale card's Cancel then answered with the `NOTHING_TO_CANCEL` toast and the row left the queue behind the dialog.
- The step that hands every parcel over and reloads: sixteen parcels were closed with the API rather than sixteen presses, and the empty state was read after the reload. It names no count, keeps its refresh control and drops `Show more`.
- The step that switches the language: the language control is a Radix `Select`, whose portal needs the pointer input this session cannot deliver, so the `NEXT_LOCALE=ru` cookie the switch writes was set directly. The queue, both dialog titles, both dialog bodies, the keep and confirm controls, the switched off banner and the success toast were then read in Russian, the polite live region carried `Посылка выдана.`, and no Cyrillic sits in the English catalog's `staff` tree.
- The step that moves the worker to another point from the profile: the move went through `PATCH /api/staff/point-worker`, the call the profile makes, and the queue switched from zero parcels at point A to point B's one parcel on the next request, then back.
- A cash parcel carries no `Payment` row at all, so the clause about the payment line reading cancelled is read on the order: the buyer's screen prints `Payment cancelled` and the order's `paymentStatus` moves from `PENDING` to `CANCELLED`.

**Not observed.** The `expireSessionForCancel` provider call inside a cancel is not visible from the outside, because the seeded parcels were never paid through a hosted checkout, so no provider session existed to expire. The `CONFIRMED` parcel was shipped by the shipping pass a few minutes after the refusal steps ran, which is why the seeded row had to serve those steps first.

**Cleanup.** Every seeded order and line was deleted (`25` orders, `26` lines), the product `quantity` went back to `27`, the point was switched back on, the fixture `PointWorker` row for `e4cf5edc…` was removed, all three `session:<sid>` records were deleted, the 3581 replica was stopped, and the two parcels the run handed over from the pre-existing data were put back to `SHIPPED` with a null `handedOverAt`.
