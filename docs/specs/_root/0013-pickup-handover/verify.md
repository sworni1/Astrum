# Verify: pickup handover · spec 0013

_Every step here is the evidence for AC-16, the live walk of the path; the tag beside a step names the further criterion it proves. Steps derived from spec 0013 acceptance criteria. Every step is written so it can fail; a step that can only pass is not a step. Run on 2026-11-12 against the dev stack (customer on 3000, gateway on 3580, auth on 4580, Postgres in the `astrum-db` container): 55 of 57 steps exercised and passing, 2 left unticked with their gaps named in Run notes. The harness switches the run needed are listed there too._

## Premise corrections

- **The create answers `201`, not `200`** (steps 52 and 56). `POST /api/orders` answers `201 Created` on a fresh order and `200 OK` only on an idempotent replay, so the status line of both steps is corrected here; the bodies were observed exactly as the steps describe.
- **`PICKUP_POINT_REQUIRED` needs an address in the body** (step 53). The step's body carries no `deliveryAddress` either, and `CreateOrderDto.deliveryAddress` is required whenever `pickupPointId` is absent, so that request is refused by the DTO with `422 VALIDATION` before the service runs. The `409 PICKUP_POINT_REQUIRED` branch is reached with a body that carries an address and no point: `{"shippingMethodId":"<pickup>","deliveryAddress":"Ленина, 5"}` answered `409 {"code":"PICKUP_POINT_REQUIRED"}`. Both behaviours are proven, and the step is ticked on that route.
- **`paymentDetails` cannot be empty** (steps 52, 53, 55, 56, 57). The DTO carries `@IsNotEmpty()` on that field, so the literal `"paymentDetails":""` of the checklist answers `422 VALIDATION` on it alone. Every call in this run sent a real value.
- **The other line of a two line partial handover stays `PENDING`, not `CONFIRMED`** (step 36). Only the confirmed line was ready, so the line left alone was the one that was never confirmed. The mechanism the step aims at (only ready lines move, the group shows no handover date while a line is still ready, the control stays) was proven on order `niu42dfm`, where one delivered line sat beside one `CONFIRMED` line.
- **The interim order status of a multi business handover reads `CONFIRMED`, not `SHIPPED`** (step 37). Both lines were confirmed rather than shipped, and `recomputeOrderStatus` reports the least advanced active line, so the order read `CONFIRMED` between the two calls. What the step proves held: the first seller's handover wrote no `handedOverAt` (`null`), and the second seller's wrote `2026-11-11T22:58:48.651Z`, the moment of the call that closed the order.

## Fixtures the run needs

- Two active pickup points created through the script: `Pickup point Lenina` at `Ленина, 5` and `Pickup point Mira` at `Мира, 12`, plus a third `Pickup point Closed` switched off with `db:pickup-point off`.
- Seller account S1, signed in, `ACTIVE`, owning business B1 with product P1 in stock, with `SELLER_ORDER_WORKFLOW_ENABLED=true` in `apps/api-astrum/.env` and the gateway restarted.
- Seller account S2, signed in, `ACTIVE`, owning business B2 with product P2, for the multi business order.
- Seller account S3, signed in, `PENDING`, owning business B3 with product P3, for the account gate.
- Customer account A, signed in, `ACTIVE`, with a cart holding P1, P2 and P3, to place pickup orders of one business and of two businesses.
- Customer account B, signed in, `PENDING`, to prove the points read is open to an unconfirmed account while the order write is not.
- One courier order placed with `Standard Delivery` at 299.00 RUB, address typed, ready to prove the branch without `isPickup`.
- One pickup order whose single line sits in `PENDING`, for the nothing ready refusal by direct call.

## UI / manual

