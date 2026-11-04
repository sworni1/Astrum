# Verify: Idempotent checkout and cart clearing · spec 0003 · updated 2026-11-04

_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Run these with the dev stack up (`pnpm db:up`, `pnpm dev`). `API` is `http://localhost:3580/api`; `TOKEN` is the `__auth` cookie value from the browser (devtools, Application, Cookies). An order needs a `ShippingMethod` row, and the demo database may have none, so create one first:

```bash
psql "$DATABASE_URL" -c "INSERT INTO \"ShippingMethod\" (id, name, price) VALUES ('verify-ship', 'Verify delivery', 5.99) ON CONFLICT (name) DO NOTHING"
```

Pick one published product with stock above 2 and keep its id in `$PRODUCT`; add it to the cart with quantity 2:

```bash
psql "$DATABASE_URL" -c "INSERT INTO \"CartItem\" (id, \"userId\", \"productId\", quantity) VALUES (gen_random_uuid(), '$USER_ID', '$PRODUCT', 2) ON CONFLICT (\"userId\", \"productId\") DO UPDATE SET quantity = 2"
```

The body used by most steps, plus two helpers that keep every answer in its own file, so two parallel requests can be compared:

```bash
BODY='{"deliveryAddress":"Lenin 1","deliveryDate":"2026-11-20T09:00:00.000Z","shippingMethodId":"verify-ship","paymentMethod":"CASH","paymentDetails":"Cash","orderItems":[{"productId":"'$PRODUCT'","quantity":2}]}'
post() { local tag=$1; shift; curl -s -D "/tmp/h.$tag" -o "/tmp/b.$tag" -w "%{http_code}\n" -X POST "$API/orders" -H "cookie: __auth=$TOKEN" -H 'content-type: application/json' "$@"; }
```

## Commands

- [ ] A create with a key answers `201`, the response carries no `Idempotent-Replay`, and the row stores both columns:

  ```bash
  KEY=verify-key-0001
  post a -H "Idempotency-Key: $KEY" -d "$BODY"
  psql "$DATABASE_URL" -c "SELECT \"idempotencyKey\", length(\"idempotencyHash\") AS hash_len FROM \"Order\" WHERE \"idempotencyKey\" = '$KEY'"
  ```

  → `201`, `idempotencyKey` equals `verify-key-0001`, `hash_len` is `64` → **AC-1**
- [ ] The same key and the same body again answers `200` with the same `id`, the header `Idempotent-Replay: true`, and the database still holds exactly one order for the key:

  ```bash
  post b -H "Idempotency-Key: $KEY" -d "$BODY"; grep -i '^idempotent-replay' /tmp/h.b; cat /tmp/b.b
  psql "$DATABASE_URL" -c "SELECT count(*) FROM \"Order\" WHERE \"idempotencyKey\" = '$KEY'"
  ```

  → `200`, `idempotent-replay: true`, the same `id` as `/tmp/b.a`, count `1`, and the product's stock dropped by 2 only once → **AC-2**
- [ ] The same key with another address answers `409` `IDEMPOTENCY_KEY_REUSED` and nothing is written:

  ```bash
  post c -H "Idempotency-Key: $KEY" -d "${BODY/Lenin 1/Other 2}"; cat /tmp/b.c
  psql "$DATABASE_URL" -c "SELECT count(*) FROM \"Order\" WHERE \"idempotencyKey\" = '$KEY'"
  ```

  → `409`, `{"code":"IDEMPOTENCY_KEY_REUSED",...}`, count still `1` → **AC-3**
- [ ] An offset form of the same date is the same body: `2026-11-20T12:00:00+03:00` replaces `2026-11-20T09:00:00.000Z`, and the answer is still a replay:

  ```bash
  post d -H "Idempotency-Key: $KEY" -d "${BODY/2026-11-20T09:00:00.000Z/2026-11-20T12:00:00+03:00}"; cat /tmp/b.d
  ```

  → `200` with the same `id`, not `409`, because the fingerprint normalises the date → **AC-2**
- [ ] A key of 3 characters and a key with a space each answer `422` with `property: "Idempotency-Key"`:

  ```bash
  post e -H "Idempotency-Key: abc" -d "$BODY"; cat /tmp/b.e
  post f -H "Idempotency-Key: bad key 1" -d "$BODY"; cat /tmp/b.f
  ```

  → both `422`, `{"code":"VALIDATION",...,"errors":[{"property":"Idempotency-Key",...}]}`, no order row, cart unchanged → **AC-4**
