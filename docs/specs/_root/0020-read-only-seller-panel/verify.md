# Verify: read only seller panel · spec 0020 · written 2026-11-14

_Steps derived from spec 0020 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

**Verdict: PASS** (run of 2026-11-15 on the dev stack). Every behaviour below was exercised against the running app; one clause of AC-7 could not be reached through the panel's own controls and is recorded under Premise corrections instead of being ticked. Details and the fixtures of the run are in Run notes.

Fixtures the steps assume:

- one `ACTIVE` account that owns a `Business` with at least two orders, each order carrying two lines of different products and a `CONFIRMED` or `SHIPPED` line, so the line action has something to refuse;
- one of those orders a pickup order with a `handedOverAt` stamp and a pickup point name and address, so the band has every fact to print;
- one of those orders paid online (`paymentMethod` `ONLINE_CARD`, `paymentStatus` not `PAID`), so the payment badge renders;
- one `ACTIVE` account that owns a `Business` with no order lines, for the empty state. `pnpm db:assign-business <email>` from spec 0007, AC-14 gives a business to an account with none;
- a second page of orders (21 or more), so the last page fallback and the pagination controls can be walked.

`POST /api/auth/register` answers `500` for a fresh address (a bug carried in the scope `Deferred` list), so if an account is missing, insert it with an argon2 hash of a known password as the spec 0019 walk did.

The dev stack (`pnpm dev`) runs on 3000, 3580, 4580 and 5580. A second gateway on 3581 is started only to read the structured log lines, because the dev stack's stdout belongs to the terminal that started it. The database client is derived from the running container rather than from `.env`:

```bash
PSQL="docker exec astrum-db psql -U greedyghoster -d astrum-db"
API="http://localhost:3580"
```

Sessions are minted with `POST /api/auth/signin` and sent as `-H "Cookie: ***"`; no step echoes the value.

## UI / manual

- [x] Sign in as the seller and open `/seller/orders` → one table fills the page, its head reads `Заказ`, `Товар`, `Сумма`, `Дата`, `Статус` in that order (English: `Order`, `Product`, `Subtotal`, `Date`, `Status`), and each order opens with a band followed by its lines, the page header above the table prints the title, the subtitle and the order count, and the table carries an accessible name → AC-1
- [x] Read the first line row → the product name carries the quantity (`Widget × 3`), the amount equals the product of that quantity and the unit price, the date is the order's placed date and time in the browser zone, and the status is the line status label → AC-3, AC-4
- [x] Read the band of the pickup order → it prints the order number (last 8 characters of the id, with the full id as the title), the payment badge, the status counts, the point name with its address, and the handover date; it prints no date of its own → AC-2
- [x] Read the band of the online unpaid order → the payment badge prints the payment status through the shared label map, not the raw enum value → AC-2
- [x] Look at every row and the band → no handover button, no per line control, no dialog, no `Действия` column, and no buyer name, email or phone anywhere → AC-1, AC-5, AC-6
- [x] Press `Далее` and `Назад`, and check the last page → the previous rows stay under a loading strip while the next page loads, `Назад` is disabled on page 1 and `Далее` on the last page → AC-7
- [ ] With 21 or more orders, open the last page, cancel nothing and reload on a page that stopped existing (drop one order from the database while the page reads) → the panel requests the last existing page instead of printing a page number past the end → AC-7 — premise corrected, see Premise corrections 3
- [x] Sign in with the account that owns a business with no lines and open `/seller/orders` → the empty state renders with no table and no pagination → AC-7
- [x] Stop the gateway, reload the page, then start it again and press `Повторить` → the failure screen renders with its retry control, and the retry fills the table → AC-7
- [x] Throttle the network to 1500 ms in the browser devtools and open the page → the skeleton renders first, with the loading label in the accessibility tree, and never together with the empty state → AC-7
- [x] Narrow the window to 360 px → the head row disappears, each row becomes a card inside its band, every value carries a visible label, and the page scrolls sideways nowhere → AC-8
- [x] Reach the pagination controls and `Повторить` with Tab → every control takes focus, the focus ring is visible, and each is at least 32 px high → AC-8
- [x] Switch the language to Russian and walk the table, the band and the states → every string is Russian, with no literal English left in the panel → AC-11, AC-12
- [x] Sign in with a `PENDING` account that owns a business and open the panel → the table renders, the confirm banner sits above it, and the panel carries no notice of its own about statuses → AC-7

