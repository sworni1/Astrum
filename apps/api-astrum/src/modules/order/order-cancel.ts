import type { Prisma } from "@astrum/db/client";
import type { OrderStatus } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { logger } from "../../common/helpers/logger";
import { expireSessionForCancel } from "../payment/payment.cancel";
import {
  CUSTOMER_CANCELLATION_BLOCKERS,
  ORDER_DETAIL_INCLUDE,
  ORDER_ERROR_CODES,
} from "./constants/order.constants";
import { orderNotFound } from "./helpers/order-errors.helpers";
import { toOrderDetail } from "./order.mapper";
import { invalidateStockOfProducts } from "./order-cache";
import {
  closeOrder,
  lockOrder,
  ORDER_TRANSACTION_OPTIONS,
} from "./order-status";
import type { OrderDetail } from "./types/order.types";

export const updateOrderStatus = async (
  orderId: string,
  userId: string,
  status: OrderStatus,
): Promise<OrderDetail> => {
  if (status !== "CANCELED") {
    throw new AppError(
      409,
      ORDER_ERROR_CODES.invalidTransition,
      `Changing an order to ${status} is not supported yet.`,
      { to: status },
    );
  }

  await assertOwnOrder(orderId, userId);
  await expireSessionForCancel(orderId);

  const order = await prisma.$transaction(
    (tx) => cancelOrder(tx, orderId, userId),
    ORDER_TRANSACTION_OPTIONS,
  );

  logger.info({
    event: "order.cancelled",
    orderId,
    userId,
    restoredLines: order.orderItems.length,
  });

  await invalidateStockOfProducts(
    order.orderItems.map((item) => item.productId),
  );

  return order;
};

const assertOwnOrder = async (
  orderId: string,
  userId: string,
): Promise<void> => {
  const owned = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true },
  });

  if (owned === null) {
    throw orderNotFound();
  }
};

const cancelOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
): Promise<OrderDetail> => {
  await lockOrder(tx, orderId);

  const current = await tx.order.findFirst({
    where: { id: orderId, userId },
    include: ORDER_DETAIL_INCLUDE,
  });

  if (!current) {
    throw orderNotFound();
  }

  if (current.status === "CANCELED") {
    return toOrderDetail(current);
  }

  const blockedLine = current.OrderItem.find((item) =>
    CUSTOMER_CANCELLATION_BLOCKERS.includes(item.status),
  );

  if (blockedLine) {
    throw new AppError(
      409,
      ORDER_ERROR_CODES.invalidTransition,
      `An order with a ${blockedLine.status} line can no longer be cancelled.`,
      { from: blockedLine.status, to: "CANCELED" },
    );
  }

  await closeOrder(tx, current);

  await tx.payment.updateMany({
    where: { orderId: current.id, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "CANCELLED" },
  });

  if (
    current.paymentStatus === "PENDING" ||
    current.paymentStatus === "FAILED"
  ) {
    await tx.order.update({
      where: { id: current.id },
      data: { paymentStatus: "CANCELLED" },
    });
  }

  if (current.paymentStatus === "PAID") {
    logger.warn({
      event: "payment.refund_owed",
      orderId: current.id,
      userId,
      reason: "customer_cancel",
      amount: current.grandTotal.toFixed(2),
      currency: current.currency,
    });
  }

  return toOrderDetail(
    await tx.order.findFirstOrThrow({
      where: { id: current.id },
      include: ORDER_DETAIL_INCLUDE,
    }),
  );
};
