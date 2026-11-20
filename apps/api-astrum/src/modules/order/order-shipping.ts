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

/**
 * The moment the shop accepted the order: the money's arrival for a prepaid
 * order, the order's own birth for a cash one, because the create path confirms
 * it at once. A paid attempt always lands after the row was written, so
 * `createdAt` is a safe floor for both.
 */
const acceptedAt = (order: {
  createdAt: Date;
  payments: Array<{ paidAt: Date | null }>;
}): Date => order.payments[0]?.paidAt ?? order.createdAt;

/**
 * Ships one order whose acceptance is old enough: its confirmed lines become
 * SHIPPED, the order keeps the moment it started moving in `shippedAt`, and the
 * order status follows the lines. Two replicas may run this at once, so the
 * update names only `CONFIRMED` lines and a pass that finds none writes nothing
 * (spec 0031, AC-2).
 */
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

/**
 * Closes one arrived parcel: its shipped lines become DELIVERED with one server
 * timestamp in `receiptDate`, and the order follows them. The update names only
 * `SHIPPED` lines, so a second replica ticking at the same moment finds nothing
 * to move (spec 0031, AC-2, AC-13).
 */
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

/**
 * One pass over the orders the shop accepted at least ORDER_SHIPPING_DELAY_MS
 * ago. There is no real delivery in this project, so the accepted order is on
 * its way after that delay instead of waiting for a seller to ship it.
 */
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

/**
 * Stage two of the same tick: the parcels that started moving at least
 * ORDER_SHIPPING_DELAY_MS ago arrive without anyone pressing anything, so
 * DELIVERED is written here and the counter only writes ISSUED. The wait reads
 * `shippedAt`, never the day the buyer picked (spec 0031, AC-2).
 */
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

/** Both stages in one tick: accepted parcels start moving, arrived ones arrive. */
export const runOrderShipping = async (now: Date = new Date()): Promise<void> => {
  await shipAcceptedOrders(now);
  await deliverArrivedOrders(now);
};

/** Started from `server.ts` and never from `app.ts`, like the payment sweep. */
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