## Commands

- [x] `md5sum packages/Astrum-db/prisma/schema.prisma apps/api-astrum/prisma/schema.prisma apps/auth-astrum/prisma/schema.prisma apps/worker/prisma/schema.prisma` → four identical hashes, unchanged from `HEAD`, because this feature edits no schema → AC-10 — the four are identical (`b0f13d2e…`); they differ from `HEAD` because specs 0017 and 0018 add their staff models in the same working tree, see Premise corrections 1
- [x] `curl -s "$API/api/seller/orders?page=1&limit=20" -H "Cookie: ***" | python -c "import sys,json; d=json.load(sys.stdin); o=d['orders'][0]; print(sorted(o.keys())); print(sorted(o['orderItems'][0].keys()))"` → the order keys are exactly `createdAt, handedOverAt, id, isPickup, orderItems, paymentMethod, paymentStatus, pickupPointAddress, pickupPointId, pickupPointName` and the line keys are exactly `currency, id, name, previewImage, price, quantity, productId, status`, with no `userId` on either → AC-6
- [x] `curl -s "$API/api/seller/orders" -H "Cookie: ***" | python -c "import sys,json; d=json.load(sys.stdin); print(d['total'], d['page'], d['limit'], d['totalPages'])"` → `total` above zero, `page: 1`, `limit: 20`, `totalPages` at least 2 → AC-1
- [x] `curl -s -o /dev/null -w '%{http_code}\n' -X PATCH "$API/api/seller/orders/<orderId>/handover" -H "Cookie: ***"` → `404` → AC-9
- [x] `curl -s -X PATCH "$API/api/seller/orders/<orderId>/handover" -H "Cookie: ***"` → `{"code":"SELLER_PANEL_READ_ONLY","message":"Seller writes were removed; the panel is read only."}`, with no stack and no database detail → AC-9
- [x] `curl -s -o /dev/null -w '%{http_code}\n' -X PATCH "$API/api/order-items/<orderItemId>/status" -H "Cookie: ***" -H 'Content-Type: application/json' -d '{"status":"CANCELLED"}'` → `404`, and `curl -s` on the same call prints `code: "SELLER_PANEL_READ_ONLY"` → AC-9
- [x] `$PSQL -c 'SELECT id, status, "receiptDate" FROM "OrderItem" WHERE "orderId" = $$<orderId>$$;'` before and after the two refused calls in the steps above → the same rows, the same statuses, the same `receiptDate` values, so nothing was written → AC-9
- [x] `$PSQL -c 'SELECT "handedOverAt" FROM "Order" WHERE id = $$<orderId>$$;'` before and after the refused handover → the same value (a timestamp for the delivered order, `null` for the other), so the refusal never stamps a handover → AC-9
- [x] `$PSQL -c 'SELECT quantity FROM "Product" WHERE id = $$<productId>$$;'` before and after a refused `CANCELLED` request on a line of that product → the same quantity, so no stock came back → AC-9
- [x] `curl -s -o /dev/null -w '%{http_code}\n' -X PATCH "$API/api/order-items/<orderItemId>/status"` with no cookie → `401`, before any handler runs → AC-9
- [x] On the second gateway, send both refused calls and read its output → two lines with `"event":"seller.write_refused"`, one carrying `orderId` and one `orderItemId`, each with the account id, the method and the path, and neither carrying a body, a cookie or a token → AC-9
- [x] `grep -rn "useSellerHandover\|useSellerOrderItemStatus\|SELLER_LINE_ACTIONS\|sellerLineActions\|handoverableCount\|pageWithGroup\|pageWithLine" apps/customer/src` → no output → AC-5, AC-11
- [x] `grep -rn "useUser\|profileData" apps/customer/src/features/pages/SellerOrders` → no output, because the page reads no profile any more → AC-7
- [x] `ls apps/customer/src/features/pages/SellerOrders apps/customer/src/features/pages/SellerOrders/lib apps/customer/src/hooks/seller` → no `SellerOrderGroup`, no `SellerOrderLine`, no `LineActions`, no `actionMap.ts`, no `handover.ts`, no `pageData.ts`, no `refusals.ts`, no `grid.ts`, no `useSellerHandover.ts`, no `useSellerOrderItemStatus.ts`, and the suites that covered them are gone while `lib/format.ts` stays → AC-11
- [x] `python -c "import json; s=[json.load(open('apps/customer/messages/%s.json'%l,encoding='utf-8'))['seller'] for l in ('en','ru')]; print(sorted(s[0])==sorted(s[1])); print([k for k in ('handover','handoverTitle','handoverText','handoverCourierText','handoverConfirm','handoverBusy','handoverKeep','actions','dialog','toasts','pendingTitle') if k in s[0] or ('states' in s[0] and k in s[0]['states']) or ('columns' in s[0] and k in s[0]['columns'])])"` → `True` and `[]`, so both catalogs agree and every removed key is gone → AC-11
- [x] `grep -rn "seller\.toasts\|seller\.dialog\|seller\.actions\|states\.pendingTitle\|states\.pendingText\|columns\.quantity\|columns\.unitPrice\|columns\.actions" apps/customer/src apps/customer/messages` → no output → AC-11 — one hit exists at `features/pages/Orders/OrderPage/components/OrderItemsCard`, which reads the `orders` namespace of the buyer screen, not `seller`
- [x] `grep -rn "columns\.orderNumber\|columns\.date" apps/customer/src apps/customer/messages` → at least one reader per new key and one entry per catalog → AC-1, AC-11
- [x] `grep -rn "ALLOWED_LINE_TRANSITIONS\|handOverOrder\|updateSellerOrderItemStatus\|runHandover\|applyOrderItemStatus\|UpdateOrderItemStatusDto" apps/api-astrum/src` → no output, so the write machinery is gone everywhere and the DTO fixture points at `UpdateOrderStatusDto` instead → AC-10 — `runHandover` still answers in `modules/staff/point-order.service.ts`, which is the staff handover of spec 0018 and not the seller service, see Premise corrections 2
- [x] `pnpm --filter @astrum/api test` → green, and the run reports fewer suites than `HEAD` did, with the three write suites absent → AC-10, AC-12 — 48 suites passed, 389 tests passed, 5 suites and 20 tests skipped for want of the live stack
- [x] `ORDER_DB_TESTS=1 pnpm --filter @astrum/api test` → green, including `pickup-handover.integration.spec.ts` and the narrowed `seller-order.integration.spec.ts` → AC-10, AC-12 — 53 suites passed, 409 tests passed, exit 0
- [x] `pnpm --filter @astrum/customer test` → green, including `i18n/__tests__/messages.test.ts` over the trimmed catalogs → AC-11, AC-12 — 66 files, 365 tests
- [x] `pnpm quality-gate` → green on every task → AC-12 — 18 of 18 tasks, exit 0, 11 lint warnings and no error

