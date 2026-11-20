import type { PaymentAttemptStatus } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../common/helpers/logger";
import {
  ORDER_SHIPPING_BATCH,
  ORDER_SHIPPING_DELAY_MS,
  ORDER_SHIPPING_INTERVAL_MS,
} from "./constants/order.constants";
import { recomputeOrderStatus } from "./order-status.helpers";

const SHIPPING_INCLUDE = {
  payments: {
    where: { status: "PAID" as PaymentAttemptStatus },
    orderBy: { paidAt: "desc" as const },
    take: 1,
  },
} as const;

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const acceptedAt = (order: {
  createdAt: Date;
  payments: Array<{ paidAt: Date | null }>;
}): Date => order.payments[0]?.paidAt ?? order.createdAt;

const shipOrder = async (orderId: string, shippedAt: Date): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.orderItem.updateMany({
      where: { orderId, status: "CONFIRMED" },
      data: { status: "SHIPPED" },
    });

    if (count === 0) {
      return;
    }

    await tx.order.update({ where: { id: orderId }, data: { shippedAt } });

    await recomputeOrderStatus(tx, orderId);

    logger.info({ event: "order.lines_shipped", orderId, lineCount: count });
  });
};

const deliverOrder = async (orderId: string, arrivedAt: Date): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.orderItem.updateMany({
      where: { orderId, status: "SHIPPED" },
      data: { status: "DELIVERED", receiptDate: arrivedAt },
    });

    if (count === 0) {
      return;
    }

    await recomputeOrderStatus(tx, orderId);

    logger.info({ event: "order.lines_delivered", orderId, lineCount: count });
  });
};

const shipAcceptedOrders = async (now: Date): Promise<void> => {
  const window = new Date(now.getTime() - ORDER_SHIPPING_DELAY_MS);

  const orders = await prisma.order.findMany({
    where: {
      status: "CONFIRMED",
      createdAt: { lte: window },
      OrderItem: { some: { status: "CONFIRMED" } },
    },
    orderBy: { createdAt: "asc" },
    take: ORDER_SHIPPING_BATCH,
    include: SHIPPING_INCLUDE,
  });

  for (const order of orders) {
    if (acceptedAt(order).getTime() > window.getTime()) {
      continue;
    }

    await shipOrder(order.id, now);
  }
};

export const deliverArrivedOrders = async (
  now: Date = new Date(),
): Promise<void> => {
  const window = new Date(now.getTime() - ORDER_SHIPPING_DELAY_MS);

  const orders = await prisma.order.findMany({
    where: {
      status: "SHIPPED",
      shippedAt: { lte: window },
      OrderItem: { some: { status: "SHIPPED" } },
    },
    orderBy: { shippedAt: "asc" },
    take: ORDER_SHIPPING_BATCH,
    select: { id: true },
  });

  for (const order of orders) {
    await deliverOrder(order.id, now);
  }
};

export const runOrderShipping = async (now: Date = new Date()): Promise<void> => {
  await shipAcceptedOrders(now);
  await deliverArrivedOrders(now);
};

export const startOrderShipping = (): NodeJS.Timeout => {
  const timer = setInterval(() => {
    void runOrderShipping().catch((error: unknown) => {
      logger.error({
        event: "order.shipping.crashed",
        reason: describe(error),
      });
    });
  }, ORDER_SHIPPING_INTERVAL_MS);

  timer.unref();

  return timer;
};
