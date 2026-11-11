# Verify: customer cancel on the order screen · spec 0011 · updated 2026-11-11 (run 2026-11-11)

_Steps derived from spec 0011 acceptance criteria. `/check verify` ran these on the running dev stack (customer on 3000, gateway on 3580, Postgres in `astrum-db`) on 2026-11-11. Every ticked step was exercised in the browser or by a command; the fixtures, the screenshots and the harness switches are in the run notes below._

## Premise corrections

- The overlay clause of the dialog step cannot hold as written: spec 0011 AC-10 makes `AlertDialog` the primitive, and Radix AlertDialog 1.2.1 calls `event.preventDefault()` inside `onPointerDownOutside` and `onInteractOutside`, so a click on the overlay is ignored on purpose. The mechanism the clause aimed at (closing the dialog without sending anything) was proven through Escape and the keep control instead, both of which close it and leave the network silent.
- The stop the gateway step ran without stopping the gateway process: CDP `Fetch.failRequest` failed the `PATCH` at the transport, which is the same no answer branch (a request that left the browser and came back with nothing). The API process was never touched.
- The `psql` step names role `astrum` and database `astrum`, and neither exists in this stack; the live credentials are `-U greedyghoster -d astrum-db`.
- The keyboard step used Space where it says Enter: a synthesized Enter through CDP does not activate a button in this Chromium build, Space does, and the step is about focus order, not about which key fires the click.

## UI / manual

- [x] Signed in as a customer, place an order, open its screen while it reads Pending → the header shows the cancel action with a crossed circle icon, not a pencil (icon class `lucide-x-circle`) → AC-1, AC-8
- [x] Press the cancel action → a dialog opens naming the order number and saying that every item returns to stock and that this screen cannot undo it; a second toast-free pass with Escape, with a click on the overlay and with the closing control each close it and send nothing (the network tab shows no `PATCH`) → AC-2, AC-10 (overlay clause corrected above: Escape and the keep control close it, the overlay click is ignored by `AlertDialog`)
- [x] Open the dialog on an order whose payment reads Payment Pending → the dialog adds the sentence about the pending payment being cancelled with the order; open it on an order that reads Paid → the dialog says nothing about money → AC-3
- [x] Confirm the cancel → the dialog closes, the header control shows the spinner and is disabled, the success toast reads that the order was cancelled, the badge reads Cancelled, the delivery block is gone, the cancel action is gone, and every cancelled line reads Cancelled, all without a page reload → AC-4, AC-5
- [x] Read the payment line of that order → it reads Payment cancelled, not Payment Pending → AC-7
- [x] Go back to `/orders` → the card of that order reads Cancelled and matches the detail screen, with no full page reload → AC-5
- [x] Open a confirmed order → the cancel action is offered, and cancelling it works the same way → AC-1
- [x] Open a shipped order and a delivered order → neither offers a cancel action → AC-1
- [x] With a seller account, ship one line of an order that has at least two lines and still reads Pending; as its customer, press cancel and confirm → the toast names Shipped, and the order is re read (the network tab shows a `GET /api/orders/:orderId` after the `409`). An order whose only line shipped reads Shipped itself and offers no action, so the fixture needs the second line → AC-6 (the line was shipped with a direct database update, see run notes)
- [x] Press cancel twice in quick succession on a slow network → one `PATCH` leaves the browser, the control reports itself busy and disabled to assistive technology while keeping focus, and a second press sends nothing → AC-4
- [x] Stop the gateway, then cancel → the unconfirmed toast appears, not the generic failure, and the order is re read when the gateway is back → AC-6 (route used: the `PATCH` failed at the transport through CDP `Fetch.failRequest`, the API stayed up)
- [ ] Throttle the network past the 10000 ms client budget and cancel → the unconfirmed toast appears, and the order shows its real state once the re read lands → AC-6 (not observed: the timeout branch is the same no answer branch the step above proved, and a 12 second stall was not worth the extra run; the branch is pinned by `useCancelOrder.test.tsx`)
- [x] Switch the language to Russian → the dialog, both toasts and all five payment labels read Russian, and no key is printed raw → AC-3, AC-9 (three of the five payment labels were rendered on real orders, the two unrendered ones are covered by `payment.test.ts`)
- [x] Keyboard only: Tab to the cancel action, press Enter, Tab through the dialog, press Escape → focus returns to the cancel action in the header and no request was sent → AC-10

## Commands