- [ ] No header at all still works and stores `NULL`:

  ```bash
  post g -d "$BODY"
  psql "$DATABASE_URL" -c "SELECT count(*) FROM \"Order\" WHERE \"idempotencyKey\" IS NULL AND \"userId\" = '$USER_ID'"
  ```

  → `201`, the count grows by one → **AC-1**
- [ ] Two creates with one key sent in parallel create exactly one order and one stock deduction, and both answers carry the same `id`:

  ```bash
  KEY=verify-key-race
  post p1 -H "Idempotency-Key: $KEY" -d "$BODY" &
  post p2 -H "Idempotency-Key: $KEY" -d "$BODY" &
  wait
  cat /tmp/b.p1 /tmp/b.p2
  psql "$DATABASE_URL" -c "SELECT count(*) FROM \"Order\" WHERE \"idempotencyKey\" = '$KEY'"
  ```

  → one `201` and one `200`, the same `id` in both bodies, count `1`, the stock dropped by 2 → **AC-6**
- [ ] The race with only one unit of stock, so the loser is refused by the stock check instead of the index. Set the product to `quantity = 2` and the cart to 2, use a fresh key, and expect no `OUT_OF_STOCK`:

  ```bash
  psql "$DATABASE_URL" -c "UPDATE \"Product\" SET quantity = 2, \"isOutOfStock\" = false WHERE id = '$PRODUCT'"
  KEY=verify-key-race-refusal
  post r1 -H "Idempotency-Key: $KEY" -d "$BODY" &
  post r2 -H "Idempotency-Key: $KEY" -d "$BODY" &
  wait
  cat /tmp/b.r1 /tmp/b.r2; grep -i '^idempotent-replay' /tmp/h.r1 /tmp/h.r2
  ```

  → one `201` and one `200` with the same `id`; neither answer is `409 OUT_OF_STOCK`, because the keyed re-read resolves the loser → **AC-6**
- [ ] Two bodies with one key sent in parallel: one `201`, one `409`, one order:

  ```bash
  KEY=verify-key-race-conflict
  post k1 -H "Idempotency-Key: $KEY" -d "$BODY" &
  post k2 -H "Idempotency-Key: $KEY" -d "${BODY/Lenin 1/Other 2}" &
  wait
  cat /tmp/b.k1 /tmp/b.k2
  psql "$DATABASE_URL" -c "SELECT count(*) FROM \"Order\" WHERE \"idempotencyKey\" = '$KEY'"
  ```

  → `201` and `409 IDEMPOTENCY_KEY_REUSED`, count `1` → **AC-3**
- [ ] The cart clears inside the transaction: the ordered row is gone, a second product added to the cart but not ordered stays:

  ```bash
  psql "$DATABASE_URL" -c "SELECT \"productId\", quantity FROM \"CartItem\" WHERE \"userId\" = '$USER_ID'"
  ```

  → no row for `$PRODUCT`, the untouched product's row still holds its quantity → **AC-5**
- [ ] A partial order leaves the remainder: set the cart row to 5, order 2 with a fresh key:

  ```bash
  psql "$DATABASE_URL" -c "UPDATE \"CartItem\" SET quantity = 5 WHERE \"userId\" = '$USER_ID' AND \"productId\" = '$PRODUCT'"
  post s -H "Idempotency-Key: verify-key-partial" -d "$BODY"
  psql "$DATABASE_URL" -c "SELECT quantity FROM \"CartItem\" WHERE \"userId\" = '$USER_ID' AND \"productId\" = '$PRODUCT'"
  ```

  → `201`, the cart row is `3` → **AC-5**
- [ ] A refused order stores no key and leaves the cart alone: empty the cart row, then post with a fresh key:

  ```bash
  psql "$DATABASE_URL" -c "DELETE FROM \"CartItem\" WHERE \"userId\" = '$USER_ID' AND \"productId\" = '$PRODUCT'"
  post t -H "Idempotency-Key: verify-key-refused" -d "$BODY"; cat /tmp/b.t
  psql "$DATABASE_URL" -c "SELECT count(*) FROM \"Order\" WHERE \"idempotencyKey\" = 'verify-key-refused'"
  ```

  → `409 CART_MISMATCH`, count `0`, so the same key can be retried after the cart is fixed → **AC-5**
- [ ] AC-8 (the cart row vanishing mid transaction) and the rollback on a database error inside the clear are proven by the database suite, not by curl, because they need a race or a fault the HTTP layer cannot produce on demand:

  ```bash
  ORDER_DB_TESTS=1 pnpm --filter @astrum/api test -- order.integration
  ```

  → the cart race case logs `cart.clear.skipped` and still commits the order; the injected failure case leaves no order, no stock change and no cart change → **AC-8**
