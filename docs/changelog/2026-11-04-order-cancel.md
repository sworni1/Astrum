# 2026-11-04 · Cancelling an order from the storefront

Spec: [0002-order-cancel](../specs/_root/0002-order-cancel.md).

## Added

- `PATCH /api/orders/:orderId/status` — the route the order screen already called.
  It accepts `{ "status": "CANCELED" }` only and answers `200` with the order.
- `apps/api-astrum/src/modules/order/dto/update-order-status.dto.ts` — `status` must be a
  member of the `OrderStatus` enum; an empty body or an unknown value answers
  `422 VALIDATION`.
- `ORDER_ERROR_CODES.invalidTransition` — `INVALID_STATUS_TRANSITION`, answered with `from`
  and `to`.
- Tests: five service cases (stock returned, foreign order, shipped order, another target,
  repeated cancel) and two controller cases, plus a database case that checks the stock goes
  from 4 to 1 and back to 4 without a second increase.

## Changed

- `apps/api-astrum/src/modules/order/order.service.ts` — `updateOrderStatus` runs one
  transaction: owner check, transition check, order to `CANCELED`, lines to `CANCELLED`,
  stock returned with `increment`, `isOutOfStock` cleared, `paymentStatus` to `CANCELLED`
  when nothing was charged. A repeated cancel writes nothing, so the stock cannot be
  returned twice. The not found error moved into one helper shared with `getOrderById`.

## Fixed

- Cancelling an order no longer answers `404`. The gateway had no status route at all, so
  every cancel attempt from the order screen failed with "Failed to cancel order".

## Verified

- `ORDER_DB_TESTS=1 pnpm --filter @astrum/api test` → 41 passed, including the new database
  case.
- `PATCH /api/orders/abc/status` without a session cookie answers `401 Unauthorized` instead
  of `404`, so the route is registered.

## Open

- Every other transition (confirm, ship, deliver) and the seller panel stay with feature 4.
- `PATCH /order-items/:id/status` has a storefront hook but no route either; the order screen
  does not call it yet.
