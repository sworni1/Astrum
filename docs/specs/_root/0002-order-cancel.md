# 0002 · Order cancellation

**Status**: Accepted
**Date**: 2026-11-04

## Context

The order screen offers Cancel while an order is `PENDING` and calls
`PATCH /orders/:orderId/status`, but the gateway had no such route, so Express answered
`404` and the customer saw "Failed to cancel order". Statuses as a whole (seller panel,
shipping, handover) belong to feature 4. This spec covers cancellation only, and the owner
chose it explicitly during the build.

## Decision

One route, `PATCH /api/orders/:orderId/status`, accepting only `status: "CANCELED"`, in a
single transaction:

1. the order must belong to the caller (otherwise `404 ORDER_NOT_FOUND`);
2. only `PENDING` and `CONFIRMED` can be cancelled (otherwise
   `409 INVALID_STATUS_TRANSITION` with `from` and `to`);
3. the order becomes `CANCELED`, every line becomes `CANCELLED`;
4. the stock of every line goes back by its quantity and `isOutOfStock` is cleared;
5. `paymentStatus` becomes `CANCELLED` when it was `PENDING`, because nothing was charged,
   and stays as it is otherwise.

A second cancel changes nothing and returns the order as it is, so the stock cannot be
returned twice.

## Acceptance criteria

1. A `PENDING` or `CONFIRMED` order of the caller answers `200` with `status: "CANCELED"` and
   every line `CANCELLED`.
2. Each line's quantity is added back to its product and `isOutOfStock` becomes `false`.
3. A foreign or a missing order answers `404 ORDER_NOT_FOUND`.
4. Any target other than `CANCELED`, and a cancel of a `SHIPPED`, `DELIVERED` or `CANCELED`
   order, answers `409 INVALID_STATUS_TRANSITION` and writes nothing.
5. A repeated cancel answers `200` with the same order and does not add the stock again.
6. A body without `status`, or with a value outside the enum, answers `422 VALIDATION`.

## Code area

`apps/api-astrum/src/modules/order/`: `order.routes.ts`, `order.controller.ts`,
`order.service.ts`, `order.constants.ts`, `dto/update-order-status.dto.ts`.

## Out of scope

Every other transition, the seller panel, refunds and payment capture.