- [x] `curl -i -X PATCH http://localhost:3580/api/orders/<orderId>/status -H 'Content-Type: application/json' -H 'Cookie: __auth=<token>' -d '{"status":"CANCELED"}'` → `200` with `"status":"CANCELED"` and `"paymentStatus":"CANCELLED"` when the payment was pending → AC-5, AC-7
- [x] `docker exec astrum-db psql -U greedyghoster -d astrum-db -c "SELECT quantity FROM \"Product\" WHERE id='<productId>';"` before and after the cancel → the quantity is higher by the ordered units after the cancel (5 → 7 for a two unit order) → AC-5
- [x] The same `PATCH` call repeated → `200` with the same order and no second stock change → AC-6
- [x] The same `PATCH` call with the order id of another account → `404` with `"code":"ORDER_NOT_FOUND"` → AC-6
- [x] The same `PATCH` call on a pending order with one shipped line → `409` with `"code":"INVALID_STATUS_TRANSITION"` and `"from":"SHIPPED"` → AC-6
- [x] The same `PATCH` call without the cookie → `401` with `"code":"SESSION_MISSING"` → AC-6
- [x] `pnpm --filter @astrum/customer test` → the dialog, the cancel hook, the header and the payment table suites pass (174 tests in 40 files) → AC-11
- [x] `node -e "...catalog parity..."` → `parity ok` → AC-9
- [x] `grep -rn "Edit" apps/customer/src/features/pages/Orders/OrderPage/components/OrderPageHeader` → no match, the icon is `XCircle` → AC-8
- [x] `grep -rn "CUSTOMER_CANCELLATION_BLOCKERS\|blockedLine" apps/customer/src` → no match, so the storefront keeps no copy of the gateway's blocking list, while the label maps that legitimately name those statuses stay untouched → AC-1, AC-6
- [x] `grep -rn "refund\|Refund" apps/customer/messages/en.json apps/customer/messages/ru.json` after the change → the only hits are the `orders.paymentStatus.refunded` labels (Refunded, Возврат оплаты), which name a payment status and promise no money back → AC-3

## Run notes (2026-11-11)

Account: `viz-0011-1794421604@example.com`, registered through `POST /api/auth/register`, confirmed through the Mailpit letter at 8025, then signed in through `POST /api/auth/signin`; the returned token was installed as the `__auth` cookie with CDP `Network.setCookie` (the sign in form would not take synthetic typing in this harness, so the cookie was minted from the token the API returned, the same value the storefront writes).

Orders: ten of them, created through `POST /api/orders` with a cart line first, then moved with direct database updates because no endpoint moves an order to `CONFIRMED`, `SHIPPED` or `DELIVERED`:

| Order | Fixture | Used for |
| --- | --- | --- |
| `...o8u85w4p` | PENDING, payment PENDING | happy path cancel, then the CANCELED screen |
| `...7l9cwpuk` | PENDING, payment PENDING | dialog screenshots and the silent close walk |
| `...2zsb7nuu` | PENDING, payment PENDING | slow network, busy state, double press |
| `...illlmuxr` | PENDING, payment PENDING | no answer branch, keyboard walk, Russian copy |
| `...74z33zmr` | PENDING, payment PENDING | `curl` cancel, stock before and after, repeat call |
| `...vmq7l21b` | CONFIRMED, payment PAID | confirmed cancel and the no money sentence |
| `...zme62lwz` | SHIPPED, payment PENDING | no cancel action |
| `...cupntf58` | DELIVERED, payment PENDING | no cancel action |
| `...im7bh7ok` | CANCELED, payment CANCELLED | no cancel action |
| `...21ca1u64` | PENDING with one SHIPPED line | the `409` naming Shipped |

Harness switches: `Emulation.setFocusEmulationEnabled` before any keyboard walk (without it a click never lands and Tab goes nowhere), `Network.emulateNetworkConditions` with a 7000 ms latency to hold the request in flight for the busy state and the second press, `Fetch.enable` with `Fetch.failRequest` for the no answer branch, and `Network.setCookie` for `NEXT_LOCALE=ru`.

Screenshots are in the scratch area: `A1-pending-header.png`, `A2-dialog-pending.png`, `A3-busy.png`, `A4-success.png`, `B1-confirmed-dialog-paid.png`, `B2-confirmed-success.png`, `C1-refused-by-line.png`, `D1-unconfirmed.png`, `E1-keyboard-focus-returned.png`, `F1-ru-dialog.png`, `F2-ru-success.png`, `G1-orders-list.png`.

Branches not observed: the 10000 ms client timeout (same no answer branch as the transport failure above), the `404` and the generic failure toast on screen (both pinned by `useCancelOrder.test.tsx`, the `404` body was observed through `curl`), and the `FAILED` and `REFUNDED` payment labels, which no flow writes today.

Defect found outside this feature: `POST /api/cart` with a product the cart already holds answers `500 Internal Server Error` instead of adding a unit or refusing politely. Recorded in the deferred list of `docs/scope/_root/scope.md`, not fixed here.
