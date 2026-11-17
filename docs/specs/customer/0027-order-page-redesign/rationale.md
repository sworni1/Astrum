# 0027. Order page redesigned from the mockup — rationale

## Context

> ⚠️ Premise note: three of the values the drawing prints have nothing behind them, and one of the drawn blocks cannot add up against the real columns. The mockup's line row carries a brand, a kind and a line amount; the detail answer carries none of the three, because `ORDER_DETAIL_INCLUDE` is `{ OrderItem: true }`, the mapper strips `businessId`, and `OrderItem` holds no relation to `Product` at all. The breakdown prints goods and a discount, while `grandTotal = totalPrice + deliveryPrice` holds on every row and no discount column exists, so a breakdown copied as drawn would not reach the total it sits under. And the header carries a receipt token (`Чек RCT-6S5HB6L1`) with no receipt behind it. Each of the three went to the engineer as its own panel, together with the header's dead print control and the duplicate payment badge; none of them was decided in silence.

The screen at `/orders/[id]` is the leftover of the decomposition in scope row 3. `apps/customer/src/features/pages/Orders/OrderPage/` holds 65 lines of composition in `index.tsx` and, below it, 14 components and 6 `lib/` modules: `OrderPageHeader` 69 lines, `OrderOverviewCard` 102, `OrderItemsCard` 94, `OrderSummaryCard` 51, `DeliveryStatusCard` 57, `DeliveryProgress` 60, `OrderStatusBadge` 28, `CancelOrderDialog` 94, `PaymentActions` 118, `OrderItemImage` 37, `OrderNotFound` 21, three state screens, and `lib/{status,styles,payment,cancelRefusal,paymentRefusal,cancelDialogCopy}.ts`. Eleven suites sit beside them under `__tests__/`.

The layout today is a header row and a two column grid (`lg:grid-cols-2`) holding the overview card beside the summary card, then the delivery card across the width, then the items card as a four column table with the product, the quantity, the unit price and the line status. The unit price column prints `item.price`, which is the price of one piece, under a heading that reads `Price`.

The read behind it is one call. `getOrderById(orderId, userId)` runs `prisma.order.findFirst({ where: { id: orderId, userId }, include: ORDER_DETAIL_INCLUDE })` and answers the whole `Order` row with its `OrderItem` rows, mapped by `toOrderJson`, which spreads the row, drops `idempotencyKey` and `idempotencyHash`, converts the three amounts through `toMoney`, and maps each line through `toLineJson`, which drops `businessId` and converts `price`. So the answer already carries the pickup point name and address, the handover stamp, the promised date, the shipping method snapshot, the delivery price, the grand total, the payment method and status, and the deadline of the payment window. It carries no shop name, no product kind, no line amount and no paid moment.

Measured on the dev database: the shop name a brand would print is `Business.name`, and the rows are seeded shop accounts (`Shop cel_20`, `Shop cel_11`, `My Shop`, `Café`). The kind a line would print is `Product.subcategory`, Russian free text from the Excel seed (`Шины` 460 rows, `Мобильные телефоны` 500 rows, `Ручки` 185 rows, `Смесители` 215), and nothing on the storefront translates it. The paid moment lives on `Payment.paidAt`, on a table the order read never touches.

Two smaller findings shaped the record. The header's print control is a `Button` with a `Printer` icon and no handler, so the screen has shipped a dead control since the decomposition. And `CARD_CLASS` in `lib/styles.ts` reads `bg-[hsl(var(--card))] rounded-lg`, while `--card` in `apps/customer/src/app/index.css` is the hex `#0c0c0e`, so the class compiles to `hsl(#0c0c0e)`, which no browser parses: every card on this screen has been drawing the `Card` primitive's own `bg-card` and ignoring the class it was handed.

The mockup is `C:/Users/ADMIN/Downloads/Заказ — детали-html/Order.dc.html`, exported from a design canvas together with its renderer. Its own palette (page `#101114`, card `#17181c`, border `#26282e`, sub block `#141518`) differs from the tokens spec 0023 shipped (page `#09090b`, card `#0c0c0e`, border `#27272a`), which the scope row for this feature already settled: the screen keeps the shipped tokens and the mockup supplies the structure. Its geometry is one left card and a 380px right column, a 14px card radius, a 12px sub block radius, and a 900px breakpoint where the columns stack.

## Options considered

### Option 1: redraw the screen in place and widen the detail read

Keep the feature folder, its data hooks (`useGetOrderById`, `useSyncOrderPayment`, `useCancelOrder`), its refusal library and its four suites that do not touch a changed symbol, and rewrite the components around the mockup's structure. Widen the one read by one join (the shop name), one query (the kinds) and one scalar (the paid moment), and compute the line amount on the server.

