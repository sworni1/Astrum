# 0001 · Order price and stock decided by the server: decision record

_Context, options and rationale behind [index.md](index.md). Not build input._

## Context

`POST /api/orders` takes `orderItems` with `productId`, `name`, `previewImage`, `price` and `quantity` from the browser and writes them straight into `OrderItem`. Nothing reads `Product.price`, nothing checks `Product.quantity`, and the whole write is a single `create` call with a nested create, so a price tampered in the request body, a product that has been deleted, or a stock number that went stale in an open tab all become a saved order. The storefront does not even need to be malicious: a cart that sat open for a day sells an out of stock item, and the customer learns about it after the order exists.

Two smaller problems ride along. `Order.totalPrice` and `OrderItem.price` are PostgreSQL `double precision` behind a Prisma `Float`, so the totals already drift by fractions of a cent and cannot be trusted for payment later. And `getOrderById` looks an order up by id alone, so any signed in customer reads any other customer's order by guessing or copying an id.

The rest of the order path depends on this foundation: statuses, seller lines, stock return on cancel and payment all assume a line holds the real price and the real seller, and that the stock was actually taken. Building those on a request body the browser controls would leak the same hole into every later feature.

## Options considered

### Option 1: Verify in the gateway, keep the shape of the request

Read each product in the order service, compare the received price with the stored one, and reject a mismatch. The request keeps `name`, `previewImage` and `price`, and the order write stays one nested `create`.

**Pros**:
- Smallest diff, the storefront keeps working untouched.
- Explicit mismatch error tells a client its bundle is stale.

**Cons**:
- The payload still carries money, so every future client must learn the rule and every audit must prove the comparison is right.
- A comparison tells you the price disagrees but gives no reason to trust the next call.
- Nested create still leaves the stock check outside a transaction unless the whole thing is rewritten anyway.

### Option 2: Server reads everything, writes in one transaction (chosen)

Lines carry only `productId` and `quantity`. The service loads the products in one query, checks visibility, cart and stock, computes prices from `Product.price`, takes the stock with a conditional update and creates the order and its lines inside one `prisma.$transaction`. Errors leave the transaction through a typed error mapped to `409`.

**Pros**:
- The browser cannot influence money or names at all, by construction rather than by comparison.
- One transaction makes the stock and the order agree or both not exist.
- The conditional `updateMany ... where quantity >= n` needs no row lock, no raw SQL and no retry loop.

**Cons**:
- Bigger change: DTO, service, error contract, migration and the storefront all move together.
- More database work per order: one product query, N stock updates and the order write inside one transaction.

### Option 3: Move the whole checkout into the cart module

Compute the order from the cart alone, ignoring any line list, and turn it into an order in the cart service.

**Pros**:
- Impossible to order something that never entered the cart.
- One module owns both concepts.

**Cons**:
- The cart endpoint already carries selection state on the client, so partial checkout disappears.
- Mixes two domains in one module and leaves the order module thinner than its tests.
- The seller split in feature 4 needs order creation to know about seller lines anyway.

## Rationale

The forces in Context are all about trust: the browser is the only place a price can be invented today, and an open tab is the only place a stock number can go stale. Comparing a client price (Option 1) keeps money in the payload and turns one rule into a permanent contract every client must obey; reading the product instead removes the possibility rather than policing it. Option 3 solves the same trust problem but at the cost of partial checkout and a muddier module boundary.

The conditional `updateMany` inside one transaction is chosen over row locks and retries because PostgreSQL already evaluates `where quantity >= n` atomically per row: the update touches zero rows exactly when the stock is short, and the surrounding transaction rolls the rest back. That keeps the code readable and leaves no lock ordering to reason about.

Decimals are in scope for the order fields only. `Product.price` stays `Float` because the catalogue is demo data and the radius of that migration would touch every product read; the order is where the number becomes a commitment.
