import type { Prisma } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import { lockOrder, recomputeOrderStatus } from "../order/order-status";
import {
  COURIER_CANCEL_SELECT,
  COURIER_ORDER_SELECT,
} from "./constants/courier-order.constants";
import { toCourierOrderJson } from "./helpers/courier-order.helpers";
import {
  cancelOrderLines,
  isCancellable,
  resolveCancelPayment,
  sumOfLines,
} from "./helpers/staff-order.helpers";
import {
  nothingToCancel,
  orderNotDelivered,
  orderNotFound,
} from "./helpers/staff-order-errors.helpers";
import type { CourierOrderJson } from "./types/staff-order.types";

export type CourierCancelResult = {
  order: CourierOrderJson;
  cancelledLineCount: number;
  cancelledProductIds: string[];
};

export const assertHeldCourierOrder = async (
  orderId: string,
  userId: string,
): Promise<void> => {
  const held = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      courierUserId: true,
      shippingMethod: { select: { isPickup: true } },
    },
  });

  if (
    held === null ||
    held.shippingMethod.isPickup ||
    held.courierUserId !== userId
  ) {
    throw orderNotFound();
  }
};

export const cancelCourierOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
): Promise<CourierCancelResult> => {
  await lockOrder(tx, orderId);

  const row = await tx.order.findUnique({
    where: { id: orderId },
    select: COURIER_CANCEL_SELECT,
  });

  if (
    row === null ||
    row.shippingMethod.isPickup ||
    row.courierUserId !== userId
  ) {
    throw orderNotFound();
  }

  const cancellable = row.OrderItem.filter(isCancellable);

  if (cancellable.length === 0) {
    throw nothingToCancel();
  }

  if (row.status !== "DELIVERED") {
    throw orderNotDelivered();
  }

  const amount = sumOfLines(cancellable);
  await cancelOrderLines(tx, cancellable);
  await recomputeOrderStatus(tx, orderId);

  await resolveCancelPayment({
    tx,
    orderId,
    paymentStatus: row.paymentStatus,
    reason: "courier_cancel",
    actorUserId: userId,
    buyerUserId: row.userId,
    amount,
    currency: row.currency,
    cancelledLineCount: cancellable.length,
  });

  const answered = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: COURIER_ORDER_SELECT,
  });

  return {
    order: toCourierOrderJson(answered, userId),
    cancelledLineCount: cancellable.length,
    cancelledProductIds: cancellable.map((line) => line.productId),
  };
};
