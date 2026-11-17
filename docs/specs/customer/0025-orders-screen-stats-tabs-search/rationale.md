# 0025. Orders screen: stats, tabs, search — rationale

## Context

> ⚠️ Premise note: the whole list of one customer already arrives in one answer (21 orders for the largest account, 105 orders in the database), so the filter, the three tab counts, the spent total and even the search could be computed in the browser with no request at all. The engineer chose the search on the server. That choice is honoured here, and its cost is written down rather than hidden: a request per settled query, a debounce and a busy state on the field, a failure path for the filtered read, and the necessity of an aggregate on the server, because a filtered answer can no longer be the source of numbers about the whole set. The narrower framing (everything in the browser, one read for the whole set) is Option 2 below and stays available if the cost is later judged not worth it.

The orders screen is one flat list today. `apps/customer/src/features/pages/Orders/index.tsx` renders a heading, a found count and one `OrderCard` per order: number, creation date with the time, the paid total, the shipping method with its pickup point, a yellow or blue status badge, the delivery date and one 80px preview of a single line. There are no numbers, no filter, no search, and a card cannot show what was inside the order, because the list route answers one preview image and a line count.

The route is thin because nothing needed more. `ORDER_LIST_INCLUDE` selects `_count` on `OrderItem` and one `OrderItem` row's `previewImage`; `getOrdersByUserId` maps that into `{ ...order, orderItemsCount, previewImage }`, `toOrderListJson` converts three money columns into numbers and spreads the rest of the row, and the storefront reads the array through `useGetOrders`. The spread publishes `userId`, `paymentStatus` and `paymentDetails` to the browser, which the redraw does not need.

The mockup for this feature, `C:/Users/ADMIN/Downloads/Мои заказы-html (1)/Main.dc.html`, draws a different screen: a heading with a found count, three stat tiles, a tab strip with counts, a search field, and one group card per order whose header carries the order number, the order date and the total, and whose rows carry a 96px image, the product name, a variant and quantity line, the state of the line with its date, and a repeat purchase button. It also draws a receipt button and an archive button in the group header, and a top navigation of its own.

Four facts about the data bound the design, all measured in the dev database on 2026-11-16:

| Measurement | Value |
|---|---|
| orders, and customers holding them | 105 orders, 14 customers, largest 21 |
| currency column | every one of the 105 rows is `RUB` |
| order statuses | `PENDING` 59, `CANCELED` 25, `DELIVERED` 20, `CONFIRMED` 1, `SHIPPED` 0 |
| payment statuses among non canceled | `PENDING` 65 (55 of them order status `PENDING`, 10 `DELIVERED`), `PAID` 15 |
| orders with `handedOverAt` | 17, all of them `DELIVERED` (handover writes `DELIVERED`, `receiptDate` and `handedOverAt` together, `apps/api-astrum/src/modules/staff/staff-order.helpers.ts:81`) |
| lines per order | at most 4, average 1.4 |
| line statuses across the table | `PENDING` 66, `DELIVERED` 36, `CANCELLED` 36, `OUT_OF_STOCK` 2, `SHIPPED` 2, `CONFIRMED` 1 |

Two of those numbers decided criteria. Ten delivered orders carry `paymentStatus` `PENDING` because they are cash orders, so a spent total keyed on "paid" would have erased money the customer really gave. And twenty orders are `DELIVERED` while seventeen carry a handover stamp, so keying "получено" on the stamp would have printed a number the «Доставлены» tab contradicts on the same screen.

The palette needs no new token. Spec 0023 pinned the zinc theme and named `--success` ("delivered badge text and dot"), `--radius-stat: 12px` ("stat tile, thumbnail") and `--radius-group: 16px` ("order group") with this screen in mind, while this mockup carries an older grey (`#101114` page, `#17181c` card, `#26282e` border against `#a3a5ad` muted). Copying the mockup's numbers would leave two greys on one slice, so the spec maps each one onto the token that already exists.

The current screen also violates rule S4 of the storefront standard: `showToast` runs inside the component body (`apps/customer/src/features/pages/Orders/index.tsx:23`), so the toast is raised during render. The redraw fixes it in passing, the same way spec 0024 handled the checkout.

## Options considered

### Option 1: widen the read that already ships

`GET /orders` keeps its path and its middleware, gains a `status` and a `q` parameter, carries the lines of each order, and answers the three counts and the per currency spent total computed in the same transaction.

**Pros**:
- One request draws the whole screen, and the numbers and the list describe one database snapshot, so they cannot disagree.
- No new route, no new middleware and no cache to invalidate: the read is already per customer and already uncached.
- The lines arrive with the same `findMany` that already runs, so the `_count` and the single preview become unnecessary rather than being added beside.
- Every reader stays on one hook, so a cancel or a payment refreshes the list as it does today.

