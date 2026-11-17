# 0027. Order page redesigned from the mockup — verify

Run these steps on the dev stack after `/develop`. Every step names what a broken run prints, so a green tick on a broken build is not possible. Each command derives its own database credentials from the container, and no step prints the session cookie.

## Verdict

**PASS**, run 2026-11-17 on the dev stack, against the built feature. All eleven acceptance criteria met on live evidence; AC-9 is met for the nine states this pass could reach, with four sub states that no fixture in this database can produce named under Unproven. No step was rewritten: the premise corrections are recorded under Run notes.

## Setup

```bash
cd /e/Astrum/Astrum
PSQL="docker exec astrum-db psql -U $(docker exec astrum-db printenv POSTGRES_USER) -d $(docker exec astrum-db printenv POSTGRES_DB)"
```

The session for the gateway probe is the throwaway one the `astrum-monorepo` skill describes in `references/verifying-the-live-api.md`: one `session:<sid>` record in Redis with a 24 hour TTL and a JWT signed with `JWT_SECRET` carrying the same `sid`, sent in the `__auth` cookie. Sign in through the storefront instead when the browser pass runs, and never echo the cookie.

Fixtures this pass needs, all of them already in the dev database as measured on 2026-11-17: an order with at least three lines, a pickup order (2 distinct pickup points exist), a paid order (38 paid lines), a canceled order (38 canceled lines), and an order carrying a line in one of the three non normal statuses (39 such lines). No line in the database lacks a product row (measured 0), so the null kind branch is covered by the api suite in step 4 and never live.

## Steps

1. **Gates**, covers the whole build. `pnpm check-types` prints five tasks done and exits 0; `pnpm --filter @astrum/api test` and `pnpm --filter @astrum/customer test` print zero failures. A broken run prints a failing suite. `pnpm --filter @astrum/customer lint` exits 0 with no errors, and the `max-lines` rule fails a component over 400 code lines rather than warning about it.

2. **The read publishes the four new values and nothing else**, verifies **AC-1**.
```bash
$PSQL -t -c "select id from \"Order\" where \"pickupPointId\" is not null limit 1"
curl -s -H "Cookie: __auth=$COOKIE" localhost:3580/api/orders/$ORDER_ID \
 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s),l=o.orderItems[0];console.log(JSON.stringify({paidAt:o.paidAt,keys:Object.keys(l).filter(k=>['brandName','kind','subtotal'].includes(k)),leaks:Object.keys(l).filter(k=>['businessId','business'].includes(k)),orderLeaks:Object.keys(o).filter(k=>['idempotencyKey','idempotencyHash','payments'].includes(k)),brand:l.brandName,kind:l.kind,line:l.quantity*l.price,subtotal:l.subtotal},null,1))})"
```
A correct run prints `keys` holding all three names, both leak lists empty, a `brand` equal to the shop name the database holds for that line, and a `subtotal` equal to `line` (the product the browser would have computed). A broken run prints a leak list with `businessId` in it, or an empty `keys` list, or a `subtotal` that differs from `quantity * price` by a floating point tail.

3. **The paid moment is the attempt, not a guess**, verifies **AC-1**.
```bash
$PSQL -t -c "select o.id, p.\"paidAt\" from \"Order\" o join \"Payment\" p on p.\"orderId\" = o.id where p.status = 'PAID' order by p.\"paidAt\" desc limit 1"
```
The `paidAt` printed here is the string the payload prints in step 2 for the same order, the newest one when the order holds two paid attempts. A broken run prints two different instants, or `null` for an order that holds a paid attempt.

4. **Three bounded lookups per detail read, never one per line**, verifies **AC-1**. `pnpm --filter @astrum/api test -- order.service` runs the suite whose Prisma mock counts the calls: a correct run prints one `business.findMany`, one `product.findMany` and one `payment.findFirst` for a three line order and the same three for a one line order, and it prints the create and the status answers without `paidAt`, `brandName` or `kind`. A broken run prints three `product.findMany`, or zero, or a create answer that gained a field.

