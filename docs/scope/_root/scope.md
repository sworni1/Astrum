# Scope: Astrum order flow

One order moves through three places: the storefront (`apps/customer`), the gateway (`apps/api-astrum`) and the shared schema (`packages/Astrum-db`). The seller surface does not exist yet. This plan holds the whole order path, slice by slice, so the storefront and backend scopes stay about their own pages.

**Build approach:** Tracer Bullet (every slice runs end to end through the storefront and the gateway).
**Workflow:** Beta (after `/develop`: `/check verify`, then `/test`). Features that move money or stock carry a `· GA` tag.

_These are recommendations to keep the build orderly, not requirements. Skip anything that does not fit. You decide when a feature is `done`._

## At a glance

| #   | Feature                                   | Phase   | Status  |
| --- | ----------------------------------------- | ------- | ------- |
| 1   | Order price and stock on the server       | Slice 1 | done |
| 2   | Idempotent checkout and cart clearing     | Slice 1 | in-progress |
| 3   | Shipping methods from the API             | Slice 1 | planned |
| 4   | Order statuses with seller ownership      | Slice 2 | planned |
| 5   | Seller order panel                        | Slice 2 | planned |
| 6   | Customer cancel on the order screen       | Slice 2 | planned |
| 7   | Pickup handover                           | Slice 3 | planned |
| 8   | Reviews on the product screen             | Slice 4 | planned |
| 9   | Order flow end to end test and CI         | Slice 4 | planned |

## Slice 1: the order thread

The thinnest real order: the server decides the money and the stock, the browser just asks.

### 1. Order price and stock on the server · done · GA

Today the checkout form sends name, image and price, and the gateway stores them as sent, so the browser decides both money and stock.
**Done when:** each line price and the order total come from the product records, the order is written in one transaction, a line above the available stock is refused with a message naming the product, and stock drops exactly once per ordered unit.
- [x] Design it (spec): `/architect order price and stock on the server`
- [x] Build it: `/develop order price and stock on the server`
  - [x] Migration (two decimal money columns, currency backfilled from products, indexes) and narrowed DTOs with the validation status (AC-1, AC-2, AC-7)
  - [x] `AppError` carrier and the order service rewrite: products, transaction scoped cart read, currency check, conditional stock update, fresh availability on refusal (AC-1 to AC-6, AC-10)
  - [x] Owner check, `404` for a foreign order, decimal mapping in the three handlers (AC-8, AC-9)
  - [x] Storefront hook: `productId` and `quantity` only, error body read, cart revalidated on failure (AC-1, AC-4, AC-6)
  - [x] Tests: happy path, tampered body, 20 parallel requests on a stock of 5, limits, unknown shipping method, foreign read (AC-1 to AC-10)
- [x] Verify it: `/check verify order price and stock on the server` (2026-11-04: 10 of 10 AC on the live API; browser walkthrough still owed)
- [x] Test it: `/test order price and stock on the server` (2026-11-04: 28 tests in the order module, every `AC-1` to `AC-10` tagged, 41 passing with `ORDER_DB_TESTS=1`; the storefront `useCheckout` hook stayed untested because the package has no React testing library)
- [x] Review it (fresh model): `/check review order price and stock on the server` (2026-11-04: read on the same model, `delegation` is not configured in `config.yaml`; no blocking defect, one finding: the cancel toast shows a generic message instead of the server reason)
- [x] Document it: `/document order price and stock on the server` (README, `docs/DEVELOPMENT.md`, `docs/changelog/2026-11-04-order-price-and-stock.md`, `docs/changelog/2026-11-04-order-cancel.md`)
  spec [0001](../../specs/_root/0001-order-price-and-stock/index.md)
  code in `apps/api-astrum/src/modules/order`, `apps/api-astrum/src/common/helpers`, `packages/Astrum-db/prisma/migrations/20261104125143_order_price_and_stock`, `apps/customer/src/hooks/order`

### 2. Idempotent checkout and cart clearing · in-progress · GA