- [ ] Cancel the order of a key, then repeat the key: `200` with `CANCELED`, nothing written:

  ```bash
  ORDER_ID=$(psql "$DATABASE_URL" -tAc "SELECT id FROM \"Order\" WHERE \"idempotencyKey\" = 'verify-key-0001'")
  curl -s -X PATCH "$API/orders/$ORDER_ID/status" -H "cookie: __auth=$TOKEN" -H 'content-type: application/json' -d '{"status":"CANCELED"}' > /dev/null
  post u -H "Idempotency-Key: verify-key-0001" -d "$BODY"; cat /tmp/b.u
  ```

  → `200`, `"status":"CANCELED"` → **AC-7**
- [ ] The same key from a second customer creates that customer's own order:

  ```bash
  curl -s -X POST "$API/orders" -H "cookie: __auth=$TOKEN_B" -H 'content-type: application/json' -H "Idempotency-Key: verify-key-0001" -d "$BODY_B" -w "\n%{http_code}\n"
  ```

  → `201` with an `id` different from the first customer's order → **AC-9**
- [ ] Neither new column leaks into an answer: every order route is checked, not just the create:

  ```bash
  curl -s "$API/orders" -H "cookie: __auth=$TOKEN" | grep -c 'idempotency'
  curl -s "$API/orders/$ORDER_ID" -H "cookie: __auth=$TOKEN" | grep -c 'idempotency'
  grep -c 'idempotency' /tmp/b.a /tmp/b.b
  ```

  → every count is `0` → **AC-12**
- [ ] The preflight from the allowed origin names the header:

  ```bash
  curl -s -i -X OPTIONS "$API/orders" -H 'Origin: http://localhost:3000' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: idempotency-key' | grep -i 'access-control'
  ```

  → `Access-Control-Allow-Headers` contains `Idempotency-Key`, and `Access-Control-Expose-Headers` contains `Idempotent-Replay` → **AC-11**
- [ ] No missed replay in the gateway log: a replicate that loses the race must never log `order.replay.miss`:

  ```bash
  docker compose -f docker-compose.prod.yml logs api | grep -c 'order.replay.miss'
  ```

  → `0` (or no output at all) → **AC-6**
- [ ] Unit and database suites, then the gates:

  ```bash
  pnpm --filter @astrum/api test
  ORDER_DB_TESTS=1 pnpm --filter @astrum/api test -- order.integration
  pnpm quality-gate
  ```

  → the unit run stays green with the database suite skipped, the database run proves the parallel pair and the cart clear, and the gate reports every task successful → **AC-1** to **AC-9**, **AC-12**

## UI / manual

- [ ] Place an order from `/cart`, then click Place order again on the same form before the redirect lands: the order screen shows one order, the cart no longer holds the bought line, and `/orders` lists one new row → **AC-2**, **AC-5**, **AC-10**
- [ ] Throttle the network to offline, submit, restore the network and submit again: the order screen opens the order that was created, no twin appears in `/orders` → **AC-10**
- [ ] Force a refusal (drop the cart line in another tab, then submit), then correct the address and submit: the second attempt is accepted instead of answering `409`, proving the client generated a new key → **AC-10**
- [ ] Complete one order, go back to `/cart`, add the same product again and order it: a second, genuinely new order appears, proving the client discarded the key after the success → **AC-10**
- [ ] After a successful checkout, open `/cart`: the bought products are gone and the unselected ones are still there → **AC-5**

## Value sourcing coverage

- Stored key and fingerprint → the first command step reads both columns and the hash length → **AC-1**
- Replay identity → the second step compares `id` across two answers and counts the rows by key → **AC-2**
- Normalised delivery date → the offset step sends the same instant in another zone and still gets a replay → **AC-2**
- Conflict body → the third and the parallel conflict steps read `code` from the answer while the row count stays at one → **AC-3**
- Invalid header property name → the fourth step reads `errors[0].property` → **AC-4**
- Remaining cart quantity → the partial order step reads `CartItem.quantity` after the order → **AC-5**
- Replay of a cancelled order → the cancel then repeat step reads `status` in the replay body → **AC-7**
- Per user scope → the second customer step compares `id` values across two users → **AC-9**
- Dropped columns → the leak step greps every order answer for the word → **AC-12**
- Preflight header list → the OPTIONS step reads the two `Access-Control` headers → **AC-11**
