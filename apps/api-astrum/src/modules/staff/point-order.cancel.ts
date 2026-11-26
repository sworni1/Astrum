import type { Prisma } from "@astrum/db/client";
import { lockOrder, recomputeOrderStatus } from "../order/order-status";
import {
  POINT_CANCEL_SELECT,
  POINT_ORDER_SELECT,
} from "./constants/point-order.constants";
import {
  requireActivePoint,
  toPointOrderJson,
} from "./helpers/point-order.helpers";
import {
  cancelOrderLines,
  isCancellable,
  resolveCancelPayment,
  sumOfLines,
} from "./helpers/staff-order.helpers";
import {
  nothingToCancel,
  orderNotDelivered,
  pointOrderNotFound,
} from "./helpers/staff-order-errors.helpers";
import type { PointOrderJson } from "./types/staff-order.types";

export type PointCancelResult = {
  order: PointOrderJson;
  cancelledLineCount: number;
  cancelledProductIds: string[];
};

export const cancelPointOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
  pickupPointId: string,
): Promise<PointCancelResult> => {
  await lockOrder(tx, orderId);

  const order = await tx.order.findFirst({
    where: { id: orderId, pickupPointId },
    select: POINT_CANCEL_SELECT,
  });

  if (!order) {
    throw pointOrderNotFound();
  }

  await requireActivePoint(tx, pickupPointId);

  const cancellable = order.OrderItem.filter(isCancellable);

  if (cancellable.length === 0) {
    throw nothingToCancel();
  }

  if (order.status !== "DELIVERED") {
    throw orderNotDelivered();
  }

  await cancelOrderLines(tx, cancellable);
  await recomputeOrderStatus(tx, orderId);

  await resolveCancelPayment({
    tx,
    orderId,
    paymentStatus: order.paymentStatus,
    reason: "point_cancel",
    actorUserId: userId,
    buyerUserId: order.userId,
    pointId: pickupPointId,
    amount: sumOfLines(cancellable),
    currency: order.currency,
    cancelledLineCount: cancellable.length,
  });

  const answered = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: POINT_ORDER_SELECT,
  });

  return {
    order: toPointOrderJson(answered),
    cancelledLineCount: cancellable.length,
    cancelledProductIds: cancellable.map((line) => line.productId),
  };
};
