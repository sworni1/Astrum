import { Prisma } from "@astrum/db/client";
import type { OrderItemStatus } from "@astrum/db/enums";

export const SELLER_LINE_SELECT = {
  id: true,
  orderId: true,
  productId: true,
  name: true,
  previewImage: true,
  quantity: true,
  price: true,
  currency: true,
  status: true,
  order: {
    select: {
      createdAt: true,
      pickupPointName: true,
      pickupPointAddress: true,
      handedOverAt: true,
      deliveryAddress: true,
      shippingMethod: { select: { isPickup: true } },
    },
  },
} as const;

export const SELLER_TRANSACTION_OPTIONS = {
  maxWait: 5000,
  timeout: 10000,
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
} as const;

export const CANCELED_LINE_STATUSES: readonly OrderItemStatus[] = [
  "CANCELLED",
  "OUT_OF_STOCK",
];