5. **The header**, verifies **AC-2**, **AC-10**. Open `/orders/<id>` at 1280 wide and read the DOM:
```js
({ number: document.querySelector('[data-testid="order-number"]').textContent,
   subtitle: document.querySelector('[data-testid="order-subtitle"]').textContent,
   pill: document.querySelector('[data-testid="order-status-pill"]').textContent,
   back: !!document.querySelector('[data-testid="order-back"]'),
   print: document.body.textContent.includes('Print') || document.body.textContent.includes('Печать'),
   receipt: /Чек|Receipt #|RCT-/.test(document.body.textContent) })
```
A correct run prints the eight character number, a subtitle holding the line count and one long date, the order status word in the pill, `back: true`, and `false` for both the print and the receipt probes. A broken run prints `true` for the print probe (the dead control came back), or a subtitle whose date sits one day off (the UTC pin, step 12), or the payment word in the status pill.

6. **The line rows**, verifies **AC-3**.
```js
(() => [ ...document.querySelectorAll('[data-testid="order-line"]') ].map(r => ({
  text: r.textContent,
  amount: r.querySelector('[data-testid="order-line-amount"]')?.textContent,
  unit: r.querySelector('[data-testid="order-line-unit"]')?.textContent,
  pill: !!r.querySelector('[data-testid="order-line-status"]'),
})))()
```
A correct run prints one entry per line with the shop name, the product name, the kind and the quantity in the text, the line amount equal to the number the payload sends as `subtotal`, a unit pill reading `<quantity> × <price>`, and `pill: false` on every line of an order whose lines are all normal. The fixture of step 7 turns one of them true. A broken run prints an amount computed in the browser (a tail like `59.97000000000001`), or an empty unit pill, or a pill on a normal line.

7. **A line in a non normal state keeps its pill, a normal one does not**, verifies **AC-3**.
```bash
$PSQL -t -c "select o.id from \"Order\" o join \"OrderItem\" i on i.\"orderId\" = o.id where i.status in ('CANCELLED','OUT_OF_STOCK','RETURNED') and o.status <> 'CANCELED' limit 1"
```
Open that order: the odd line prints its `orders.itemStatus.*` label and its neighbours print none. A broken run prints a pill on all lines, or none at all.

8. **The right column**, verifies **AC-4**, **AC-5**.
```js
(async () => {
  const id = location.pathname.split('/').pop();
  const o = await (await fetch(`/api-gateway/orders/${id}`)).json();
  const money = n => new Intl.NumberFormat(document.documentElement.lang || 'ru', { style: 'currency', currency: o.currency, currencyDisplay: 'narrowSymbol' }).format(n);
  const col = document.querySelector('[data-testid="order-right-column"]');
  return { total: document.querySelector('[data-testid="order-total"]').textContent, expected: money(o.grandTotal),
           goods: money(o.totalPrice), delivery: money(o.deliveryPrice), text: col.textContent,
           steps: document.querySelectorAll('[data-testid="order-progress-step"]').length,
           rail: !!document.querySelector('[data-testid="order-progress"]') };
})()
```
A correct run prints `total` equal to `expected`, the goods and delivery strings both present in the column text, no discount word, `steps: 4`, and `rail: true`. A broken run prints a total that disagrees with `money(grandTotal)` (the browser formatted its own sum), or a column whose text holds only the goods row, or three steps.

9. **The receiving date is printed once, and a canceled order has no rail**, verifies **AC-5**.
```js
(() => {
  const q = s => document.querySelector(s);
  const years = s => (s.match(/20\d\d/g) || []).length;
  const receiving = q('[data-testid="order-receiving"]');
  return { pickup: q('[data-testid="order-pickup-block"]').textContent,
           pickupYears: years(q('[data-testid="order-pickup-block"]').textContent),
           receivingYears: receiving ? years(receiving.textContent) : null,
           rail: !!q('[data-testid="order-progress"]'),
           total: !!q('[data-testid="order-total"]') };
})()
```
Open a delivered pickup order. A correct run prints `pickupYears: 0` (the pickup block carries the point and the address and no date), `receivingYears: 1` (one date, one place), `rail: true` and `total: true`. Then open a `CANCELED` order (`$PSQL -t -c "select id from \"Order\" where status = 'CANCELED' limit 1"`): a correct run prints `receivingYears: null` with `rail: false` and `total: true`, because the receiving block is not rendered at all. A broken run prints `pickupYears: 1` (the date came back to the pickup block), `receivingYears: 2`, or a rail on the canceled order.