## Premise corrections

1. **The four schema copies against `HEAD`.** The step expects "four identical hashes, unchanged from `HEAD`". The four are identical, but they carry 28 added lines each, which belong to the staff models and the courier claim of specs 0017 and 0018 built in the same uncommitted tree. Spec 0020 adds no migration and no model, so the clause "unchanged from `HEAD`" cannot hold until that work is committed; the property this feature owns (the four stay byte identical) is proven.
2. **`runHandover` is not gone from the tree.** AC-10 removes the seller write methods by name, and `runHandover` is one of them; the same name also lives in `modules/staff/point-order.service.ts`, the handover of spec 0018 that this feature keeps. The grep therefore answers two lines, neither of them the seller service: the staff method, and two assertions in `seller-order.service.spec.ts` that the seller service no longer holds `handOverOrder` and `updateSellerOrderItemStatus`.
3. **The last page fallback cannot be walked from the panel.** The step assumes a reload can land on a page that no longer exists. The page number is component state (`useState(1)`), never in the URL, so a reload always mounts page 1, and `Далее` is disabled whenever the shown page is the last one, so the panel can never ask for a page past the end by a click. A synthetic reconnect (`window.dispatchEvent(new Event('online'))`) does not revalidate either, because the hook sets `revalidateOnFocus: false` and nothing else revalidates while mounted; the count of `fetch` calls stayed at zero after the event. The input the effect was written for is real and was proven at the API: `GET /api/seller/orders?page=3&limit=20` answers `{page: 3, total: 21, totalPages: 2, orders: []}`, exactly the "no rows and `total` above zero" answer. The clause "never renders `Page 3 of 2`" therefore holds for the user, and the effect stays an unexercised guard, not a proven behaviour.

