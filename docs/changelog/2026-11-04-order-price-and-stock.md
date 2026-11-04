# 2026-11-04 · The server decides the order price and stock

Spec: [0001-order-price-and-stock](../specs/_root/0001-order-price-and-stock/index.md).

## Added

- `packages/Astrum-db/prisma/migrations/20261104125143_order_price_and_stock` — `Order.totalPrice`
  and `OrderItem.price` become `numeric(10,2)`, both tables gain a required `currency`
  (added nullable, backfilled from the ordered product, then made required; an
  unresolvable row aborts the migration), plus the indexes `Order_userId_idx` and
  `OrderItem_orderId_idx`.
- `apps/api-astrum/src/common/helpers/appError.ts` — `AppError` carries a status, a machine
  code and optional details, so a refusal names what went wrong.
- `apps/api-astrum/src/common/helpers/logger.ts` — one structured JSON line per event
  (`order.created`, `order.refused`, `request.failed`).
- `apps/api-astrum/src/modules/order/order.constants.ts` — the error codes and the limits
  (50 lines per order, 999 units per line) in one place for the DTO and the service.
- `apps/api-astrum/src/modules/order/order.mapper.ts` — `Decimal` to a number with two
  decimals for the three order handlers.
- Tests: `order.service.spec.ts`, `order.controller.spec.ts`, `validateDto.test.ts`, and
  `order.integration.spec.ts` (opt in with `ORDER_DB_TESTS=1`, drives a real Postgres).

## Changed

- `apps/api-astrum/src/modules/order/dto/create-order.dto.ts` — a line carries only
  `productId` and `quantity`; `price`, `name` and `previewImage` are stripped.
- `apps/api-astrum/src/middlewares/validateDto.ts` — accepts an optional status and machine
  code, so the order route answers `422 { code: "VALIDATION" }`.
- `apps/api-astrum/src/modules/order/order.service.ts` — the whole create path runs in one
  transaction: products and the delivery method are read there, checks follow a fixed order
  (visibility and stock, cart, currency, delivery method), stock is taken with a conditional
  `updateMany`, and a refusal re-reads availability after the rollback. `getOrderById` now
  filters by `userId` and answers `404`.
- `apps/api-astrum/src/common/helpers/errorHandler.ts` — `AppError` answers its own status,
  code and details; every other thrown value answers `500` instead of pretending the client
  sent something wrong.
- `apps/api-astrum/src/modules/order/order.controller.ts` — `201` on create, money mapped to
  numbers in all three handlers.
- `apps/customer/src/hooks/order/useCheckout.ts` — sends only `productId` and `quantity`,
  reads `code` and `message` from the error body, and revalidates `/cart` and `/orders` on
  failure as well as on success.
- `apps/customer/src/common/types/order.types.ts` — `CreateOrderItemDto` loses `name`,
  `previewImage` and `price`.
- `apps/api-astrum/jest.config.cjs` — `reflect-metadata` is preloaded, so a spec may import a
  DTO without a polyfill.

## Fixed

- `apps/api-astrum/prisma/schema.prisma` had drifted from
  `packages/Astrum-db/prisma/schema.prisma`: the same models, but the relation fields
  were named `Review` and `ReviewResponse` instead of `reviews` and `reviewResponses`.
  `apps/api-astrum/generated/prisma` was also a symlink into the db package, so
  `prisma generate` from either package rewrote the one shared client and whichever ran
  last decided the names. The two schemas are now byte identical (the db package stays the
  source of truth) and each package generates its own client, which is ignored by git.
- `apps/customer/next.config.ts` — the order screen crashed on
  `next/image` because the demo catalogue serves images from around fifty shops while only
  a few hosts were allowed. `remotePatterns` now accepts any host over http and https; the
  optimizer answers `200` with a real JPEG for `mmedia.ozone.ru` and `shop.mts.ru`.

## Verified

- Live API run on the local stack: a tampered body saved the product price; stock 5 dropped
  to 3; 20 parallel orders on a stock of 5 produced exactly 5 orders, 15 `OUT_OF_STOCK`
  refusals with a fresh `available`, stock 0 and `isOutOfStock` true; `CART_MISMATCH`,
  `MIXED_CURRENCY`, `UNKNOWN_SHIPPING_METHOD`, `422 VALIDATION`, `404` on a foreign order.
- Real browser order `cmw25deon00003wvdd87kni5m`: `totalPrice 41063.00`, equal to
  2772 x 2 + 8690 + 26829, every line price equal to its product.
- `ORDER_DB_TESTS=1 pnpm --filter @astrum/api test` → 33 passed; `pnpm quality-gate` → 14 of
  14 tasks.
- Steps and the remaining manual walkthrough: [verify.md](../specs/_root/0001-order-price-and-stock/verify.md).

## Open

- The cart is still cleared only in the browser, and a resubmission still creates a second
  order. Both belong to feature 2.
- `ShippingMethod.price` does not enter `totalPrice`, and the form keeps its own hardcoded
  delivery price. Feature 3.
- Allowing any image host is acceptable for a scraped demo catalogue; a real catalogue should
  copy images into its own storage and drop the wildcard.
- Four manual refusal walkthrough steps are still unchecked in `verify.md`.