10. **The copy control**, verifies **AC-7**. Grant the clipboard read permission over the devtools protocol (`Browser.grantPermissions` with `clipboardReadWrite`), press `[data-testid="order-copy"]`, then:
```js
(async () => ({ copied: await navigator.clipboard.readText(), header: document.querySelector('[data-testid="order-number"]').textContent.trim(), toast: document.body.textContent.includes('copied') || document.body.textContent.includes('скопирован') }))()
```
A correct run prints `copied` equal to the eight characters the header prints without the `#`, and `toast: true`. Then override `navigator.clipboard.writeText = () => Promise.reject(new Error('denied'))`, press again, and assert a failure toast and no unhandled rejection in the console. A broken run prints an empty clipboard, or a copied value that carries the `#`, or an unhandled rejection with no toast.

11. **The pills come from the tokens**, verifies **AC-8**.
```js
[...document.querySelectorAll('[data-testid="order-status-pill"], [data-testid="order-payment-pill"]')].map(p => ({ text: p.textContent, bg: getComputedStyle(p).backgroundColor, color: getComputedStyle(p).color, border: getComputedStyle(p).borderColor }))
```
Open a delivered order, a paid order, a pending order and a canceled order. A correct run prints, for every pill, a `color` that is one of `rgb(74, 222, 128)` (success, `#4ade80`), `rgb(252, 165, 165)` (destructive soft, `#fca5a5`) or `rgb(161, 161, 170)` (muted foreground, `#a1a1aa`), with a translucent background on the theme families and the matching border on the destructive one; the delivered and the paid pill read the success colour, the canceled one the destructive. A broken run prints a colour that belongs to none of the three (`rgb(234, 179, 8)` is the old yellow, `rgb(59, 130, 246)` the old blue), or a pill whose text is empty for a status the table does not name.

12. **The two widths and the sticky column**, verifies **AC-6**, and the date zone, verifies **AC-11**. At 1280, then at 390:
```js
({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
   tracks: getComputedStyle(document.querySelector('[data-testid="order-grid"]')).gridTemplateColumns,
   stickyTop: getComputedStyle(document.querySelector('[data-testid="order-right-column"]')).top })
```
A correct run prints `overflow: 0` at both widths, two tracks at 1280 (the second one `380px`) and one track at 390, and `stickyTop: 96px` at 1280. A broken run prints a positive overflow at 390, or two tracks at 390. Then set the `NEXT_LOCALE` cookie to `ru`, reload, and check that every printed date still names the day the database holds (`$PSQL -t -c "select \"createdAt\", \"deliveryDate\", \"handedOverAt\" from \"Order\" where id = '<id>'"`): a correct run prints the same day, a run reading the UTC pin prints the day before for a stamp after 21:00 Moscow time.

13. **The states behave as before**, verifies **AC-9**. In one pass: `/orders/no-such-id` renders the not found screen with its two buttons and no console error; a throttled reload renders the skeleton before the content; the cancel dialog opens for a `PENDING` order, its copy reads the two sentences of spec 0011 and its keep control holds the initial focus; cancelling an order whose line already shipped raises `orders.cancelBlockedByLine` with the line status word inside it, and the screen re reads the order (the pill changes without a manual reload); the pay button on a `STRIPE` order still navigates to the provider and the return branch still renders the checking screen. A broken run prints the not found screen for a real id, or a toast with no re read (the pill keeps the state the gateway just refused).

