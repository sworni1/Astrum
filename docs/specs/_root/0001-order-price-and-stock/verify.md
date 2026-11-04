# Verify: Order price and stock on the server · spec 0001 · updated 2026-11-04

_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Run these with the dev stack up (`pnpm db:up`, `pnpm dev`). `API` is `http://localhost:3580/api`; `TOKEN` is the `__auth` cookie value from the browser (devtools, Application, Cookies). Any order needs a `ShippingMethod` row, and the demo database has none, so create one first:

```bash
psql "$DATABASE_URL" -c "INSERT INTO \"ShippingMethod\" (id, name, price) VALUES ('verify-ship', 'Verify delivery', 5.99) ON CONFLICT (name) DO NOTHING"
```

## UI / manual

_Walked on 2026-11-04: the first step was driven by the owner in the browser (order `cmw25deon00003wvdd87kni5m`, total `41063.00` = 2772 x 2 + 8690 + 26829, every line price equal to its product). The order screen first crashed on `next/image` because the demo catalogue serves images from about fifty shops and only a few hosts were allowed; `apps/customer/next.config.ts` now allows any host, and the optimizer answers 200 with a real JPEG for the two hosts that crashed. The remaining four walkthrough steps still need a person: the browser harness times out on mouse dispatch, the Radix select and calendar ignore synthetic pointer events, and it drops the session cookie when it restarts. Every acceptance criterion was proven through the API as well, see the command steps._

- [x] Sign in, add a product with stock 3 to the cart, open `/cart`, pick a delivery method, place the order → the order screen shows the line price taken from the product and the total as unit price times quantity; the browser request body carries only `productId` and `quantity` → AC-1, AC-2, AC-9 (order `cmw25deon00003wvdd87kni5m`, total `41063.00` from the product prices; the screen needed the image host fix in `next.config.ts`)
- [ ] With the checkout form open, set that product's `quantity` to 0 in the database, then submit → a toast names the product and asks for fewer units, `/cart` reloads, `/orders` gains no row → AC-4
- [ ] Set the same product's `visibility` to `Draft`, submit again → the same refusal shape, `items[0].available` is 0, no order row → AC-5
- [ ] Delete the cart line in another tab, then submit the form → the toast says the cart moved, `/cart` reloads, no order appears → AC-6
- [ ] Open the created order while signed in as another customer → a not found answer, and the other customer's `/orders` does not list it → AC-8

## Commands

- [x] Create with a tampered body, note `price: 1`, `name: "lol"` and a foreign `previewImage`:

  ```bash
  curl -s -X POST "$API/orders" -H "cookie: __auth=$TOKEN" -H 'content-type: application/json' \
    -d '{"deliveryAddress":"Lenin 1","deliveryDate":"2026-11-20T09:00:00.000Z","shippingMethodId":"verify-ship","paymentMethod":"CASH","paymentDetails":"Cash","orderItems":[{"productId":"'$PRODUCT'","quantity":1,"price":1,"name":"lol","previewImage":"http://evil/x.png"}]}'
  ```

  → `201`, `totalPrice` equals the product price as a number, the saved line carries the product `price`, `name` and `previewImage` → AC-1, AC-2, AC-9
- [x] The same request with `"quantity": 0`, with 51 lines, and with two lines of 600 for one product → `422` and body `{"code":"VALIDATION","message":...,"errors":[...]}` each time → AC-7
- [x] The same request with `"shippingMethodId":"does-not-exist"` → `409` `{"code":"UNKNOWN_SHIPPING_METHOD"}`, and the product's `quantity` is unchanged → AC-10
- [x] Twenty parallel orders of one unit against a stock of 5 (ran 2026-11-04: 5 created, 15 refused with `available` 0, stock 0, `isOutOfStock` true):

  ```bash
  for i in $(seq 20); do curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API/orders" \
    -H "cookie: __auth=$TOKEN" -H 'content-type: application/json' -d "$BODY" & done; wait
  ```

  → exactly five `201` and fifteen `409 OUT_OF_STOCK`, every refusal names a fresh `items[0].available`, afterwards `Product.quantity` is 0 and `isOutOfStock` is true, and the ordered units sum to exactly 5 → AC-3, AC-4
- [x] An order mixing a `RUB` product and a `USD` product → `409` `{"code":"MIXED_CURRENCY","productIds":[...]}`, no order row, stock unchanged → AC-2
- [x] `pnpm --filter @astrum/api test` → 31 passed, the database suite skipped
- [x] `ORDER_DB_TESTS=1 pnpm --filter @astrum/api test -- order.integration` (dev Postgres up) → 2 passed, including the twenty parallel orders → AC-1, AC-3, AC-4
- [x] `pnpm quality-gate` → every task successful

## Value sourcing coverage

- Line price and total → the tampered body step reads `Product.price`, never the request (variant: send `price: 1` and check the saved line) → AC-1, AC-2
- Line name and image → the same step sends `"lol"` and a foreign URL and the saved line keeps the product's → AC-1
- Currency per line and per order → the mixed currency step; a single currency order copies the product's (`RUB` in the happy path) → AC-2
- Quantity per line → the merge step sends two lines of the same product and the saved order holds one line with the sum → AC-7
- Remaining stock and `isOutOfStock` → the parallel step leaves 0 and `true`; a partial order leaves the remainder and `false` → AC-3
- `userId` on order and lines → the tampered body carries no `userId`, the saved order holds the cookie's user; the other customer sees nothing → AC-8
- Cart quantity → the cart mismatch step sends more than the cart holds and the cart is unchanged afterwards → AC-6
- `items[].requested` and `items[].available` → the refusal bodies list the merged request and the re-read availability, never the pre race value → AC-4
- `code` and `message` → every refusal above asserts its code, and the message names the product in a toast → AC-4, AC-5, AC-6, AC-10
- Money in JSON → every handler answers `totalPrice` and `price` as numbers with two decimals → AC-9

## Acceptance-criteria coverage

- AC-1 covered by the tampered body step and the parallel suite
- AC-2 covered by the tampered body step and the mixed currency step
- AC-3 covered by the parallel step and `order.integration.spec.ts`
- AC-4 covered by the parallel step, the out of stock manual step and `order.integration.spec.ts`
- AC-5 covered by the draft visibility step
- AC-6 covered by the cart mismatch step
- AC-7 covered by the quantity and array limit step
- AC-8 covered by the other customer step
- AC-9 covered by the tampered body step and the list read
- AC-10 covered by the unknown shipping method step