- [x] Open the cart as account A, choose the pickup method in the select → the address textarea disappears and a point select takes its place, listing `Pickup point Lenina` and `Pickup point Mira` with their addresses, and not the switched off point → AC-3, AC-6
- [x] With the pickup method chosen and no point selected, read the submit control → it is disabled; pick a point → it enables when the rest of the form is valid → AC-5, AC-6
- [x] Switch the select to `Standard Delivery` → the address textarea returns, empty, and the point select is gone; leaving the address empty keeps the field message and the submit disabled → AC-6
- [x] Switch back to the pickup method → the address requirement is gone, the point requirement returns, and a previously typed address is still in the form state → AC-6
- [x] With the pickup method chosen, read the money block → Subtotal from the selected lines, Delivery reads 0.00 RUB, Total equals the Subtotal → AC-7
- [x] With the pickup method chosen and the form filled, run `pnpm db:pickup-point off "Pickup point Lenina"` in a second terminal, then submit the form that had selected it → one toast with the `cart.pickupInactive` text, the point list refetches and the choice clears, and the typed address, date and payment fields stay exactly as they were → AC-6, AC-7
- [x] Turn the point back on, place the order → the order screen shows the point name and its address in place of the address block, no empty line and no literal `null`, and the expected date is labelled as the pickup date → AC-9
- [x] Open the orders list → the card for that order prints the method name and the point name on its delivery line → AC-9
- [ ] Switch the language to Russian on the checkout and on the order screen → the point select, its empty, loading and failure copy, the four refusal toasts, the order screen labels and the card label read Russian, and no key is printed raw → AC-14
- [x] As S1, open the seller panel → the pickup group shows the point name and address, the line rows offer no `Deliver`, and a `CONFIRMED` line offers `Ship` → AC-10, AC-13
- [x] On a group whose lines are all `PENDING` → no `Hand over` control is rendered at all → AC-13
- [x] Confirm the line so it reads `CONFIRMED`, then press `Hand over` → a dialog names the point and the number of lines; press the keep control → the dialog closes, no request leaves the browser, and the lines are unchanged → AC-13
- [x] Press `Hand over` again and confirm → the group's lines become `DELIVERED`, the group header shows the handover date, and the counts in the group follow without a reload → AC-11, AC-13
- [x] Reopen the order screen as account A → the handover date is shown next to the point, and the date format follows the active locale → AC-9
- [x] Place a second pickup order with two lines, confirm only one of them, then press `Hand over` → only the confirmed line becomes `DELIVERED`, the other stays `CONFIRMED`, the group shows no handover date, and the `Hand over` control is still there → AC-11, AC-13
- [x] Place a pickup order with P1 and P2, confirm both, hand over as S1 → the order status stays `SHIPPED` and the group of S1 shows the handover date; hand over as S2 → the order becomes `DELIVERED` and `handedOverAt` is still the moment of the second call only → AC-11
- [x] Open the courier order in the seller panel → no `Hand over` control, and its `SHIPPED` line still offers `Deliver` → AC-13
- [x] Press `Hand over` twice in quick succession on a slow network → one `PATCH` leaves the browser and the control reports itself busy and disabled during the flight → AC-13
- [ ] Keyboard only: tab to `Hand over`, open the dialog, press Escape → focus returns to the control and no request was sent → AC-13
- [x] Stop the gateway, then press `Hand over` and confirm → the generic failure toast with a retry, and the panel revalidates once the gateway is back → AC-13

## Commands