**Pros**:
- Every drawn value ends up with a source the server decides, including the line amount, which the browser then never multiplies.
- The refusals, the payment window states and the cancel dialog of specs 0011 and 0015 keep their code and their suites.
- One spec, one screen, one read changed; the blast radius stays inside the order feature and one gateway method.

**Cons**:
- Two gates move in one feature: a gateway read and a storefront screen, so `/check verify` has to drive both.
- The kinds cannot join, because `OrderItem` has no `Product` relation, so the read carries one extra query until that relation exists.

### Option 2: rebuild the feature folder from scratch

Delete `features/pages/Orders/OrderPage/` and write it again from the mockup, keeping only the shared types.

**Pros**:
- No legacy markup to carry, and the file tree ends up shaped exactly as the new design wants.

**Cons**:
- The refusal libraries, the payment window states and the cancel dialog behave correctly today and carry their own suites; rewriting them reopens four decided specs (0011, 0015, 0016, 0018) for no gain in the drawing.
- A redraw that starts by deleting the tests cannot show what broke.

### Option 3: keep the current grid and only restyle the cards

Leave the two column grid, the delivery card and the table, and change colours, radii and type to look like the drawing.

**Pros**:
- The smallest change on the client, with no gateway edit at all.

**Cons**:
- The structure is the decision here, not the paint: the drawing's line row, its single right column and its rail are what the scope row asks for, and a restyle leaves the table that shows a unit price where a line amount belongs.
- It also leaves the dead print control and the dead `CARD_CLASS` in place.

### Option 4: draw the order screen out of the list read

Extend `GET /api/orders` (spec 0025) with everything the screen prints and drop the detail call.

**Pros**:
- One read for both screens, and the list could gain the brand and kind it may want later.

**Cons**:
- A list read cannot answer one order's payment attempts or its pickup address at the list's cost, and it would make every reader of the list carry fields only one screen prints.
- The screen would lose the ownership refusal shape it has (a `404` on a foreign id) and the SWR key the cancel mutation writes into.

## Rationale

Option 1 is the one that keeps what the project already decided while changing what the drawing asks for. The refusals are not styling: `cancelRefusal`, `paymentRefusal` and the `409` branches of spec 0011 were decided, tested and verified, and Options 2 and 4 both reopen them for a layout. Option 3 is the opposite failure: it keeps the old table under new paint and leaves the one number a customer actually checks (the amount of the line) unprinted.

The read decision follows the shape of the answer. The brand joins, because the relation already exists on the line and Prisma reads it inside the same `findMany`. The kind cannot join, because `OrderItem` has no relation to `Product`; inventing one inside this feature would mean a migration on a table with live rows for a label, so the read takes one bounded second query keyed by the line product ids, which costs one round trip whatever the line count instead of one per line. The line amount is computed on the server for the reason spec 0026 already wrote down: `quantity * price` in the browser reintroduces the `59.97000000000001` class of defect, and the storefront's own rule is that a per line amount a screen prints comes computed.

Four smaller calls were made as recommendations rather than panels, each with its runner up. The wrappers keep the mockup's geometry (`max-w-[1200px]`, 40px side padding at `lg`, 380px column, `rounded-xl` cards) rather than the `max-w-7xl` and 24px padding the screen carries today, because spec 0026 set the precedent of quoting the mockup's own numbers and the owner reads a step off the scale as a defect. The sub blocks take `bg-background` rather than `--surface-raised`, because the mockup nests them darker than their card and the shipped raised token is lighter. The grid breaks at `lg` (1024px) rather than at the mockup's 900px, because the whole storefront is written on Tailwind's ladder and one screen with its own breakpoint is the louder inconsistency. And the pills are the feature's own element rather than the vendored `Badge`, whose `h-5` and `text-xs` cannot carry the drawing's 12.5px type and 3px vertical padding without a fight.

What the drawing asks for and the data cannot back stays out, named in the spec rather than quietly dropped: the receipt block, the discount and savings line, the support contact and the mockup's own top navigation. Each of those returns as a follow up with the thing it needs first.

References: none. The stack is settled and the sources that shaped this decision are the existing specs and the code they describe: 0011 for the cancel primitive, its `409` branches and the revalidation on refusal; 0015 and 0016 for the payment window, the attempt row with its `paidAt`, the refund warning and the confirmation of lines on payment; 0018 and 0019 for the handover that writes `DELIVERED`, `receiptDate` and `handedOverAt`; 0023 for the palette and the four tokens (`--success`, `--destructive-soft`, `--destructive-line`, `--radius-stat`) this redraw prints instead of new hex values; 0025 and 0026 for the one transaction rule, the server decided money and the mockup geometry precedent this screen follows; plus `apps/customer/AGENTS.md` for the feature shape, the placement rules and the money and date rules (S1 to S5). The reasoning stays here rather than in a citation list, following the shape specs 0011, 0020, 0024, 0025 and 0026 already use for the same call.