## Run notes · 2026-11-15

**How the panel was driven.** The dev stack was already up on 3000/3580/4580/5580, so nothing was started for it. The seller was `verify-seller-1794154696799@example.com`, whose password was unknown, so its `passwordhash` was replaced with an argon2 hash of `Test123!` for the run and put back byte identical afterwards (the unknown hash was saved first and restored last). `POST /api/auth/signin` answers a token and no cookie, so the browser was given `__auth` through `Network.setCookie` instead of the sign in form; the form itself did not complete under the harness (its submit left the page on `/auth/signin` with the fields empty), which is a harness limit and not a product finding, because the same credentials sign in at the API in the same run.

**Fixtures added and removed.** The chosen business (`biz_excel_10`, 21 orders) had no pickup order that was also unpaid, so order `cmwgb8j2w000088vdetnnbdis` (`ONLINE_CARD`, pickup point Lenina) got `paymentStatus` set to `PENDING` and a `handedOverAt` stamp, and one extra line `verify0020-line-2` (Кроватка Polini Basic 140x70, quantity 2, price 11715.00, `previewImage` empty) was inserted into it. That one band then printed the number, the payment badge, both status counts, the point with its address, the handover date, and the two rows under it, one of them without an image so the `Package` fallback rendered, and one with quantity 2 so the sum could be checked (`₽23430.00` against `11715.00`). All of it was undone at the end: the line deleted, `paymentStatus` back to `PAID`, `handedOverAt` back to `null`, and the order count back to 100 with none of the scratch rows left.

**Accounts touched.** `verify-empty-1794155732383@example.com` (empty business) and `review.check.2026@example.com` (no business, for the not a seller screen) each got the same temporary password hash, and both hashes were restored. `verify-seller-1794154696799@example.com` was flipped to `PENDING` for the last UI step and back to `ACTIVE` in the same pass.

**The order deleted to reach the fallback.** `cmw81gm6w000kiovdlnhtph1j` (the only order on page 2) was copied into `zz_v20_order` and `zz_v20_item`, deleted to shrink the list to 20, and put back from those copies; both scratch tables were dropped. It carried no `Payment` and no `Review` row.

**The second gateway.** The dev gateway's stdout belongs to the terminal that started it, so a second instance was started on 3581 from `apps/api-astrum` with the same env and its output captured to a file. Two refused calls against it produced exactly the two lines AC-9 asks for:

```json
{"level":"warn","time":"…","event":"seller.write_refused","userId":"a7c7f855-…","method":"PATCH","path":"/api/seller/orders/cmwgb8j2w000088vdetnnbdis/handover?probe=1","orderId":"cmwgb8j2w000088vdetnnbdis"}
{"level":"warn","time":"…","event":"seller.write_refused","userId":"a7c7f855-…","method":"PATCH","path":"/api/order-items/cmwgb8j31000288vdg730zb00/status","orderItemId":"cmwgb8j31000288vdg730zb00"}
```

No body, no cookie and no token in either line, and the query string stayed in `path`. A first attempt started through `npx` wrote no log line to the captured file although it answered the same `404`, so the instance that produced these lines is the one started from the local `tsx` binary. The second gateway was stopped at the end of the session.

**Switches the run needed.** `Network.emulateNetworkConditions` with a 1200 to 2500 ms latency to catch the skeleton and to keep the previous rows on screen during a page change; `Network.setBlockedURLs(['*seller/orders*'])` stood in for a stopped gateway, because the dev gateway also serves the rest of the stack, and clearing the block plus `Повторить` filled the table; `Emulation.setDeviceMetricsOverride` at 360 x 800 for the narrow width; `Emulation.setFocusEmulationEnabled` before every Tab walk, because synthetic key events move no focus without it.

**Not observed.** The empty band cell (AC-2's "renders empty when none of them applies"): every order in the fixture has at least one line, so `countLinesByStatus` always prints a badge and the empty branch never renders. The last page fallback: see Premise corrections 3.

**A pre-existing shape worth knowing.** `formatMoney` prints the currency glyph and the plain `toFixed(2)` amount, so the price cell reads `₽4129.40` with no thousands separator. That is the project helper of spec 0007 as it stands, and spec 0020 AC-4 asks the panel to call it, so the cell conforms; the missing separator is the helper's own behaviour, not this feature's.