A second click or a retry after a timeout can create a twin order, and the cart is only cleared in the browser.
**Done when:** a resubmission with the same `Idempotency-Key` returns the first order instead of creating a second, the ordered lines leave the cart on the server in the same transaction, and lines the customer did not select stay in the cart.
- [x] Design it (spec): `/architect idempotent checkout and cart clearing`
- [ ] Build it: `/develop idempotent checkout and cart clearing`
  - [ ] Migration and gateway idempotency core: two nullable columns and the unique index, the header reader, the canonical fingerprint, the three replay paths with the fingerprint compare, the mapper dropping both columns (AC-1 to AC-4, AC-6, AC-7, AC-9, AC-12)
  - [ ] Cart clearing inside the order transaction, the skipped-clear log and the rollback policy (AC-5, AC-8)
  - [ ] Storefront key generation and lifetime, `postItem` headers, replay read as success, the CORS header allowance (AC-10, AC-11)
- [ ] Verify it: `/check verify idempotent checkout and cart clearing`
- [ ] Test it: `/test idempotent checkout and cart clearing`
- [ ] Review it (fresh model): `/check review idempotent checkout and cart clearing`
- [ ] Document it: `/document idempotent checkout and cart clearing`
  spec [0003](../../specs/_root/0003-idempotent-checkout-and-cart-clearing/index.md)

### 3. Shipping methods from the API · planned

The checkout form carries two hardcoded ids that exist in one demo database only.
**Done when:** the form lists the methods the API returns, the delivery price of the chosen method enters the total the server computes, and an unknown method id is refused.
- [ ] Build it: `/develop shipping methods from the API`

## Slice 2: statuses and the seller

### 4. Order statuses with seller ownership · planned · GA

The order screens already draw a status timeline and a cancel button, but no route changes a status, and an order line records no seller.
**Done when:** each line stores the seller of its product at creation, a seller reads and moves only their own lines, a status change follows the allowed transitions, cancelling a line returns the stock, and an illegal transition is refused with a readable message.
- [ ] Design it (spec): `/architect order statuses with seller ownership`

### 5. Seller order panel · planned

A seller has no surface at all today, so the lines that must be fulfilled are invisible to them.
**Done when:** a seller signs in, sees their lines grouped by order, moves a line through its allowed statuses, and never sees a line of another seller.
- [ ] Design it (spec): `/architect seller order panel`

### 6. Customer cancel on the order screen · planned

The cancel button on the order screen calls a route that does not exist.
**Done when:** a customer cancels an order while it is `PENDING`, the screen shows the new status without a reload, the stock comes back, and the button is gone once the order is confirmed.
- [ ] Build it: `/develop customer cancel on the order screen`

## Slice 3: handover

### 7. Pickup handover · planned

Pickup is how this shop hands an order over, and nothing closes an order today.
**Done when:** a customer chooses a pickup point at checkout, the seller marks the order handed over at that point, the order becomes `DELIVERED`, and the order screen shows the pickup point and the handover date.
- [ ] Design it (spec): `/architect pickup handover`

## Slice 4: closing the loop

### 8. Reviews on the product screen · planned

The review API already refuses a review without a `DELIVERED` purchase, while the product screen still renders mock reviews.
**Done when:** the product screen shows the reviews and the rating summary from the API, a customer with a delivered line can write one review, and the form stays hidden for anyone who did not buy.
- [ ] Design it (spec): `/architect reviews on the product screen`

### 9. Order flow end to end test and CI · planned

Nothing proves the order path keeps working, and no pipeline runs the gates.
**Done when:** one end to end test walks register, add to cart, checkout and see the order against a real database, and CI runs types, lint, unit tests and that test on every pull request.
- [ ] Design it (spec): `/architect order flow end to end test and CI`

## Deferred

Kept so the plan stays honest, built only when the loop above runs.

- **Online payment through a test provider**: pay before handover · needs a decision
- **Order emails**: confirmation and status changes · needs a decision
- **Courier delivery**: a shipping address instead of a pickup point · needs a decision
- **Returns and refunds** · needs a decision
- **Second currency** · needs a decision
- **Storefront checkout timeout above the server budget**: the client gives up at 10000 ms while the server transaction may still be committing · from spec 0003, a separate small change
- **Two order create hooks**: `useCreateOrder` is unused and sends no idempotency key · from spec 0003, cleanup

## Legend

- **Next step** = the first unticked box.
- **Status**: `planned` → `in-progress` → `done`, plus `existing` (built before this scope) and `dropped`.
- A row with `Design it (spec)` runs `/architect` first; the tag `needs a decision` is implied by that box.
- **Workflow tag** beside a heading (for example `· GA`) overrides the project default for that feature.
