# 2026-11-10 · Seller onboarding

Spec: [0008-seller-onboarding](../specs/_root/0008-seller-onboarding/index.md).

## Added

- `apps/customer/src/app/(content)/seller/onboarding/page.tsx`, the `/seller/onboarding` route inside the
  content group, so the page arrives with the storefront navbar, the footer and the confirmation banner,
  and the session guard in `src/proxy.ts` protects it. The page adds no second session check of its own.
- `apps/customer/src/features/pages/SellerOnboarding/index.tsx`, the page itself: a skeleton while the
  profile loads, a failure screen with a retry that revalidates the profile, the form, the same form with
  the field and the button off plus a confirmation notice for a `PENDING` account, the already sells screen
  with a link to `/seller/orders`, and the success card carrying the stored shop name. `resolveOnboardingState`
  keeps exactly one of them on screen, and the success card wins over the already sells screen for the rest
  of that visit. A successful call awaits `mutateProfile()`, moves focus to the success heading and
  announces the card as a status message.
- `apps/customer/src/common/zodSchemes/shop-name.scheme.ts`, the client name rule: NFC, trim, collapse every
  whitespace run, refuse control and invisible format characters, count code points, 2 to 60. The copy is
  wired into the form so an invalid value shows inline text under the field and sends nothing.
- `apps/customer/src/features/pages/SellerOnboarding/nameCases.ts`, one table of twelve name cases read by
  both the storefront schema and the gateway DTO, so the two rules cannot drift.
- `apps/customer/src/hooks/seller/useBecomeSeller.ts`, one mutation over `postItem` for
  `POST /seller/onboarding`, with a busy flag and the raw error, exported through `hooks/seller/index.ts`.
- `apps/customer/src/features/pages/Profile/actions/SellOnAstrum/index.tsx`, the `Sell on Astrum` section on
  the profile, rendered after the profile form and before the password form, only while the profile has
  loaded and reads `isSeller: false`.
- `POST /api/seller/onboarding` in `apps/api-astrum/src/modules/seller/`: the router mounts
  `requireActiveAccount`, then `validateDto(CreateOnboardingDto)` answering `422 VALIDATION`, then the
  controller, and it joins the existing `app.use("/api", authenticateToken, sellerOrderRoutes)` line, so one
  request passes one `authenticateToken`. The answer is `200 { isSeller: true, businessName }`.
- `apps/api-astrum/src/modules/seller/onboarding.service.ts`, one shop per account: the first call creates a
  `biz_` row with the normalized name and writes one `seller.onboarding.completed` log line; a repeat, and a
  lost race on the unique index (`P2002`), answer from a fresh read of the winner row, create nothing and
  rename nothing.
- `apps/api-astrum/src/modules/seller/shop-name.ts`, the name rule without decorators and without framework
  imports, so the DTO and its spec run the same function.
- `Business.name` as a required column in `packages/Astrum-db/prisma/schema.prisma` and in the copy under
  `apps/api-astrum`, which stays byte identical. The migration `20261109120000_business_name_required` adds
  the column as nullable, backfills `Shop ` plus the last 6 characters of `id`, then sets `NOT NULL`.
- The action on the not a seller state of the panel: the `Open your shop` button links to
  `/seller/onboarding`.
- The `seller.onboarding` block in `apps/customer/messages/en.json` and `messages/ru.json` (21 strings plus
  an `errors` block of 4), four `validation` keys for the name rule and the new panel action label.
- Tests: `apps/api-astrum/src/modules/seller/onboarding.service.spec.ts` (5),
  `onboarding.routes.spec.ts` (5, among them the handler order `requireActiveAccount` first and a `PENDING`
  call carrying an invalid body answered `403`), `dto/create-onboarding.dto.spec.ts` (7),
  `apps/customer/src/features/pages/SellerOnboarding/SellerOnboarding.test.tsx` (7),
  `Profile/Profile.test.tsx` (4), `SellerOrders/SellerOrders.test.tsx` (2),
  `hooks/seller/useBecomeSeller.test.tsx` (4) and `SellerOnboarding/nameCases.test.ts` (3).

## Changed

- `apps/customer/src/features/pages/Profile/index.tsx` renders the seller section between the two existing
  forms and renders nothing while the profile loads or fails, so no placeholder flashes.
- `apps/customer/src/features/pages/SellerOrders/index.tsx` hands an action to the not a seller screen, and
  the disabled screen copy in both catalogs no longer tells the seller to ask an operator.
- `packages/Astrum-db/scripts/assignBusiness.ts` names the shop it creates in the branch with no free
  business (`Shop ` plus the last 6 characters of the new id), so the script still works against the
  required column.
- The order and seller order integration fixtures set a name on every `business.create` and
  `business.createMany` call.
- `apps/customer/src/common/zodSchemes/index.ts` and `apps/customer/src/features/pages/Profile/actions/index.ts`
  export the two new modules.
- `docs/scope/_root/scope.md` gains slice 8 with feature 13, `docs/scope/index.md` follows with the new
  rollup, and both README files carry the feature and its roadmap line.

## Verified

- `pnpm quality-gate` on 2026-11-10: 18 of 18 tasks green (15 from the turbo cache). Customer 90 tests in
  20 files, api 124 passed and 10 skipped (20 suites passed, 2 skipped), auth 44, worker 26, db 1. Lint
  reports 8 warnings and no error.
- All 17 steps of [verify.md](../specs/_root/0008-seller-onboarding/verify.md) were closed against the live
  storefront and gateway on 2026-11-10. Among them: `  My   Shop  ` was stored as `My Shop`; `Cafe` with a
  combining acute accent was stored as `Café`; one character and a name holding the right to left override
  were refused inline with no request leaving the page; the navbar `Sales` item appeared without a reload
  and the success card took focus; a repeat call carrying `Second Name` answered `200` with the first name,
  no new row and no rename; a `PENDING` account got `403 EMAIL_NOT_CONFIRMED` and created no row while its
  seller panel still read its queue; the two schema copies are identical and neither auth nor worker carries
  a `Business` model; at 360 px the page stacked in one column with no horizontal scroll, and the Russian
  screen read Russian.
- Both catalogs counted on 2026-11-10: 411 keys each, with no key present on one side only.
- Degraded paths seen live with the database stopped: the call answers `503 ACCOUNT_STATUS_UNAVAILABLE` in
  109 ms, and a temporary `CHECK` constraint on `Business.name` produced the `500` branch with no row.

## Open

- The loading skeleton and the retry click on the failure screen were never held on screen during the live
  pass, because the profile answers on localhost before a sample lands. Both are covered by the page states
  suite.
- The server `422` branch of the form never ran in the browser: the client schema refuses an invalid name
  first. The `422 VALIDATION` body and its `name` field error were proved through the API instead.
- The seller panel stays empty after onboarding until a seller facing product screen ships. This change
  delivers the door, not the stock.
- The name is stored and shown only on the success card, and no other screen reads it yet. No reserved name,
  impersonation or moderation rule applies until the shop profile spec.
- No screen lets a seller rename the shop or stop selling, and the assignment script now differs from
  onboarding: the script reuses a seeded shop, onboarding always creates a new one.
- `packages/Astrum-db/AGENTS.md` and `apps/worker/AGENTS.md` still call the auth and worker schemas byte
  identical to the shared one. They are trimmed subsets with no `Business` model.