**Cons**:
- The response shape breaks, so the hook, its types, the Navbar and the card suite move in one change.
- The read carries more data per order (up to 4 lines today) for every caller, including the Navbar, which only needs a count.
- Three queries per request instead of one, held in a read transaction.

### Option 2: filter, count and search in the browser

The route keeps answering the whole set, and the screen filters, counts, sums and searches over the array it already has.

**Pros**:
- No response shape change, no new parameter, no failure path and no debounce: the search is instant and cannot fail separately from the list.
- The numbers derive from exactly the rows on screen, so they agree by construction.
- The gateway keeps one query.

**Cons**:
- The client becomes the source of money and of two counts, which is the opposite of the rule the shop established for prices and totals (spec 0001, spec 0003).
- The search quality is bounded by the payload: a line name the list does not carry can never be found, so the payload has to grow anyway.
- Once any screen grows pagination the same arithmetic silently describes a page. The seller panel (scope row 15) will need the same grouping over a paginated set, and two different meanings of «доставлен» would then live in one repo.

### Option 3: two reads, list then numbers

The screen asks for the filtered list, then asks again without filters for the counts and the spent total.

**Pros**:
- Each answer keeps a simple shape, and the gateway has no aggregate to write.
- The list shape still breaks, but the numbers can land later without blocking the screen.

**Cons**:
- Two requests per screen and per tab switch, so the tiles and the tabs can lag behind the list and print a value about a set the list no longer shows.
- A concurrent cancel lands between the two answers, which is exactly the disagreement the numbers exist to prevent.

### Option 4: a second route for the numbers

`GET /orders/summary` answers the counts and the spent total beside the existing list route.

**Pros**:
- The list answer can keep its current shape for a while, which is the gentlest migration.

**Cons**:
- Two routes to scope, authorize, document and test for one screen, and the numbers still come from a different snapshot unless both run in one transaction.
- It leaves the list shape unchanged, so the lines still have to be added to it anyway, and the screen then draws two reads.

## Decision

Option 1: widen the read that already ships, and redraw the screen from the tokens spec 0023 pinned.

## Rationale

Option 1 wins on the force that binds: the numbers must describe the whole set while the list describes a slice of it, and only the server can answer about rows the client never received. Doing that in one transaction removes the entire class of "the tile says 20 and the list shows 19" defects, and it keeps money out of the browser, which is the rule specs 0001 and 0003 established for the rest of the shop.

Option 2 was rejected on that same rule, not on performance: for 21 rows it would work perfectly today, and it would become a lie the day the read pages. Option 3 was rejected because it reintroduces the disagreement it was meant to avoid, and Option 4 because it doubles the surface for one screen without removing the need to widen the list for the lines.

The widened select is deliberately narrow. The line carries what the row prints and nothing else, and the order row carries what the header prints; `userId`, `businessId`, `paymentStatus`, `paymentDetails` and both idempotency columns stay inside the gateway, which is stricter than the spread row that ships today.

The search is trimmed and capped at 64 characters, and the status comes from a whitelist, because a raw value passed into a Prisma enum filter is a `500` waiting for the first client bug. Both answers are typed codes, so the storefront can tell a bad request from a broken server if it ever wants to.

The tabs and the search live in component state rather than in the URL. A tab in the query string is a nicer address, but it puts a second copy of the screen state beside the request key that the debounce already owns, and the scope asks for no address behaviour. The cost is written into Consequences: a refresh returns to «Все» with an empty field.

The mockup's three actions are not built. A receipt has no route, an archive has no column and a repeat purchase is a cart write, and the scope row says in as many words that the only action is «Открыть заказ». They are named in the spec so their absence reads as the decision it is.

## Consequences

The screen gains three numbers, two groupings and a search that reaches a product name, and it pays for them with a breaking response shape, a read that carries lines for every caller, and a search that cannot use an index and stays cheap only while the read is scoped to one customer. The read stays unpaginated, which is honest for 21 rows and is recorded as a Follow-up rather than solved here. The palette gains nothing, because spec 0023 had already named the three tokens this screen needed.

The grouping rule lands in one table with a test, so the seller sales screen of scope row 15 copies a decision instead of inventing a second meaning of «доставлен». The variant line, the receipt, the archive and the repeat purchase wait for a column, a route and a cart write respectively.

References: none. The stack is settled, and the sources that shaped this decision are the existing specs and the code they describe: 0001 and 0003 for the rule that money and totals are decided by the server; 0011 and 0018 for the order status vocabulary and the handover that writes `DELIVERED`, `receiptDate` and `handedOverAt` together; 0020 for the seller panel whose grouping scope row 15 must keep identical to this one; 0023 for the palette and the three tokens this redraw prints instead of new hex values; 0024 for the failure block with its retry and for the toast moved out of the render body; plus `apps/customer/AGENTS.md` for the feature shape, the placement rules and the side effect rules the split follows. The reasoning stays here rather than in a citation list, following the shape specs 0011, 0020 and 0024 already use for the same call.
