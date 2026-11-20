# 0031. Issue the order after delivery — verify

Run these steps on the dev stack after `/develop`. Every step names what a broken run prints, so a green tick on a broken build is not possible. Credentials are derived from the running container, and no step prints the session cookie.

## Verdict

**PASS**, run 2026-11-20 on the running dev stack (storefront 3000, gateway 3580, Postgres and Redis in Docker). Every acceptance criterion is met and every specced surface exists. Two gaps are named and neither hides a missing surface: the arrival and issue counts of step 3 no longer match the numbers the spec quotes, and the refusal toast of step 13 has no reachable state in the point workspace because the queue lists arrived parcels only. The evidence for each step sits in the Run notes at the end.

## Setup

```bash
cd /e/Astrum/Astrum
PSQL="docker exec astrum-db psql -U $(docker exec astrum-db printenv POSTGRES_USER) -d $(docker exec astrum-db printenv POSTGRES_DB)"
W="C:/Users/ADMIN/AppData/Local/hermes/cache/scratch/spec0031"; mkdir -p "$W"
API=http://localhost:3580/api
```

The gateway session comes from the recipe in the `astrum-monorepo` skill (`C:/Users/ADMIN/AppData/Local/hermes/skills/astrum-monorepo/references/verifying-the-live-api.md`): register a `probe.<tag>@example.com` account, flip it to `ACTIVE` with `psql`, sign in, and write the token into `$W/token.txt`. Every request then sends `-H "Cookie: ***"`. A point worker and a courier need a role row each (`update "User" set role='POINT_WORKER'` plus a `PointWorker` row for a point, or `role='COURIER'` plus a `Courier` row), which that reference already describes.

Fixtures this pass needs, all measured in the dev database on 2026-11-20: an active pickup point (`select id,name from "PickupPoint" where "isActive"`), a product with `quantity > 3` and a UUID shaped id, one order that must be walked from checkout to «Выдано», and one product that appears on a `DELIVERED`, never issued, never reviewed line of the probe account (step 8 derives it).

Steps 3 and 14 read the state of the database, so run them before the walk in steps 4 to 7 changes any row.

## Premise corrections

Four steps describe a state the code cannot reach, a route that does not exist, or a number that moved since the spec was written. Each was corrected in the run and the mechanism it aimed at was proved another way.