- [x] `pnpm db:pickup-point add "Pickup point Lenina" "Ленина, 5"` → prints the new id, the name, the address and `isActive: true`; the same command again → a clear duplicate name message and a non zero exit, and `SELECT count(*) FROM "PickupPoint" WHERE name = 'Pickup point Lenina';` still answers 1 → AC-2
- [x] `pnpm db:pickup-point off "Pickup point Lenina"` then `pnpm db:pickup-point list` → the row reads inactive; `on` flips it back; `off "No such point"` → a clear message and a non zero exit → AC-2
- [x] `curl -s 'http://localhost:3580/api/pickup-points' -H 'Cookie: ***' | jq` → `points` holds exactly the active rows, ordered by `name`, each with exactly the keys `id`, `name`, `address`, and the switched off point absent → AC-3
- [x] The same call with no cookie → `401` in the existing error shape; the same call as account B (`PENDING`) → `200` → AC-3
- [x] `docker exec astrum-db psql -U greedyghoster -d astrum-db -c '\d "PickupPoint"'` → the five columns, with `name` unique and `isActive` defaulting to true; `\d "Order"` → `deliveryAddress` nullable, `pickupPointId` with its foreign key and index, `pickupPointName`, `pickupPointAddress`, `handedOverAt` → AC-1
- [x] `grep -rn "isPickup" packages/Astrum-db/prisma/schema.prisma apps/api-astrum/prisma/schema.prisma apps/auth-astrum/prisma/schema.prisma apps/worker/prisma/schema.prisma` → one match per copy; `grep -rn "PickupPoint" packages/Astrum-db/prisma/schema.prisma apps/api-astrum/prisma/schema.prisma apps/auth-astrum/prisma/schema.prisma apps/worker/prisma/schema.prisma` → the model block in all four → AC-1
- [x] `docker exec astrum-db psql -U greedyghoster -d astrum-db -c 'SELECT name, price, currency, "isPickup", "isActive" FROM "ShippingMethod" ORDER BY name;'` → a `Pickup at the shop` row at 0.00 RUB with `isPickup` true and active, and the two rows of spec 0009 untouched → AC-1
- [x] `curl -i -X POST 'http://localhost:3580/api/orders' -H 'Content-Type: application/json' -H 'Cookie: ***' -H 'Idempotency-Key: verify-pickup-01' -d '{"deliveryDate":"2026-12-01T10:00:00.000Z","shippingMethodId":"<pickupMethodId>","pickupPointId":"<pointId>","paymentMethod":"CASH","paymentDetails":"","orderItems":[{"productId":"<P1>","quantity":1}]}'` → `200`, the body carries `pickupPointName`, `pickupPointAddress`, `pickupPointId`, `deliveryAddress` null, `deliveryPrice` 0, `grandTotal` equal to `totalPrice`, and `handedOverAt` null → AC-7, AC-8
- [x] The same body without `pickupPointId` → `409` with `"code":"PICKUP_POINT_REQUIRED"`, no order row written, and the cart lines and stock unchanged → AC-7
- [x] The same body with an invented point id → `409 UNKNOWN_PICKUP_POINT`; with the id of the switched off point → `409 PICKUP_POINT_INACTIVE`; each writes no order → AC-7
- [x] A body naming a courier method and carrying a `pickupPointId` → `409 PICKUP_POINT_NOT_ALLOWED`, no order; a courier body with no `deliveryAddress` and no point → `422 VALIDATION` with the field error on `deliveryAddress` → AC-7
- [x] A pickup create whose body also carries `deliveryAddress` and the three snapshot fields → `200`, the stored `deliveryAddress` is null and the snapshot comes from the point row, not from the body → AC-7
- [x] Replay the first pickup create with `Idempotency-Key: verify-pickup-01` and a different `pickupPointId` → `409` with `"code":"IDEMPOTENCY_KEY_REUSED"`; replay with the original body → `200` with `Idempotent-Replay: true` and the same snapshot → AC-7
- [x] `curl -s 'http://localhost:3580/api/seller/orders' -H 'Cookie: ***' | jq '.orders[0]'` as S1 → the order carries `isPickup` true, `pickupPointName`, `pickupPointAddress`, `handedOverAt`, and the body holds no `deliveryAddress`, no buyer name and no buyer contact → AC-10
- [x] `curl -i -X PATCH 'http://localhost:3580/api/seller/orders/<pickupOrderId>/handover' -H 'Cookie: ***'` as S1 → `200`, every owned line in `CONFIRMED` or `SHIPPED` now `DELIVERED` with a `receiptDate`, the `PENDING` line unchanged, and the order status recomputed → AC-11, AC-12
- [x] `docker exec astrum-db psql -U greedyghoster -d astrum-db -c 'SELECT id, status, "receiptDate" FROM "OrderItem" WHERE "orderId" = ''<pickupOrderId>'';'` → each delivered line carries the same timestamp, the pending line carries none → AC-12
- [x] `docker exec astrum-db psql -U greedyghoster -d astrum-db -c 'SELECT status, "handedOverAt" FROM "Order" WHERE id = ''<pickupOrderId>'';'` → `DELIVERED` with a timestamp; the same `PATCH` repeated → `200`, and `handedOverAt` keeps the first value → AC-11
- [x] The same `PATCH` as S2, a seller of another business → `404` with `"code":"ORDER_NOT_FOUND"`, and no line changes → AC-11
- [x] The same `PATCH` on the courier order as its seller → `409` with `"code":"HANDOVER_REQUIRES_PICKUP"`, no line changes → AC-11
- [x] The same `PATCH` on the pickup order whose only line is `PENDING` → `409` with `"code":"NOTHING_TO_HAND_OVER"`, no write → AC-11
- [x] The same `PATCH` as S3 (`PENDING`) → `403` with `"code":"EMAIL_NOT_CONFIRMED"`; with `SELLER_ORDER_WORKFLOW_ENABLED=false` in the gateway environment and a restart → `503` with `"code":"SELLER_ORDER_WORKFLOW_DISABLED"` → AC-11
- [x] `curl -i -X PATCH 'http://localhost:3580/api/order-items/<courierShippedLineId>/status' -H 'Content-Type: application/json' -H 'Cookie: ***' -d '{"status":"DELIVERED"}'` on the courier order → `200`, and `SELECT "receiptDate" FROM "OrderItem" WHERE id = ...` answers a timestamp; `SELECT "handedOverAt" FROM "Order" WHERE id = ...` answers one as well, written once → AC-12
- [x] The same line route with `{"status":"DELIVERED"}` on a `CONFIRMED` line → still `409 INVALID_STATUS_TRANSITION`, so the table of spec 0002 is intact → AC-12
- [x] `grep -rn "Pickup at the shop" apps packages --include=*.ts --include=*.sql --include=*.prisma` → the migration and nothing that writes it again at boot → AC-1
- [x] `grep -rn "receiptDate" apps/api-astrum/src --include=*.ts | grep -v spec` → the line transition and the handover service write it, and no other module does → AC-11, AC-12
- [x] `pnpm --filter @astrum/api test` → the pickup, order and seller suites pass, including the handover race with `ORDER_DB_TESTS=1` → AC-15
- [x] `pnpm --filter @astrum/customer test` → the two hooks, the schema table test, the checkout states, the seller action map with the pickup case, the group and dialog states, and the catalog parity pass → AC-15
- [x] `pnpm --filter @astrum/customer lint` → no error and no new line in `eslint-suppressions.json`; the new components stay under the 400 code line ceiling → AC-15
- [x] `pnpm check-types` → clean → AC-15
- [x] `pnpm quality-gate` → every task green → AC-15

