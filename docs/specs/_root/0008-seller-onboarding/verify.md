# Verify: seller onboarding · spec 0008 · updated 2026-11-10

_Steps derived from spec 0008 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] Signed out, open `/seller/onboarding` → redirected to `/auth/signin` → AC-1
- [x] Open `/profile` as a confirmed non seller → the `Sell on Astrum` section sits after the profile form and before `Change password`, and its button links to `/seller/onboarding` → AC-2
- [x] Enter `  My   Shop  ` and submit → the navbar `Sales` item appears without a reload, a success toast shows, the success card shows `My Shop` and takes focus → AC-3, AC-4, AC-9, AC-15
- [x] Reload `/seller/onboarding` → the already sells screen links to `/seller/orders`, and `/profile` no longer shows the section → AC-2, AC-3
- [x] Enter `Cafe` plus the combining acute accent (`\u0301`) → the success card shows `Café` → AC-6
- [x] Enter `A` → an inline error under the field and no request leaves the page → AC-4, AC-6
- [x] Paste a name holding the right to left override (`\u202e`) → an inline error under the field → AC-6
- [x] Change the email in `/profile` so the account is `PENDING`, then open `/seller/onboarding` → the form is disabled with the confirmation notice, while `/seller/orders` still reads its queue → AC-3, AC-8
- [x] As a non seller, open `/seller/orders` → the not a seller screen carries the `Open your shop` action to `/seller/onboarding` → AC-12
- [x] Switch the language to Russian → the page, the profile section and the panel action read Russian → AC-11
- [x] At 360 px width, `/seller/onboarding` stacks in one column with no horizontal scroll → AC-15
- [x] Keyboard walk: Tab reaches the name input and the button, the focus ring is visible, Enter submits → AC-4, AC-15

## Commands

- [x] `docker exec astrum-db psql -U greedyghoster -d astrum-db -c "SELECT id, name, \"ownerUserId\" FROM \"Business\" ORDER BY \"createdAt\" DESC LIMIT 3;"` → one row for the account, carrying the normalized name → AC-5
- [x] `curl -i -X POST http://localhost:3580/api/seller/onboarding -H 'Content-Type: application/json' -H 'Cookie: __auth=<jwt>' -d '{"name":"Second Name"}'` → `200 {isSeller:true,"businessName":"<the first name>"}`, no new row and no rename → AC-7
- [x] The same call from a `PENDING` account → `403 EMAIL_NOT_CONFIRMED` and no row → AC-8
- [x] `diff packages/Astrum-db/prisma/schema.prisma apps/api-astrum/prisma/schema.prisma` → identical; `grep -c "model Business" apps/auth-astrum/prisma/schema.prisma apps/worker/prisma/schema.prisma` → `0` in both → AC-13
- [x] `pnpm quality-gate` → green → AC-14

## Acceptance-criteria coverage

- AC-1 → the signed out redirect step
- AC-2 → the profile section step and its absence after the shop opens
- AC-3 → the success, already sells, PENDING and failure steps
- AC-4 → the inline error, busy button, keyboard and ring steps
- AC-5 → the psql row step
- AC-6 → the NFC, one character and right to left override steps
- AC-7 → the repeated call step
- AC-8 → the PENDING page step and the 403 call
- AC-9 → the navbar flip and success card step
- AC-10 → the inline error, confirmation toast and retry steps
- AC-11 → the Russian switch step
- AC-12 → the panel action step and the disabled screen
- AC-13 → the schema diff and Business count steps
- AC-14 → `pnpm quality-gate`
- AC-15 → the 360 px and keyboard steps

## Run notes (2026-11-10)

Fixtures: fresh accounts were provisioned through the real path (register, the letter read from Mailpit, confirm, signin) and the session was placed in the `__auth` cookie, because this harness must not type a password. The gateway runs on 3580, the storefront on 3000, the account status was flipped with SQL or with `PATCH /api/users/me` (a new address returns the account to `PENDING`), the same action the profile page performs.

Degraded paths: with Postgres stopped the onboarding call answers `503 ACCOUNT_STATUS_UNAVAILABLE` in 109 ms. A temporary `CHECK` constraint on `Business.name` produced the `500` branch with no row, and the constraint was dropped right after the call.

Not observed live:
- the loading skeleton: the profile answers on localhost before a sample lands, so the branch never stays on screen (it is covered by the page states suite);
- the retry click on the failure screen: the screen and its control rendered twice with the database down, the revalidation mechanism itself was proven by the navbar `Sales` item appearing after `mutateProfile()`;
- the server `422` branch of the form: the client schema refuses an invalid name first, so the request never leaves the page; the `422 VALIDATION` body and its `name` field error were proven through the API.

Keyboard: `Tab` only moves focus in this harness with `Emulation.setFocusEmulationEnabled` on. With it, Tab reached the field and the button (3 px ring on both, 32 px button) and Enter submitted the form.