- **Step 3 expects 27 issued lines in 18 orders, 20 orders carrying `shippedAt` and 18 stamped orders reading `ISSUED`.** Measured at the start of this run, before any row of the walk existed: 30 issued lines in 20 orders, 2 orders carrying `shippedAt`, 20 stamped orders reading `ISSUED`, 10 delivered lines, 6 reviews. The migration itself did what the spec describes, and 2 is the honest number for `shippedAt`, because only the two `SHIPPED` orders were backfilled (the spec promises exactly that and the step's 20 was the arithmetic of a different rule). The three extra issued lines in two orders came from a run that issued them after the migration and before this one; this run deleted its own fixtures and the counts returned to 30 issued lines, 10 delivered lines and 6 reviews, so nothing else moved.
- **Step 4's grep cannot come back empty.** `grep -rn 'status: "DELIVERED"' apps/api-astrum/src/modules/staff` hits `point-order.service.ts:174` and `courier-order.service.ts:246`, and both are reads: the point queue and the courier pool, which AC-4 requires to read `DELIVERED`. The run read both hits and confirmed no write sits in that folder, and the only writer left in the tree is `order-shipping.ts:69`.
- **Step 8 names `GET /api/products/:id/review-state`, which is not a route.** The state travels inside `GET /api/products/:id` as the `reviewState` field, and the run read that field. The card rating the step asks to watch is an aggregate of the list read (spec 0021): the detail answer carries `stars` and `reviewCount` and no `averageRating`, so the run proved the write through the created row and through `reviewState` turning `ALREADY_REVIEWED`, and left the card aggregate to the list read.
- **Step 13 asks for the toast on a `SHIPPED` parcel pressed in the point workspace, which no state can reach.** After AC-4 the queue reads `DELIVERED` orders only, so a parcel that is still on its way carries no control at all; that is the outcome the criterion wanted, not a refusal a worker can meet. The branch was proved at the gateway (`409 ORDER_NOT_DELIVERED` in step 5) and through its copy and its map entry in both catalogues and both refusal maps.
- **Step 14's second half asks for `pnpm docker:prod:up` and two replicas.** That stack cannot run beside the dev one (one Postgres volume, port 8025) and a rebuild of six images costs more than the clause is worth, so the replica race was proved with a second gateway process on port 3581 against the same database and the same Redis. The evidence is in the Run notes.

## Steps

1. **Gates**, covers the whole build. `pnpm check-types` exits 0, `pnpm lint` exits 0, and `pnpm --filter @astrum/api test` and `pnpm --filter @astrum/customer test` print zero failures. A broken run prints a failing suite or a type error naming the map that lost its key (the `Record<OrderStatus, …>` tables refuse to compile when `ISSUED` is missing from one of them, which is the cheap proof that every status table was touched).

2. **The two enums carry the state**, verifies **AC-1**.
```bash
$PSQL -c "select t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) as labels from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typname in ('OrderStatus','OrderItemStatus') group by 1 order by 1;"
```
Expect `OrderItemStatus` with `ISSUED` between `DELIVERED` and `RETURNED`, and `OrderStatus` with `ISSUED` between `DELIVERED` and `CANCELED`. A broken run prints the four value list, and `select enum_range(null::\"OrderStatus\")` naming a value the client enums do not have fails the storefront type check instead.
```bash
pnpm --filter @astrum/api test -- order-status.helpers.spec.ts
```
Expect the five case table to pass, including the two that matter: one mixed order (a `DELIVERED` line beside an `ISSUED` one) answers `DELIVERED`, and an order whose every active line is issued answers `ISSUED`. A broken run prints `Received: "DELIVERED"` where `ISSUED` was expected, which is what a wrong priority number produces.

3. **The migration carried the history**, verifies **AC-12**.
```bash
$PSQL -c "select i.status, count(*) from \"OrderItem\" i join \"Order\" o on o.id=i.\"orderId\" where i.status in ('DELIVERED','ISSUED') group by 1 order by 1;" \
      -c "select count(*) filter (where \"handedOverAt\" is not null) as stamped, count(*) filter (where \"shippedAt\" is not null) as has_shipped_at from \"Order\" where status in ('SHIPPED','DELIVERED','ISSUED');" \
      -c "select count(*) from \"Review\";" \
      -c "select status, count(*) from \"Order\" where \"handedOverAt\" is not null group by 1 order by 1;"
```
Expect 27 rows reading `ISSUED`, 10 reading `DELIVERED`, both stamped and shipped counts at 20 (18 delivered plus 2 shipped), 6 reviews, and the 18 stamped orders reading `ISSUED` (a run that moves lines without their parent prints 18 orders still `DELIVERED`, which is the queue of guaranteed refusals). A broken run prints 37 `DELIVERED` and 0 `ISSUED` (the migration did not run), or a review total that moved (the migration touched rows it should not have).

4. **Delivery happens by itself**, verifies **AC-2**. Place one order end to end and watch it walk without a press:
```bash
curl -s -o "$W/cart.json" -H "Cookie: ***" -H "Content-Type: application/json" -d "{\"productId\":\"$P\"}" "$API/cart"
curl -s -o "$W/order.json" -w "%{http_code}\n" -H "Cookie: ***" -H "Content-Type: application/json" \
  -H "Idempotency-Key: spec0031-order-1" \
  -d "{\"deliveryDate\":\"2026-12-01T10:00:00.000Z\",\"shippingMethodId\":\"$SM\",\"paymentMethod\":\"CASH\",\"pickupPointId\":\"$PP\",\"orderItems\":[{\"productId\":\"$P\",\"quantity\":1}]}" \
  "$API/orders"
```
Expect `201`, then `select status,\"shippedAt\",\"handedOverAt\" from "Order" where id='<the id>'` to move `CONFIRMED → SHIPPED` with `shippedAt` set within 60 to 120 seconds and `SHIPPED → DELIVERED` with `shippedAt` unchanged and every line carrying one `receiptDate` within another 60 to 120 seconds. A broken run leaves the order at `SHIPPED` after four minutes (stage two is not wired into `runOrderShipping`), or prints `receiptDate` set with `shippedAt` null (the second stage measured acceptance instead of shipping).
```bash
grep -n deliveryDate apps/api-astrum/src/modules/order/order-shipping.ts
grep -rn 'status: "DELIVERED"' apps/api-astrum/src/modules/staff apps/api-astrum/src/modules/order/order.service.ts | grep -v __tests__
```
First grep prints nothing; second prints nothing either, because the one writer left is the second stage inside `order-shipping.ts` (`grep -n 'status: "DELIVERED"' apps/api-astrum/src/modules/order/order-shipping.ts` names it). A broken run lists a staff service or `order.service.ts`, which means the human path survived the change. A bare `grep -rn '"DELIVERED"'` is the wrong tool here: it also hits the status tables, the counters and the spent clause.

5. **The counter writes `ISSUED`**, verifies **AC-3**. With the walked order now `DELIVERED` and a worker holding the point:
```bash
curl -s -o "$W/ho.json" -w "%{http_code}\n" -X PATCH -H "Cookie: ***" "$API/staff/point/orders/<the id>/handover"
$PSQL -c "select status,\"handedOverAt\" from \"Order\" where id='<the id>';" \
      -c "select status, count(*) from \"OrderItem\" where \"orderId\"='<the id>' group by 1;"
```
Expect `200`, `ISSUED`, one `handedOverAt`, and every line `ISSUED` with its `receiptDate` untouched since arrival. Press it again and expect `409` with `{"code":"ALREADY_HANDED_OVER"}`. Press it while step 4's own order still reads `SHIPPED` (the 60 to 120 second window after its lines shipped, at the same pickup point) and expect `409 {"code":"ORDER_NOT_DELIVERED"}` with the row unchanged. Outside that window the queue never lists a shipped parcel, so seed the state instead and restore it in the same breath: `update "Order" set status='SHIPPED', "handedOverAt"=null where id='<a walked order>';` then set it back to `DELIVERED`. A broken run answers `200` twice (the `handedOverAt: null` guard is missing), or rewrites `receiptDate` at the press (the issue time landed in the arrival column).

6. **The counters show arrived parcels**, verifies **AC-4**.
```bash
curl -s -H "Cookie: ***" "$API/staff/point/orders?page=1&limit=20" -o "$W/queue.json"
node -e "const q=require('$W/queue.json');console.log([...new Set(q.orders.map(o=>o.status))])"
```
Expect `[ 'DELIVERED' ]` and the id of step 4's order present before the press, absent after it. A broken run prints `[ 'SHIPPED' ]` (the read was not moved) or an entry that answers `409 ORDER_NOT_DELIVERED` on the press, which is the queue listing parcels nobody may issue.

7. **The cancel rule moved**, verifies **AC-5**. Take a second walked order that is `DELIVERED`, note the product quantity, then cancel it at the counter and a third one from the buyer's screen:
```bash
$PSQL -c "select quantity from \"Product\" where id='$P';"
curl -s -w "%{http_code}\n" -X PATCH -H "Cookie: ***" "$API/staff/point/orders/<id2>/cancel"
$PSQL -c "select quantity from \"Product\" where id='$P';" \
      -c "select status, count(*) from \"OrderItem\" where \"orderId\"='<id2>' group by 1;"
```
Expect `200`, every cancellable line `CANCELLED`, and the quantity up by exactly the units of that order. Then press the same cancel again and expect `409 NOTHING_TO_CANCEL` with the quantity unchanged (one return, never two). On the issued order of step 5: counter cancel answers `409 NOTHING_TO_CANCEL` and the buyer's own cancel answers `409 {"code":"INVALID_STATUS_TRANSITION"}`, both leaving the quantity as it was. A broken run returns stock twice, or cancels an issued line, which is the one rule this slice forbids.

8. **The review gate needs a handover**, verifies **AC-6**. Derive the fixture instead of assuming it:
```bash
$PSQL -c "select i.id as line, o.id as order, i.\"productId\" from \"OrderItem\" i join \"Order\" o on o.id=i.\"orderId\" where o.\"handedOverAt\" is null and i.status='DELIVERED' and i.review is null limit 5;"
```
For one such line of the probe account: `GET $API/products/<productId>/review-state` answers `NOT_PURCHASED`, and `POST $API/products/<productId>/reviews` with that `orderItemId` answers `403 {"code":"REVIEW_ONLY_AFTER_DELIVERY"}`. For the issued line of step 5: the state answers `ELIGIBLE`, the same POST answers `201`, and the card's rating moves. A broken run answers `ELIGIBLE` for the unissued line (the gate was not moved), or `403` for the issued one (the gate was moved to the wrong status). A row that already carries a review answers `ALREADY_REVIEWED` rather than `NOT_PURCHASED`, which is why the query filters `i.review is null`.

9. **Both catalogues and every map name the state**, verifies **AC-7**.
```bash
node -e "const ru=require('./apps/customer/messages/ru.json'),en=require('./apps/customer/messages/en.json');console.log(JSON.stringify([ru.orders.status.issued,en.orders.status.issued,ru.orders.itemStatus.issued,en.orders.itemStatus.issued,ru.orders.deliveredOn,en.orders.deliveredOn]))"
pnpm --filter @astrum/customer test -- DeliveryProgress status.test.ts lineState.test.ts
```
Expect `["Выдано","Issued","Выдано","Issued","Доставлено {date}","Delivered {date}"]`, and the rail suite asserting five step labels and five progress widths (`0, 25, 50, 75, 100`). A broken run prints `"Issued"` twice from a missing key fallback, or a rail test expecting four steps.

10. **The buyer's orders screen folds both**, verifies **AC-8**.
```bash
curl -s -H "Cookie: ***" "$API/orders?status=DELIVERED" -o "$W/list.json"
$PSQL -c "select status, count(*) from \"Order\" where \"userId\"='$UID' group by 1;"
node -e "const l=require('$W/list.json');console.log(l.counts, l.items.map(i=>i.status))"
```
Expect the issued order of step 5 inside `items`, and `counts.delivered` equal to the `DELIVERED` plus `ISSUED` rows the query prints. A broken run prints the `DELIVERED` row count only, so the tab undercounts every issued order. Then read `spent` and confirm a cash order that was issued after this pass is included, which is the `OR` clause the walk covers by using `CASH`.

11. **The seller's money follows the handover**, verifies **AC-9**.
```bash
curl -s -H "Cookie: ***" "$API/seller/orders?page=1&limit=20" -o "$W/seller.json"
node -e "const s=require('$W/seller.json');console.log(s.counts, s.stats)"
$PSQL -c "select count(*) as issued_lines, sum((i.price*i.quantity))::text as money from \"OrderItem\" i join \"Order\" o on o.id=i.\"orderId\" where i.status in ('DELIVERED','ISSUED') and o.\"businessId\" is not null;"
```
Expect `counts.delivered` and `stats.units` to include the line step 5 issued, and the seller's revenue to be unchanged by the press (it counted the line before as `DELIVERED` and counts it after as `ISSUED`). A broken run drops revenue by that line's price at the moment of the handover, which is the failure this criterion exists for.

12. **The receiving block prints three moments**, verifies **AC-10**. Sign the browser in with the token file (never paste the cookie) and open `/orders/<id>` on the storefront with `NEXT_LOCALE=ru`:
- a `SHIPPED` order prints «Ожидается <дата>», where the date is the day the buyer picked at checkout;
- a `DELIVERED` order prints «Доставлено <дата>», the arrival date, which equals the line `receiptDate` in step 4;
- the `ISSUED` order prints «Выдано <дата>», which equals `handedOverAt`.

Read all three states on the order this pass walked, never on the 18 migrated ones: for those, arrival and issue are the same moment (the concession AC-12 names). A broken run prints «Ожидается» on the delivered order (the block still reads `handedOverAt ?? deliveryDate` only), or two dates that differ by the wait for the same order (the arrival date was taken from the wrong place).

13. **The refusal speaks about delivery**, verifies **AC-11**.
```bash
grep -rn "ORDER_NOT_SHIPPED\|notShipped" apps --include=*.ts --include=*.tsx --include=*.json
```
Expect no output. Then press «Выдать» on a `SHIPPED` order in the point workspace and read the toast: «Заказ ещё не доставлен.» A broken run prints the old code in `staff.constants.ts` or a toast that still says «не отмечен как отправленный».

14. **Two presses and two workers stay safe**, verifies **AC-13**. On a fourth `DELIVERED` order, send two handovers at once and one cancel twice:
```bash
( curl -s -o "$W/a.json" -w "A%{http_code}\n" -X PATCH -H "Cookie: ***" "$API/staff/point/orders/<id4>/handover" & \
  curl -s -o "$W/b.json" -w "B%{http_code}\n" -X PATCH -H "Cookie: ***" "$API/staff/point/orders/<id4>/handover" & wait )
$PSQL -c "select status,\"handedOverAt\" from \"Order\" where id='<id4>';"
```
Expect one `200`, one `409`, and exactly one `handedOverAt` value. Leave one data pass running on two replicas (`pnpm docker:prod:up`, then the same walk) and confirm `order.lines_delivered` appears once in `pnpm docker:prod:logs` for that order. A broken run prints `200` twice with two different timestamps, or two `order.lines_delivered` lines for one order.

## Cleanup

Delete what the run made, in this order because `Review.orderItemId` and `OrderItem.orderId` are `RESTRICT`: review (with its likes and comments) → `Payment` → `OrderItem` → `Order` → the probe account, and restore `Product.quantity` and `isOutOfStock` for every order the run created, because a deleted order gives no stock back. Delete the session key with `docker exec astrum-redis redis-cli DEL "session:<sid>"` and leave `:3580` as the owner had it.

## Run notes

**2026-11-20, `/check verify issue the order after delivery`, dev stack on 3000, 3580 and 4580 with Postgres, Redis, RabbitMQ and Mailpit in Docker.**

**Fixtures.** Three throwaway accounts: `probe.spec0031@example.com` (buyer, `8f619fdd…`), `probe.spec0031pw@example.com` (point worker of `Pickup point Mira`, `cmwcpv1d900001gvdx2mdvnzt`, through a `PointWorker` row) and `probe.spec0031sel@example.com` (seller owning the `Business` row `biz_spec0031`). Each session is a `POST /api/auth/signin` answer after `update "User" set status='ACTIVE'`, kept in a file under the scratch dir; no token is quoted here. Seven orders walked the flow, each tagged by its `Idempotency-Key`: `spec0031-order-1` (`ad8155bb…`, issued), `-2` (`1a6d0d75…`, cancelled at the counter), `-3` (`896b5425…`, delivered and never issued), `-4` (`ad8155bb…`, two handovers at once), `-5` (the seller's own crate `ef4947a2…`, issued for the money read), `-6` and `-7` (`896b5425…` and `1a6d0d75…`, the second gateway race and the storefront walk). All of them, the probe review, the crate, the business, the role row and the three accounts were deleted afterwards and the three product quantities were put back to 13, 4 and 4; the counts returned to the 30 issued lines, 10 delivered lines, 6 reviews and 20 issued orders the database held before the run.

**Step 1.** `pnpm check-types` exit 0 (six tasks, 10.0 s), `pnpm lint` exit 0 (six tasks, 21.5 s, 13 warnings and no error), `pnpm --filter @astrum/api test` 495 passed, 20 skipped, 515 total, exit 0, `pnpm --filter @astrum/customer test` 471 passed in 88 files, exit 0.

**Step 2.** `psql` printed `OrderItemStatus` as PENDING,CONFIRMED,OUT_OF_STOCK,CANCELLED,SHIPPED,DELIVERED,RETURNED,BACKORDERED,REPLACED,ISSUED and `OrderStatus` as PENDING,CONFIRMED,SHIPPED,DELIVERED,CANCELED,ISSUED, which is both values present in the one schema and its migration. `pnpm --filter @astrum/api test -- order-status.helpers.spec.ts` printed 6 passed. One note for the next reader: both `ADD VALUE` statements carry no `BEFORE` or `AFTER`, so the Postgres sort order appends `ISSUED` at the end of each type while the ranking comes from `ORDER_STATUS_PRIORITY`; nothing in the tree orders rows by the enum type, so the difference costs nothing.

**Step 3.** Run at 15:31, before the walk: 30 `ISSUED` lines, 10 `DELIVERED` lines, stamped orders 20, `shippedAt` on 2 orders, 6 reviews, and all 20 stamped orders reading `ISSUED`. The difference against the numbers the spec quotes is explained in the premise corrections.

**Step 4.** `POST /api/cart` answered 200 and `POST /api/orders` answered 201 at 15:32:26 with `CONFIRMED`. The order read `SHIPPED` at 15:33:59 with `shippedAt` set 93 seconds after creation and no `receiptDate`, then `DELIVERED` at 15:34:59 with the line's `receiptDate` set to the same second and `shippedAt` unchanged. Orders 2 to 4 walked the same two stages on the 15:36:59 and 15:37:59 ticks, and orders 6 and 7 on the 15:40:43 and 15:41:43 ticks, so five walks saw the pass move the parcel without a press. `grep -n deliveryDate …/order-shipping.ts` printed nothing, and the only `status: "DELIVERED"` write in the tree is `order-shipping.ts:69`.

**Step 5.** Handover pressed on the same order while it read `SHIPPED` answered `409 {"code":"ORDER_NOT_DELIVERED","message":"This order is not delivered yet."}` and wrote nothing. Pressed after arrival it answered `200` with `status: "ISSUED"`, the row then carried one `handedOverAt` (15:35:48), the line read `ISSUED` and kept its arrival `receiptDate` of 15:34:59, and a second press answered `409 ALREADY_HANDED_OVER`.

**Step 6.** The point queue answered `total 1`, statuses `["DELIVERED"]` with the walked order before the press and `total 0` after it. A `SHIPPED` order was absent from the queue in step 5's window, which is the read AC-4 asks for.

**Step 7.** The counter cancelled a `DELIVERED` order with 200: the line became `CANCELLED`, the payment resolved to `CANCELLED`, and `Product.quantity` moved 3 to 4, one return. A second press answered `409 NOTHING_TO_CANCEL` and the quantity stayed 4. On the issued order the counter answered `409 NOTHING_TO_CANCEL` and the buyer's `PATCH /api/orders/:id/status` answered `409 {"code":"INVALID_STATUS_TRANSITION"}`, with the order still `ISSUED`.

**Step 8.** On the delivered and never issued line of order 3 the product read answered `reviewState {"status":"NOT_PURCHASED"}` and the review write answered `403 {"code":"REVIEW_ONLY_AFTER_DELIVERY"}`. On the issued line of order 1 the same read answered `{"status":"ELIGIBLE","orderItemId":"cmwoylkdc…"}` for exactly that line, the write answered 201 with review `cc88d854…`, and the state then read `ALREADY_REVIEWED`. The review count moved 6 to 7 and came back to 6 after the cleanup.

**Step 9.** Both catalogues printed `["Выдано","Issued","Выдано","Issued","Доставлено {date}","Delivered {date}"]` for `orders.status.issued`, `orders.itemStatus.issued` and `orders.deliveredOn`, and the refusal copy reads «Заказ ещё не доставлен.» and `This order is not delivered yet.` under both `staff.point.queue.refusals.notDelivered` and `staff.courier.queue.refusals.notDelivered`, while `notShipped` is absent from both files. On the live screen the rail printed five labels (В обработке, Подтверждён, Отправлен, Доставлен, Выдано) with the bar at `width: 75%` on the delivered order and `width: 100%` on the issued one.

**Step 10.** `GET /api/orders?status=DELIVERED` answered `counts {"all":5,"delivered":1,"canceled":0}` with the issued order `…44ec2q` inside `items`, and `psql` counted one `DELIVERED` or `ISSUED` order for that account, so the tab folds both. `spent` read `[{"currency":"RUB","amount":15692.6}]`, the issued cash order whose `paymentStatus` is still `PENDING`, which is the `ISSUED` clause of the spent total working.

**Step 11.** With the crate line `DELIVERED` the seller read answered `counts {"all":1,"delivered":1,"canceled":0}` and `stats {"revenue":[{"currency":"RUB","amount":1000}],"units":1}`; after the press the same read answered the same counts and the same revenue while the line status read `ISSUED`. `psql` confirmed one line and 1000.00 for that business. The seller's money does not move at the handover.

**Step 12.** Signed in as the buyer with the `__auth` cookie and `NEXT_LOCALE=ru`, `/orders/<id>` on order 7 printed «Ожидается 25 ноября 2026 г.» while it read `SHIPPED` (the day picked at checkout), «Доставлено 20 ноября 2026 г.» after arrival, which equals the line `receiptDate`, and «Выдан 20 ноября 2026 г.» after the press, which equals `handedOverAt`, with the rail at 100 percent and the header badge reading «Выдано».

**Step 13.** `grep -rn "ORDER_NOT_SHIPPED|notShipped"` over `apps` finds nothing in the source; the hits that remain are stale build output under `apps/api-astrum/dist` and `apps/customer/.next`, which the next build replaces. The gateway answered the new code and the new prose in step 5, and both refusal maps key `ORDER_NOT_DELIVERED`. The toast itself was not observed, for the reason in the premise corrections.

**Step 14.** Two handovers sent at once on order 4 answered one 200 and one `409 ALREADY_HANDED_OVER`, with the row holding one `handedOverAt` and one issued line. The replica clause ran as a second gateway (`API_PORT=3581`, same database, same Redis) beside the owner's one for four minutes: its log carries exactly one `order.lines_shipped` and one `order.lines_delivered` per order across the ticks that walked orders 6 and 7, and both orders hold one `shippedAt` and one `receiptDate`, so the second tick of either process found nothing to move and logged nothing.

**Not observed.** The point workspace toast of step 13, and the card rating of step 8, both for the reasons the premise corrections name.