- [x] `curl -s 'http://localhost:3580/api/shipping-methods' -H 'Cookie: ***' | jq` → every method carries `isPickup`: true on `Pickup at the shop`, false on the two courier rows, and no other field of the answer changed → AC-4
- [x] `docker exec astrum-db psql -U greedyghoster -d astrum-db -c '\d "ShippingMethod"'` → an `isPickup` boolean column with default false → AC-1
- [x] `grep -n "Promise<OrderStatus>" apps/api-astrum/src/modules/order/order-status.helpers.ts` → one match, so the helper returns the status both callers ignore → AC-11, AC-12
- [x] `grep -rn "pickupPointRequired" apps/customer/messages` → one match in `en.json` and one in `ru.json`, both under `validation`, none under `cart` → AC-14
- [x] `grep -n "resetPoint" apps/customer/src/hooks/order/checkoutErrors.ts` → at least one match, and the reaction carries it for `PICKUP_POINT_INACTIVE` and `UNKNOWN_PICKUP_POINT` → AC-6
- [x] `grep -n "orderNotFound" apps/customer/src/features/pages/SellerOrders/lib/refusals.ts` → a branch answering `retry: false` for `ORDER_NOT_FOUND` → AC-13
- [x] `grep -n "actionsDisabled" apps/customer/src/features/pages/SellerOrders/SellerOrderGroup/index.tsx` → the `Hand over` control reads it → AC-13

## Run notes

### 2026-11-12, the dev stack through the storefront and the API

**Accounts.** Five throwaway accounts were provisioned through the real path: `POST /api/auth/register` with a full ISO `dateOfBirth`, the confirmation link read out of Mailpit on 8025, `GET /api/auth/confirm`, then `POST /api/auth/signin`. A, S1 and S2 were confirmed (`ACTIVE`); B and S3 were left `PENDING`. The returned token was installed as the `__auth` cookie (CDP `Network.setCookie` for the browser, a `Cookie` header for the API), because this harness must not type a password. Accounts: `pickup-a-1794437599320@example.com` and the same stamp for `-b`, `-s1`, `-s2` and `-s3`, all `@example.com`.

