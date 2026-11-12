import type { Order, OrderItem } from "../../../generated/prisma/client";
import { Prisma } from "../../../generated/prisma/client";
import type {
  OrderItemStatus,
  OrderStatus,
  PaymentStatus,
} from "../../../generated/prisma/enums";

export const ORDER_TRANSACTION_OPTIONS = {
  maxWait: 5000,
  timeout: 10000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

const ACTIVE_LINE_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
] as const;

type ActiveLineStatus = (typeof ACTIVE_LINE_STATUSES)[number];

const ORDER_STATUS_BY_LINE_STATUS: Record<ActiveLineStatus, OrderStatus> = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
};

const ORDER_STATUS_PRIORITY: Record<OrderStatus, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  SHIPPED: 2,
  DELIVERED: 3,
  CANCELED: 4,
};

const isActiveLineStatus = (
  status: OrderItemStatus,
): status is ActiveLineStatus =>
  ACTIVE_LINE_STATUSES.some((activeStatus) => activeStatus === status);

export const lockOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> => {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
};

export const returnOrderStock = async (
  tx: Prisma.TransactionClient,
  items: Array<Pick<OrderItem, "productId" | "quantity">>,
): Promise<void> => {
  for (const item of items) {
    await tx.product.updateMany({
      where: { id: item.productId },
      data: { quantity: { increment: item.quantity }, isOutOfStock: false },
    });
  }
};

export const recomputeOrderStatus = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  paymentStatus?: PaymentStatus,
): Promise<OrderStatus> => {
  const lines = await tx.orderItem.findMany({
    where: { orderId },
    select: { status: true },
  });
  const active = lines
    .map((line) => line.status)
    .filter(isActiveLineStatus)
    .sort(
      (left, right) =>
        ORDER_STATUS_PRIORITY[ORDER_STATUS_BY_LINE_STATUS[left]] -
        ORDER_STATUS_PRIORITY[ORDER_STATUS_BY_LINE_STATUS[right]],
    );
  const status: OrderStatus =
    active.length > 0 ? ORDER_STATUS_BY_LINE_STATUS[active[0]] : "CANCELED";

  await tx.order.update({
    where: { id: orderId },
    data: {
      status,
      ...(paymentStatus ? { paymentStatus } : {}),
    },
  });

  return status;
};

/** The statuses whose units come back to the shelf when an order closes (AC-8). */
export const STOCK_RETURN_STATUSES: readonly OrderItemStatus[] = [
  "PENDING",
  "CONFIRMED",
];

export type OrderWithLines = Order & { OrderItem: OrderItem[] };

/**
 * The customer cancellation, callable by any caller that already holds an open
 * transaction and the loaded order: its PENDING or CONFIRMED lines become
 * CANCELLED, the stock comes back exactly once, and the order status is
 * recomputed to CANCELED. The payment status is left to the caller, because the
 * expiry close and the customer cancel record it differently (AC-8, AC-11).
 */
export const closeOrder = async (
  tx: Prisma.TransactionClient,
  order: OrderWithLines,
): Promise<void> => {
  await tx.orderItem.updateMany({
    where: {
      orderId: order.id,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    data: { status: "CANCELLED" },
  });

  await returnOrderStock(
    tx,
    order.OrderItem.filter((item) =>
      STOCK_RETURN_STATUSES.includes(item.status),
    ),
  );
  await recomputeOrderStatus(tx, order.id);
};