14. **No value literal, no dead key, no dead class**, verifies **AC-11**, **AC-10**.
```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b|toFixed\(|(bg|text|border|from|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}" apps/customer/src/features/pages/Orders/OrderPage
grep -rn "CARD_CLASS" apps/customer/src
node -e "const en=require('./apps/customer/messages/en.json'),ru=require('./apps/customer/messages/ru.json');const k=o=>JSON.stringify(Object.keys(o.orders).sort());console.log('parity',k(en)===k(ru));console.log('print key',('print' in en.orders),('print' in ru.orders));const need=['itemsCount','lineMeta','copyNumber','copySuccess','copyFailed','totalNote','receiving','receivingLine','handedOverOn','expectedOn','goods','delivery'];console.log('missing',need.filter(n=>!(n in en.orders)||!(n in ru.orders)));const gone=['print','placedOn','itemsTitle','columns','summary','subtotal','shipping','shippingMethod','deliveryStatus','deliveryDate','pickupDate','handedOverAt','price'];console.log('still there',gone.filter(n=>n in en.orders||n in ru.orders))"
```
A correct run prints nothing from both greps, `parity true`, `print key false false`, `missing []` and `still there []`. A broken run prints a hit from the first grep, `parity false`, a name inside `missing`, or a retired key inside `still there`.

## Step outcomes, run 2026-11-17

| Step | Result | Evidence |
|---|---|---|
| 1 Gates | pass | `pnpm check-types` 5 of 5 tasks, 2.9 s; api 52 suites / 459 tests, 20 skipped, 0 failed; customer 85 files / 451 tests, 0 failed; `pnpm --filter @astrum/customer lint` 0 errors, 13 warnings |
| 2 The four new values | pass | `GET /api/orders/cmwe4l24a…` 200; `keys` = `brandName`, `kind`, `subtotal`; both leak lists empty; `brandName` = `Shop cel_20`; every `subtotal` equals `quantity * price` exactly; ownership probe 404, no cookie 401 |
| 3 The paid moment | pass | database `payment.paidAt` 2026-11-12 22:34:55.464 and payload `2026-11-12T22:34:55.464Z`, the same instant |
| 4 Three bounded lookups | pass | `order.service` suite green inside the api run; `order.service.spec.ts` counts one `business.findMany`, one `product.findMany` and one `payment.findFirst` per detail read |
| 5 The header | pass | `Order #0x0ft9au`, subtitle `3 items · November 13, 2026`, pill `Pending`, `back: true`, print probe false, receipt probe false, `aria-label` `Copy order number` |
| 6 The line rows | pass | three rows, each printing the shop, the product, `kind · 1 pc`, the line amount `₽5,291.00` / `₽24,104.30` / `₽2,574.00` matching the payload `subtotal`, a unit pill `1 × ₽…`, and no pill on the two normal lines |
| 7 A non normal line | pass | `cmwe4l24a…` third line prints `Out of stock`, its two neighbours print none |
| 8 The right column | pass | `order-total` `₽31,969.30` equals a formatting of the payload `grandTotal`; goods and delivery rows present; no discount word; `steps: 4`; rail 0 % on PENDING |
| 9 Date printed once, canceled has no rail | pass | delivered pickup `cmwgjiu8n…`: pickup block holds 0 years, receiving 1 (`Handed over on November 15, 2026`), rail true, total true; canceled `cmwcctro…`: no receiving element, no rail, total and breakdown stay |
| 10 The copy control | pass | clipboard held `0x0ft9au` after the press, toast `Order number copied`; with `writeText` rejecting, toast `Could not copy the order number` and the screen kept working |
| 11 The pill tones | pass | neutral `rgb(161, 161, 170)` for Pending and Payment pending, success `rgb(74, 222, 128)` for Delivered and Paid, destructive `rgb(252, 165, 165)` for Cancelled, Payment cancelled and the canceled line; every pill one line, 27 px tall |
| 12 Widths, sticky and the zone | pass | 1280: overflow 0, tracks `720px 380px` (second 380), `stickyTop: 96px`; 390: overflow 0, one track; ru locale prints 13 ноября 2026 г. for the stamp the database holds as 2026-11-12 22:34 UTC, so no UTC pin |
| 13 The states | pass with four sub states unproven | `/orders/no-such-id` renders Order Not Found with its way back; a throttled reload shows the spinner of `LoadingScreen` at 4 s and the content at 12 s; the cancel dialog opens for a PENDING order with `Keep the order` focused and the second sentence present for a pending payment; confirming on an order with a SHIPPED line raises `The order can’t be cancelled: an item is already “Shipped”` and the order re reads (3 resource reads, pill stays Pending); the payment block answers the expired window and the live window |
| 14 No bare literal, no dead key | pass | both greps print nothing; `parity true`, `print key false false`, `missing []`, `still there []` |