**Shops and products.** S1 and S2 were onboarded through `POST /api/seller/onboarding` (businesses `biz_54369efe-e086-4870-b4ec-ed856604832e` and `biz_7034639e-b2e1-4a73-9917-c0cead28ecdb`) and created products through `POST /api/products`. The DTO accepts `visibility` but a new row lands `status = Draft`, so the run flipped `status` to `Published` with one SQL update, the only database write on the fixture side. Products: `Pickup P1 1794437599320` (`4684c794…`), `Pickup P1b …` (`ab02cc56…`, added so one seller's order can hold two lines) and `Pickup P2 …` (`a095fd7b…`). Their `previewImage` is a `picsum.photos` URL, which answers `403` from this machine, so every card and table rendered the broken image placeholder and the Next dev overlay counted one issue; no surface was being judged on its image. S3 was left without a shop: `requireActiveAccount` runs before any ownership read, so the `403 EMAIL_NOT_CONFIRMED` branch needs no business of its own and the fixture list's B3 and P3 were not created.

**Pickup points.** All three were made with the operator script, never with SQL: `Pickup point Lenina` (`cmwcput32000024vdmc0191zg`), `Pickup point Mira` (`cmwcpv1d900001gvdx2mdvnzt`) and `Pickup point Closed` (`cmwcpv3ed0000dgvdijr3qav5`), the last switched off. Lenina and Mira were switched off and back on during the two inactive point steps.

**Orders.** Eleven pickup orders and two courier orders were placed through `POST /api/orders` (the browser placed two of them), and line statuses were moved with the product's own line route, never with SQL: `CONFIRMED` and `SHIPPED` only, since no endpoint writes them otherwise. `DELIVERED` came from the handover route or from the line route, as the steps require.

**Harness switches.**

- A second gateway instance ran on port 3590 with `API_PORT=3590 SELLER_ORDER_WORKFLOW_ENABLED=false` for the `503` step and was killed afterwards, so the running dev gateway never changed its flag. `dotenv run` does not override an existing environment variable, which is what made the flag take effect.
- A third instance on port 3591 (flag on) was used once to read the handover log line from its own stdout: `{"level":"info","event":"seller.order.handed_over","userId":"0ce2c412-…","orderId":"cmwcqfzs00011zkvd717zxxyt","businessId":"biz_54369efe-…","deliveredLineCount":1,"resultCode":"OK"}`. Killed afterwards.
- Radix checkbox and select triggers ignore a script `element.click()`; they need real pointer events (`click_at_xy`, or an `Input.dispatchMouseEvent` pair) with `Emulation.setFocusEmulationEnabled` on. Radix dialog buttons are plain buttons and do react to a script click.
- A button activated by keyboard needs a `text` payload on the key event: `rawKeyDown` with `windowsVirtualKeyCode=13` and `text="\r"` did not activate it, while `Space` with `text=" "` did. The dialog was therefore opened with Space.
- The transport failure of the last step came from `Network.emulateNetworkConditions offline=true` instead of stopping the running gateway, and was cleared afterwards. The panel's own revalidation failed the same way and its `Повторить` restored the list once the transport was back.
- The slow network of the double press step came from 2500 ms of latency. Two script clicks in one task do send two requests, so the press was judged on the in flight state: both dialog controls disabled, the group control reading `Выдаём…` with `aria-busy=true` and `disabled=true`, and one `PATCH` recorded once the request landed.

**Degraded paths, each with its own observation.** The point switched off between load and submit answered `409 PICKUP_POINT_INACTIVE` in one toast, cleared the choice, refetched the list and kept the date and payment fields (English and Russian). The dropped transport produced the generic failure toast `Выдача не прошла.` with `Повторить` and no line change. The flag off instance answered `503 SELLER_ORDER_WORKFLOW_DISABLED`; the `PENDING` account answered `403`; a seller of another business answered `404 ORDER_NOT_FOUND`; a courier order answered `409 HANDOVER_REQUIRES_PICKUP`; an order whose lines are all `PENDING` answered `409 NOTHING_TO_HAND_OVER` and wrote nothing.

**Not observed live.**

- The loading copy of the point select (`cart.pickupLoading`) and its failure copy with the retry control (`cart.pickupLoadFailed`, `cart.pickupRetry`): the local API answers before a sample lands, and the checkout resets its selection on a reload, so the field never stayed on screen in either state. Both are covered by the checkout states suite, and the Russian text was read from `messages/ru.json`.
- Three of the four refusals in Russian: `UNKNOWN_PICKUP_POINT`, `PICKUP_POINT_NOT_ALLOWED` and `PICKUP_POINT_REQUIRED` cannot be produced from the form (the schema and the method switch prevent those bodies), so their Russian copy was read from the catalog and their mapping from `checkoutErrors.ts`; only `PICKUP_POINT_INACTIVE` was seen as a live Russian toast.
- The focus return of the keyboard step: after Escape the dialog closed and no request left the browser, but `document.activeElement` was `<body>`, not the `Hand over` control. The dialog is controlled by local state with no `DialogTrigger`, so Radix has no trigger to restore focus to. A finding for `/check review`; AC-13 does not name focus return.

**Outside the feature's scope, found while verifying.** The checkout date field prints the day before the one picked in the calendar: clicking `Friday, November 20th, 2026` (the calendar keeps that day selected, its `aria-label` reading `…selected`) leaves `November 19, 2026` on the trigger, while the stored `deliveryDate` really is the 20th, which the order screen prints as `Pickup Date: November 20, 2026`. The date logic is not part of this change's diff (`git diff` on `CheckoutForm/index.tsx` touches only the reset payload), so it is recorded in the scope's `## Deferred` list rather than fixed here. The cart page dollar sign over ruble amounts was already deferred by spec 0009.
