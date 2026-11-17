# 0027. Order page redesigned from the mockup

**Date**: 2026-11-17
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The customer order screen at `/orders/[id]` is redrawn as the mockup draws it: one left card holding the order header, the line rows, the pickup or delivery block and the payment block, and one right column holding the paid total with its breakdown, the receiving block and a four step progress rail. The gateway detail read grows by three line values (the shop name, the product kind and the line amount) and one order value (the moment the payment was taken), because the drawing prints values the answer never carried. No table changes, no migration, no new environment variable. Three blocks the mockup draws have nothing behind them (the receipt actions, the discount and savings line, the support contact) and stay out of this feature.

## Requirements

**User stories**:

- As a customer, I want the whole order on one screen, so that I recognise it without opening a second page.
- As a customer, I want the shop, the kind of each item and its quantity in the row, so that two similar products are told apart.
- As a customer, I want the total, its breakdown and the delivery progress as one block, so that the amount and the state are read together.
- As a customer, I want to copy the order number with one press, so that I hand it to support without retyping it.
- As the shop, I want every amount and every date on this screen to come from one server decided value and one formatter, so that the screen never prints a figure nothing backs.

**Acceptance criteria** (the contract):

- **AC-1**: `GET /api/orders/:id` publishes four values it does not carry today, and publishes nothing else new. The route keeps its path, its mount (`app.use("/api/orders", authenticateToken, orderRoutes)` in `apps/api-astrum/src/app.ts:84`), its handler and its ownership rule (`getOrderById` reads `where: { id: orderId, userId }`, so another account's order answers `404`). The row read itself does not change: `ORDER_DETAIL_INCLUDE` stays `{ OrderItem: true }` at every call site, because `toOrderDetail` also shapes the idempotent replay answer of `POST /orders` (spec 0003) and the answer of `PATCH /orders/:id/status`, and neither may gain a field. `getOrderById` composes three bounded lookups beside the row and hands them to the mapper: `prisma.business.findMany({ where: { id: { in: distinctLineBusinessIds } }, select: { id: true, name: true } })`, `prisma.product.findMany({ where: { id: { in: distinctLineProductIds } }, select: { id: true, subcategory: true } })` and `prisma.payment.findFirst({ where: { orderId, status: "PAID", paidAt: { not: null } }, orderBy: { paidAt: "desc" }, select: { paidAt: true } })`. That is three extra statements per detail read, each bounded by one order and none of them per line. The answer keeps the row shape it has today, plus:
  - on the order: `paidAt: string | null`, the stamp of that one attempt, null when the order holds no `PAID` attempt or the newest one carries no stamp.
  - on each `orderItems[]` entry: `brandName: string`, the `business.name` of the line; `kind: string | null`, the `subcategory` of the line's product, null when no product row carries that id and null when the row carries an empty `subcategory` (the column is nullable, `packages/Astrum-db/prisma/schema.prisma:88`); `subtotal: number`, `toMoney(Number(price) * quantity)`, so the client never multiplies money.
  - the three values the mapper already strips stay stripped: `businessId` on every line, `idempotencyKey` and `idempotencyHash` on the order, and the lookup maps stay internal, so no `business`, `product` or `payments` object reaches the answer.

- **AC-2**: The screen is one grid: a left card and a right column. The left card opens with the order header: a back control at the left (`data-testid="order-back"`, `ArrowLeft`, `router.back()`, kept although the mockup draws none, because it is the only way back out of the screen and AC-10 leaves navigation to the shell), the number `#<last 8 characters of id>` at `text-2xl font-bold tracking-[-0.02em]` inside `h1` (`data-testid="order-number"`), a copy control beside it (icon button, `aria-label` from the catalog, `data-testid="order-copy"`), a muted subtitle (`data-testid="order-subtitle"`) reading `{items} · {date}` where `{items}` is `orders.itemsCount` given `count = orderItems.length` and the date is `order.createdAt` through `useFormatter().dateTime(new Date(createdAt), { dateStyle: "long", timeZone: browserTimeZone() })`, and at the far right of the same row the order status pill (`data-testid="order-status-pill"`). The header carries no print control and the subtitle carries no receipt token.

- **AC-3**: Under the header, separated by a `border-t border-border`, one row per line (`data-testid="order-line"`, `py-3.5`, a `border-b border-border` between rows and none under the last): a 64 by 64 thumb (`rounded-lg bg-secondary`, `item.previewImage` through `Image`, its alt text from `orders.productImage` because the `item.product` object the client type declares never arrives in this answer), then a column with `brandName` (`text-[12.5px] text-muted-foreground`), `name` (`font-medium`), and the kind and quantity line: `orders.lineMeta` as `{kind} · {count, plural, one {# pc} other {# pcs}}` when `kind` is set, and the kept `orders.quantity` alone when it is null; then at the right the line amount (`data-testid="order-line-amount"`, `subtotal` through `formatMoney`, `text-base font-semibold tabular-nums`) with the unit price pill under it (`data-testid="order-line-unit"`, `{quantity} × {price}`, both numbers formatted, `rounded-full border border-border px-2.5 py-[2px] text-xs text-muted-foreground tabular-nums`). A line whose status is `CANCELLED`, `OUT_OF_STOCK` or `RETURNED` prints a status pill under the kind and quantity line (`data-testid="order-line-status"`), labelled through `itemStatusKey` and the `orders.itemStatus.*` catalog; every other line status prints no pill and no element.

- **AC-4**: The left card closes with two sub blocks (`rounded-stat border border-border bg-background p-5`): the pickup or delivery block (`data-testid="order-pickup-block"`) and the payment block (`data-testid="order-payment-block"`). The pickup block prints the heading `orders.pickupPoint` or `orders.deliveryAddress` (chosen on `pickupPointId !== null`), and either `pickupPointName` with `pickupPointAddress`, or `deliveryAddress`. It prints no date. The payment block prints the heading `orders.paymentMethod`, the method label from the `orders.payment.*` table keyed by `paymentMethod`, the payment status pill (`data-testid="order-payment-pill"`), and one second line chosen in this order: `paidAt` through `useFormatter` with `{ dateStyle: "long", timeStyle: "short", timeZone: browserTimeZone() }` when `paymentStatus` is `PAID` and `paidAt` is not null, otherwise the `paymentExpiresAt` deadline through `orders.payment.payBefore` when that value is set, otherwise nothing. The `PaymentActions` block keeps its place under the method line and its behaviour (the pay button, the window states, the refusals of spec 0015).

- **AC-5**: The right column (`data-testid="order-right-column"`, `lg:sticky lg:top-24`, `rounded-xl border border-border bg-card`) prints, top to bottom: the label `orders.totalPaid` when `paymentStatus` is `PAID` and `orders.total` otherwise, the big amount `grandTotal` through `formatMoney` at `text-[40px] font-bold tracking-[-0.02em] tabular-nums` (`data-testid="order-total"`), the muted note `orders.totalNote`, a separator, and the breakdown as two rows: `orders.goods` with `totalPrice`, then `orders.delivery` with `deliveryPrice`, both through `formatMoney`. No discount row and no savings line is printed. Then a separator and the receiving block (`data-testid="order-receiving"`): heading `orders.receiving`, the line `orders.receivingLine` (`{method} · {point}`) filled with `shippingMethodName` and `pickupPointName` for a pickup order, and `shippingMethodName` alone for a delivery order, the date printed once (`orders.handedOverOn` with `handedOverAt` when it is set, otherwise `orders.expectedOn` with `deliveryDate`, both `dateStyle: "long"` and `browserTimeZone()`), the 6px rail (`h-1.5 rounded-full bg-border` with an inner `bg-foreground` bar whose `style={{ width: `${DELIVERY_PROGRESS[status]}%` }}` reads the table in `lib/status.ts`, `data-testid="order-progress"`, and a `PENDING` order fills 0 % while the first label already reads reached, exactly as today), and the four step labels under it from `orders.status.*` (`data-testid="order-progress-step"`), the reached ones `text-foreground` and the rest `text-muted-foreground`. For a `CANCELED` order the receiving block, its date and the rail are not rendered; the total, the note and the breakdown stay.

- **AC-6**: The grid (`data-testid="order-grid"`) is `grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]`, so below 1024px the two columns stack and nothing scrolls sideways at 390 wide. The screen wrapper takes the mockup's own geometry: `mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-6 lg:px-10 lg:pt-9`, and the sticky column sticks at 96px, which is the 64px sticky navbar plus one 32px step.

- **AC-7**: The copy control copies the order number as the header prints it (the last 8 characters of the id, no `#`), through `navigator.clipboard.writeText` inside a handler, and raises `showToast({ title: t("copySuccess"), type: "success" })` from `@/common/helpers/showToast` inside that handler. A clipboard that refuses (an insecure origin, a denied permission) raises `showToast({ title: t("copyFailed"), type: "error" })` instead, never an unhandled rejection and never a silent nothing. The control is a focusable button with its catalog `aria-label`, and it is not rendered while the order has not loaded.

- **AC-8**: Every status pill on this screen is drawn from theme tokens and from one lookup table, never from a Tailwind colour literal: `success` (`bg-success/10`, `border-success/20`, `text-success`) for a `DELIVERED` order and a `PAID` payment; `destructive` (`bg-destructive-line/20`, `border-destructive-line/40`, `text-destructive-soft`) for a `CANCELED` order and a `FAILED`, `CANCELLED` or `REFUNDED` payment; `neutral` (`bg-surface-raised`, `border-border`, `text-muted-foreground`) for `PENDING`, `CONFIRMED` and `SHIPPED`. A status outside those tables falls back to `neutral` and prints the raw value, never a blank. The line pill of AC-3 takes the same three sets from `LINE_TONES`: `destructive` for `CANCELLED` and `RETURNED`, `neutral` for `OUT_OF_STOCK`. The pill is a `rounded-full border px-2.5 py-[3px] text-[12.5px] font-medium whitespace-nowrap` element the feature owns; the vendored `Badge` is not used for it.

- **AC-9**: The states the screen answers behave exactly as they do today: the payment checking branch replaces the page, the loading branch renders `LoadingScreen` (the `Loader2` spinner it renders today, not a skeleton), a refused or failed read renders `OrderNotFound`, a not yet loaded order renders `LoadingScreen` too, the cancel action renders only for `canCancel(status)` and keeps its dialog, its irreversible confirm copy and its three refusal branches of spec 0011, and the pay action keeps the four window states of spec 0015. The cancel mutation does not change: `hooks/order/useUpdateOrderStatus.ts` still writes the answered order into the detail key before the fresh read, and `useCancelOrder` still reads the order again on every refusal.

- **AC-10**: The screen renders no block the data cannot back: no receipt actions (download, email, print), no receipt number in the subtitle, no discount row, no savings line, no support contact block, and no top navigation of its own (the mockup's `Мои заказы · Продажи · Заказ` tabs are the `Navbar`'s job and stay out).

- **AC-11**: Every amount prints through `formatMoney(amount, order.currency, locale)` with the locale from `useLocale()`, including the line amount and the unit price pill, because the screen prints one currency and no `OrderItem` row carries a currency other than its order's (measured on the dev database, `select count(*) from "OrderItem" i join "Order" o on o.id = i."orderId" where i.currency <> o.currency` prints 0). Every content date prints through `useFormatter` with an explicit `timeZone: browserTimeZone()`. No `toFixed`, no currency symbol, no hex literal and no Tailwind palette class appears in the feature: `grep -rnE "#[0-9a-fA-F]{3,8}\b|toFixed\(|(bg|text|border|from|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}" apps/customer/src/features/pages/Orders/OrderPage` prints nothing, and the `hsl(var(--card))` class (`CARD_CLASS` in `lib/styles.ts`) and the `border-gray-600` constant (`OUTLINE_BUTTON_CLASS`, whose two callers move to the `destructive-outline` variant of `Button` at `components/ui/button.tsx:21`) are gone. The retuned catalogs carry every new key in `en.json` and `ru.json` with equal sets, and every `orders.*` key this redraw retires is deleted from both files. The new names are `lineMeta`, `copyNumber`, `copySuccess`, `copyFailed`, `totalNote`, `receiving`, `receivingLine`, `handedOverOn`, `expectedOn`, `goods` and `delivery`; `orders.itemsCount`, `orders.quantity`, `orders.productFallback`, `orders.productImage`, `orders.detailsFailed`, `orders.paymentMethod`, `orders.deliveryAddress`, `orders.pickupPoint`, `orders.total` and `orders.totalPaid` stay as they are; the retired ones are `orders.print`, `orders.placedOn`, `orders.itemsTitle`, `orders.columns` (the whole object), `orders.summary`, `orders.subtotal`, `orders.shipping`, `orders.shippingMethod`, `orders.deliveryStatus`, `orders.deliveryDate`, `orders.pickupDate`, `orders.handedOverAt` and `orders.price`.

## Decision

**Chosen option**: Option 1: redraw the screen in place and widen the detail read by one join and one query.

The screen keeps its feature folder, its data hooks and its refusal library, and is rewritten component by component around the mockup's structure; the gateway detail read grows by the shop name, the product kind, the line amount and the paid timestamp, all of them server side.

**Implementation skills**: none installed for this stack. `astrum-monorepo` (local skill, `~/.hermes/skills/astrum-monorepo/`) carries this repository's own rules and was consulted; it is not a community skill and is not listed as one.

## Feature design

**Data model sketch**: no table changes. The read shape only.

| Where | Field | Type | Source | Note |
|---|---|---|---|---|
| order | `paidAt` | `string \| null` (ISO) | `Payment.paidAt` of the newest `PAID` attempt, read by one `payment.findFirst` | no `payments` array is read, so nothing extra is published |
| order line | `brandName` | `string` | `Business.name` | join on the existing `businessId` |
| order line | `kind` | `string \| null` | `Product.subcategory` | second query; `OrderItem` has no `Product` relation |
| order line | `subtotal` | `number` | `toMoney(Number(price) * quantity)` | computed on the server |
| order line | `previewImage`, `name`, `price`, `quantity`, `status`, `receiptDate` | unchanged | the row | printed as today |
| order | `totalPrice`, `deliveryPrice`, `grandTotal`, `currency`, `pickupPointName`, `pickupPointAddress`, `handedOverAt`, `deliveryDate`, `shippingMethodName`, `paymentMethod`, `paymentStatus`, `paymentExpiresAt`, `status`, `createdAt` | unchanged | the row | already in the answer |

**State transitions**: no new state. The rail reads `statusStepIndex` over the existing order status machine (`PENDING → CONFIRMED → SHIPPED → DELIVERED`, `CANCELED` from `PENDING` or `CONFIRMED`, spec 0011 and 0016), and `CANCELED` renders no rail.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/orders/:orderId` | GET | path `orderId` | the order row plus `paidAt`, and `orderItems[]` plus `brandName`, `kind`, `subtotal` | `authenticateToken` (mounted at `app.use("/api/orders", …)`), ownership by `where: { id, userId }` | `404` for a missing order or another account's order |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| header | order number | `order.id.slice(-8)`, the display convention the screen already uses |
| header | copy control payload | the same slice, `order.id.slice(-8)` |
| header | line count | `order.orderItems.length`, `orders.itemsCount` |
| header | placed date | `order.createdAt` through `useFormatter` with `browserTimeZone()` |
| header | status pill label | `STATUS_KEYS[order.status]` into `orders.status.*` |
| header | status pill tone | `STATUS_TONES[order.status]` (the table AC-8 fixes) |
| line row | thumb | `item.previewImage`, the snapshot column; `item.product` is declared on the client type and never sent by this read, so no fallback is read |
| line row | shop name | `item.brandName` (new, AC-1, from the `business.findMany` of that method) |
| line row | product name | `item.name`, falling back to `orders.productFallback` with the id tail |
| line row | kind | `item.kind` (new, AC-1), omitted when null |
| line row | quantity | `item.quantity` |
| line row | line amount | `item.subtotal` (new, AC-1), never `quantity * price` in the browser |
| line row | unit price pill | `item.quantity` and `item.price`, both through `formatMoney` |
| line row | line status pill | `itemStatusKey(item.status)` into `orders.itemStatus.*`, rendered only for the three states AC-3 names |
| pickup block | heading | `order.pickupPointId !== null` |
| pickup block | point or address | `order.pickupPointName`, `order.pickupPointAddress`, `order.deliveryAddress` |
| payment block | method label | `PAYMENT_KEYS[order.paymentMethod]` into `orders.payment.*` |
| payment block | status pill | `paymentStatusKey(order.paymentStatus)` into `orders.paymentStatus.*`, tone from `PAYMENT_TONES` |
| payment block | second line | `order.paidAt` when paid, else `order.paymentExpiresAt` through `orders.payment.payBefore`, else nothing |
| right column | total label | `order.paymentStatus === "PAID"` chooses `orders.totalPaid` or `orders.total` |
| right column | total amount | `order.grandTotal` through `formatMoney` |
| right column | goods row | `order.totalPrice` through `formatMoney` |
| right column | delivery row | `order.deliveryPrice` through `formatMoney` |
| right column | receiving method line | `orders.receivingLine` filled with `order.shippingMethodName` and `order.pickupPointName` (pickup) or the method alone (delivery) |
| right column | receiving date | `order.handedOverAt` else `order.deliveryDate`, one of them, through `useFormatter` with `browserTimeZone()` |
| right column | rail width | `DELIVERY_PROGRESS[order.status]` from `lib/status.ts` |
| right column | four step labels | `orders.status.*` for the four statuses of `DELIVERY_STEPS` |

**Key invariants**:

- The browser never multiplies money: a per line amount arrives as `subtotal`, and a total arrives as `grandTotal`.
- One money formatter (`formatMoney`), one date formatter (`useFormatter` with an explicit `browserTimeZone()`), one status vocabulary (`orders.status.*` for the order, `orders.itemStatus.*` for a line, `orders.paymentStatus.*` for a payment).
- A pill tone comes from the three token sets of AC-8, never from a palette class.
- The screen renders nothing it cannot back: each block in AC-10 is absent rather than empty.
- The client never re implements the server's permission rules; the cancel and pay refusals surface as toasts and re reads as they do today.

**Security model**: the read is scoped to the caller by `where: { id: orderId, userId }`, so another account's order is a `404` and never a `403` that confirms existence. `brandName` publishes the shop's public name, which buyers already see on a product card; `Business` carries no private column of its own. `businessId`, `idempotencyKey` and `idempotencyHash` stay inside the gateway.

**Configuration required**: none. No new environment variable, no flag.

**Critical test scenarios**:

- Happy path: an order with three lines loads and prints the header, three line rows, the pickup block, the payment block, the total with its two breakdown rows and the four step rail, verifies **AC-2**, **AC-3**, **AC-4**, **AC-5**.
- Read shape: the gateway answer carries `brandName`, `kind`, `subtotal` and `paidAt`, and carries neither `businessId` nor `idempotencyKey`, verifies **AC-1**.
- Two reads per read: the detail service issues one `product.findMany` for the whole order, whatever the line count, verifies **AC-1**.
- Missing product row: a line whose `productId` matches no product prints its name and quantity with no kind, verifies **AC-3**.
- Canceled line in a paid order: the line prints its status pill while the other lines print none, verifies **AC-3**.
- Canceled order: no receiving block and no rail, the total and the breakdown stay, verifies **AC-5**.
- Unpaid order: the label reads `orders.total`, the second payment line prints the deadline or nothing, verifies **AC-4**, **AC-5**.
- Clipboard refusal: a `navigator.clipboard` that rejects raises `orders.copyFailed` and the screen keeps working, verifies **AC-7**.
- Status tones: every order status and every payment status lands on one of the three tone sets, verifies **AC-8**.
- Narrow screen: at 390 wide the columns stack and `document.documentElement.scrollWidth` equals the viewport width, verifies **AC-6**.
- Unchanged refusals: a cancel refused for a shipped line raises the existing toast and re reads the order, verifies **AC-9**.
- No dead control: the header renders no print button, verifies **AC-10**.

**Design source**: the reference mockup `C:/Users/ADMIN/Downloads/Заказ — детали-html/Order.dc.html`, structure only. Its own palette (page `#101114`, card `#17181c`, border `#26282e`) is not applied: the screen prints the shipped theme tokens of spec 0023, which the scope row for this feature already decided, so a verify pass compares structure and never colour.

**Token table** (mockup value, then the class this screen prints; every value below is measured from the mockup's `<helmet><style>` block and mapped onto `apps/customer/src/app/index.css`, where the later unlayered block carries hex verbatim):

| Element | Mockup | Class (token behind it) |
|---|---|---|
| page | `#101114` | the layout's own surface, untouched (`--background` `#09090b`) |
| card | `#17181c`, border `#26282e`, radius 14px | `bg-card border border-border rounded-xl` (`--card` `#0c0c0e`, `--border` `#27272a`, `--radius-xl` 14px) |
| sub block | `#141518`, border `#26282e`, radius 12px | `bg-background border border-border rounded-stat` (`--background` `#09090b`, `--radius-stat` 12px). `Assumed:` the mockup nests a block darker than its card, which `--background` keeps and `--surface-raised` would invert |
| thumb and icon slot | `#22242a`, radius 10px | `bg-secondary rounded-lg` (`--secondary` `#18181b`) |
| muted text | `#a3a5ad` | `text-muted-foreground` (`--muted-foreground` `#a1a1aa`) |
| text | `#f2f2f3` | `text-foreground` (`--foreground` `#fafafa`) |
| success pill | `#4ade80` on a 10 % fill and a 20 % border | `bg-success/10 border-success/20 text-success` (`--success` `#4ade80`) |
| destructive pill | `#f87171` on a 10 % fill and a 20 % border | `bg-destructive-line/20 border-destructive-line/40 text-destructive-soft` (`--destructive-line` `#7f1d1d`, `--destructive-soft` `#fca5a5`) |
| rail track and fill | `#2a2d35` and `#f2f2f3`, 6px | `bg-border` and `bg-foreground`, `h-1.5` |
| unit price pill | border `#2f323a`, radius 99px | `border-border rounded-full` |

**Geometry table** (mockup value, then the class):

| Block | Mockup | Class |
|---|---|---|
| wrapper | `max-width:1200px; padding:36px 40px 0; gap:24px` | `mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-6 lg:px-10 lg:pt-9` |
| grid | `minmax(0,1fr) 380px`, gap 20px, one column under 900px | `grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]` (the breakpoint is `lg`, 1024px, decided over the mockup's own 900px) |
| card padding | 28px | `p-7` |
| card header row | space between, items flex start, gap 10px for the number and the copy control | `flex flex-wrap items-start justify-between gap-2.5` |
| line row | padding 14px 0 | `py-3.5` |
| thumb | 64 by 64, radius 10px | `h-16 w-16 rounded-lg` |
| icon slot | 40 by 40, radius 10px | `h-10 w-10 rounded-lg` |
| sub block | padding 20px, radius 12px | `p-5 rounded-stat` |
| total | 40px, weight 700, letter spacing 0.02em, tabular | `text-[40px] font-bold tracking-[-0.02em] tabular-nums` |
| header number | 24px, weight 700, letter spacing 0.02em | `text-2xl font-bold tracking-[-0.02em]` |
| line amount | 16px, weight 600, tabular | `text-base font-semibold tabular-nums` |
| brand line | 12.5px | `text-[12.5px]` |
| kind and quantity line | 13.5px | `text-[13.5px]` |
| pill | 3px 10px, radius 99px, 12.5px, weight 500 | `px-2.5 py-[3px] rounded-full text-[12.5px] font-medium` |
| rail | 6px track, radius 9px | `h-1.5 rounded-full` |

**State table**:

| Element | Hover | Focus | Disabled | Other |
|---|---|---|---|---|
| copy control | `hover:bg-muted hover:text-foreground` | `focus-visible:ring-[3px] focus-visible:ring-ring/50` | none (it is never disabled) | `aria-label` from `orders.copyNumber` |
| pay action | unchanged from `PaymentActions` | unchanged | unchanged | the four window states of spec 0015 |
| cancel action | unchanged from `CancelOrderDialog` | unchanged | unchanged | rendered only for `canCancel(status)` |
| pills | none | none | none | three tone sets from AC-8, always `whitespace-nowrap` |
| rail steps | none | none | none | reached steps `text-foreground`, the rest `text-muted-foreground` |

**Blocks deliberately not built** (each drawn by the mockup, each with nothing behind it):

- The receipt block (download, email, print) and the `Чек RCT-…` token in the subtitle: no receipt column, no document route, no email route. Print is therefore dropped from the header as well, where it sat today as a control with no handler.
- The discount row and the `Вы сэкономили` line: `Order` carries no discount column; `grandTotal = totalPrice + deliveryPrice` on every row.
- The support contact block: no support channel anywhere in the gateway.
- The mockup's top navigation (`Мои заказы · Продажи · Заказ`): the shell `Navbar` owns navigation.

## Build plan

Tracer Bullet: the thinnest end to end thread first (the read answers the new values, the screen prints them in the new shell), then the blocks thicken one at a time, then the retirements. Every task names the AC it satisfies.

1. Widen the gateway detail read: `ORDER_DETAIL_INCLUDE` gains the `business` name select, `getOrderById` runs the one `product.findMany` for the kinds and hands the map to `toOrderDetail`, `toOrderDetail` reads the newest `PAID` attempt into `paidAt` and destructures `payments` away, `toLineJson` adds `brandName`, `kind` and `subtotal` and drops the nested `business` object. Suite in `apps/api-astrum/src/modules/order/__tests__/order.mapper.spec.ts` and `order.service.spec.ts`: the four new values, the two stripped ids, and one `product.findMany` per read whatever the line count. Satisfies **AC-1**. — done: gateway: `order.service.ts` `getOrderById` runs the business, product and payment reads and hands them to `toOrderDetail`; `order.mapper.ts` emits `brandName`, `kind`, `subtotal`, `paidAt`; api types green, 142 order tests green.
2. Move the client types: `Order` gains `paidAt`, `OrderItem` gains `brandName`, `kind`, `subtotal`. Run `grep -rln "orderItems:" apps/customer/src --include=*.ts*` and `grep -rln "grandTotal:" apps/customer/src --include=*.ts*` and give every fixture literal that builds an `Order` or an `OrderItem` the new fields in the same change. Satisfies **AC-1**, **AC-9**. — done: client mirrors in `common/types/order.types.ts`; every fixture literal carries the new fields, customer types green.
3. Stand up the shell: the wrapper and the grid of AC-6, the header of AC-2 and the line rows of AC-3 on live data, so the screen is whole end to end before any detail lands. `data-testid` hooks as AC-2 and AC-3 name them. Satisfies **AC-2**, **AC-3**, **AC-6**. — done: `components/OrderScreen/`, `OrderPageHeader/`, `OrderLine/`.
4. Build the right column: the total with its honest label, the breakdown with the goods and delivery rows, the receiving block with the single date and the rail of AC-5, the canceled rule, the sticky offset. Satisfies **AC-4**, **AC-5**, **AC-6**. — done: `components/OrderTotalCard/`, `OrderReceivingCard/`, `DeliveryProgress/` rewritten as the rail.
5. Build the left card's closing blocks: the pickup or delivery sub block and the payment sub block, with `PaymentActions` and its four window states kept in place. Satisfies **AC-4**. — done: `components/OrderPickupBlock/`, `OrderPaymentBlock/`.
6. Build the copy control as its own component and hook: the clipboard write in a handler, the two toasts, the failing clipboard path, the focusable button with its catalog label. Satisfies **AC-7**. — done: `components/CopyOrderNumber/`, `hooks/useCopyOrderNumber.ts`.
7. Rebuild the pills: `STATUS_KEYS` and `STATUS_TONES` in `lib/status.ts`, `paymentStatusKey` beside `PAYMENT_KEYS` and a `PAYMENT_TONES` table, the line pill for the three states of AC-3, and the feature's own pill element in place of the vendored `Badge`. Satisfies **AC-3**, **AC-8**. — done: `lib/status.ts` `STATUS_TONES`, `lib/pills.ts` `PILL_TONE_CLASSES` + `LINE_TONES` + `PAYMENT_TONES`, `components/Pill/`, `OrderStatusBadge/` rewritten.
8. Retire what the redraw replaces: `CARD_CLASS` and `OUTLINE_BUTTON_CLASS` from `lib/styles.ts` (the cancel trigger moves to the `destructive-outline` variant of `Button`), `DeliveryStatusCard`, `OrderSummaryCard`, `OrderOverviewCard` and `OrderItemsCard` (their parts move into the blocks of tasks 3 and 5), and the `statusColor` function. `OrderStatusBadge` keeps its file name and its callers and is rewritten as the pill element of AC-8; `OrderItemImage` stays and is restyled to the 64 by 64 `rounded-lg bg-secondary` thumb, keeping its broken source `Package` fallback and its `onError` state. The header print control goes with its `orders.print` and `orders.placedOn` keys in both catalogs. Move the suites: `status.test.ts`, `DeliveryProgress/__tests__/index.test.tsx`, `OrderPageHeader/__tests__/index.test.tsx` and `OrderPage/__tests__/index.test.tsx` assert the new structure, and the seven suites that touch no changed symbol (`CancelOrderDialog`, `PaymentActions`, `useCancelOrder`, `payment`, `paymentRefusal`, `cancelRefusal`, `cancelDialogCopy`) stay green untouched. Satisfies **AC-9**, **AC-10**. — done: four components deleted, `CARD_CLASS`/`OUTLINE_BUTTON_CLASS`/`statusColor` gone, cancel trigger on `destructive-outline`, `OrderItemImage` restyled, suites moved.
9. Finish the catalogs and the rules: both languages carry the ten new keys of AC-11 with equal sets, the twelve retired keys of AC-11 are gone from both files, the value literals are absent, and the greps of AC-11 print nothing. Satisfies **AC-10**, **AC-11**. — done: both catalogs carry the eleven new keys and none of the thirteen retired ones; the AC-11 greps print nothing; lint 0 errors, 451 tests green, build green.

## Consequences

**Positive**:

- The order screen prints the shop and the kind of every line, which is what tells two similar products apart, and the line amount, which is the number a customer checks against the total.
- The paid moment comes from the payment attempt itself, so the screen prints one real instant instead of a status word.
- The pills move onto the theme tokens, so the destructive and the success colours come from one place and the light theme keeps its own values.
- Two components (a summary card and a delivery card) and one dead class leave the tree.

**Negative / tradeoffs**:

- The detail read costs one more query. The kinds cannot join, because `OrderItem` carries no relation to `Product`; the second query is bounded by the line count of one order and is the honest cost until that relation exists.
- `kind` prints `Product.subcategory` as stored, which is Russian free text from the Excel seed (measured: `Шины`, `Мобильные телефоны`, `Ручки`). Product names on the same rows are Russian free text too, so the screen stays consistent with itself, but a future English catalogue does not reach this value.
- The rail steps keep the order status vocabulary (`Pending`, `Confirmed`, `Shipped`, `Delivered`) rather than the mockup's handover wording, so a delivered pickup reads `Delivered` on the rail and `Handed over` nowhere.
- The mockup's palette is not applied, so a side by side comparison with the drawing shows greys a few points apart. That was decided for this feature and is not a defect.
- The sticky column adds one positioning context; a future taller indicator would need its own scroll container.

**Neutral**:

- `browserTimeZone` stays imported from `features/pages/SellerOrders/lib/format`, as three order screen files already do; the move to `src/common/helpers/` is recorded as follow up rather than folded into a redraw.
- `DeliveryProgress` keeps its name and its `deliverySteps` logic while its markup becomes the rail, so the existing suite moves with it.
- No table, no migration, no flag, no environment variable.

## Follow-up

- [ ] The receipt block (download, email, print) needs a receipt document and two routes before it can return; it belongs to the deferred list of `docs/scope/_root/scope.md` once the customer screen can back it.
- [ ] The discount row and the savings line need a discount column on `Order`; nothing writes one today.
- [ ] The support contact block needs a channel (an email route or a chat surface) that does not exist.
- [ ] `OrderItem` has no relation to `Product`, which is why the kind costs a second query. Adding the relation (nullable, with an `onDelete` rule that keeps a historical line readable after a product is deleted) would let Prisma join it and would remove the extra read.
- [ ] `Product.subcategory` is free text from the seed. A category enum label would be translatable where this value is not, and that is a catalogue decision rather than a screen one.
- [ ] `browserTimeZone` belongs in `src/common/helpers/` by the placement rule of `apps/customer/AGENTS.md` (S3); eleven features import it out of `SellerOrders/lib/format` today.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