## Run notes, 2026-11-17

**Fixtures and sessions.** The session was hand minted for the seeded buyer `cad2d741-…` (one `session:<sid>` in Redis with a 2 hour TTL plus a JWT with the same sid), because the seeded passwords are not recorded. Every order this pass visited belongs to that account: `cmwe4l24a…` (3 lines, one `OUT_OF_STOCK`, pickup, paid, window passed), `cmwgjiu8n…` (delivered pickup, paid, `handedOverAt` set), `cmwcctro…` (canceled, 4 lines), `cmwfh4ttc…` (pending payment, pickup, window passed), `cmw25deon…` (delivered, delivery address, unpaid, 3 lines). The sid was deleted after the run. Two temporary database edits were made and both were put back and read back: one line of `cmwfh4ttc…` was set to `SHIPPED` to reach the cancel refusal and then to `PENDING`, and `cmwfh4ttc….paymentExpiresAt` was moved two hours forward to render the payable branch and then restored to `2026-11-13 21:45:36.238`. No order status and no payment status changed, and no row was created.

**Premise corrections.**
- Step 13 says the not found screen carries two buttons; it carries one, `Back to Orders` (`components/OrderNotFound/index.tsx`, untouched by this feature and unchanged from spec 0011). The state itself is proved: the title, the sentence and the way back render, and the failed read raises its own toast.
- Step 12 expects `stickyTop: 96px` at 1280 and `auto` under `lg`; that is what it prints. The sticky offset is measured on the right column, not on the grid, so the value only exists at the wide width.
- Step 10 assumes one press suffices. In this harness the first pointer click after a fresh navigation lands on nothing (`window.__clicks` stays empty) and the second one is delivered; the copy control itself answered on a real pointer press (`pointerdown` and `click` both named `order-copy`, `writeText` called with `0x0ft9au` and resolved). The cancel trigger needed `Emulation.setFocusEmulationEnabled` and `Page.bringToFront` before its press registered; with both on, `pointerdown` and `click` reached the button and the dialog opened.
- Step 6 expects a photographed thumb. The three lines of `cmwe4l24a…` carry `placehold.co` sources, which this offline host cannot fetch, so the thumb paints its `Package` fallback; the `Image` element and its alt wiring are in the DOM, the picture is not. That is the seeded data, not the screen.

**What the mockup draws and the screen does not**, as AC-10 requires: no print control (probe false), no receipt token, no discount row, no savings line, no support block, no tab strip of its own.

**Not observed, and what would be needed.**
- The pay press that navigates to the provider and the payment checking branch it returns through (spec 0015, AC-14 here): a press creates a provider session, so this pass rendered the payable state `Pay now` and stopped there. A throwaway order with a live window on a test provider account would prove it.
- The return branch copy for a payment the provider has not confirmed and the `cancelled` branch: same cause, both read `PaymentReturnBranch` from the query string and need a real return from the provider.
- A successful cancellation: exercising it would move a real order to `CANCELED` and return stock to the products. The refusal branch was exercised instead, which proves the dialog, the request and the re read without writing.
- The delivery date fallback on a delivered order was observed on a row whose `handedOverAt` is null (`cmw25deon…`, `Expected on November 6, 2026`); the `handedOverAt` branch was observed on `cmwgjiu8n…`.

**Look worth a second opinion, not a failure.** On a payable order the deadline prints twice, once as the payment block's second line (`Pay before 6:39 PM`) and once under the pay button, because AC-4 keeps both. Both are specced; whether the pair reads as clutter is a design call.

**Console.** No `console.error`, no warning and no unhandled rejection on three of these screens, collected by instrumenting `console` before the document loaded.
