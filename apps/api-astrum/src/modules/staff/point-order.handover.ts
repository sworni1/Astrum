import type { Prisma } from "@astrum/db/client";
import { lockOrder, recomputeOrderStatus } from "../order/order-status";
import { POINT_ORDER_SELECT } from "./constants/point-order.constants";
import {
  requireActivePoint,
  toPointOrderJson,
} from "./helpers/point-order.helpers";
import { issueDeliveredLines } from "./helpers/staff-order.helpers";
import {
  alreadyHandedOver,
  orderNotDelivered,
  pointOrderNotFound,
} from "./helpers/staff-order-errors.helpers";
import type { PointOrderJson } from "./types/staff-order.types";

export type PointHandoverResult = {
  order: PointOrderJson;
  issuedLineCount: number;
};

export const handOverPointOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  pickupPointId: string,
): Promise<PointHandoverResult> => {
  await lockOrder(tx, orderId);

  const order = await tx.order.findFirst({
    where: { id: orderId, pickupPointId },
    select: POINT_ORDER_SELECT,
  });

  if (!order) {
    throw pointOrderNotFound();
  }

  await requireActivePoint(tx, pickupPointId);

  if (order.handedOverAt !== null) {
    throw alreadyHandedOver();
  }

  if (order.status !== "DELIVERED") {
    throw orderNotDelivered();
  }

  const timestamp = new Date();
  const count = await issueDeliveredLines(tx, order.OrderItem);

  const status = await recomputeOrderStatus(tx, orderId);

  if (status === "ISSUED") {
    await tx.order.updateMany({
      where: { id: orderId, handedOverAt: null },
      data: { handedOverAt: timestamp },
    });
  }

  const answered = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: POINT_ORDER_SELECT,
  });

  return { order: toPointOrderJson(answered), issuedLineCount: count };
};
