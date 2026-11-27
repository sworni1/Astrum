import type { Prisma } from "@astrum/db/client";
import type { Currency } from "@astrum/db/enums";
import { lockOrder, recomputeOrderStatus } from "../order/order-status";
import { COURIER_ORDER_SELECT } from "./constants/courier-order.constants";
import {
  classifyCourierOrder,
  collectsAtTheDoor,
  toCourierOrderJson,
} from "./helpers/courier-order.helpers";
import { issueDeliveredLines } from "./helpers/staff-order.helpers";
import {
  alreadyHandedOver,
  orderNotDelivered,
  orderNotFound,
} from "./helpers/staff-order-errors.helpers";
import type { CourierOrderJson } from "./types/staff-order.types";

export type CourierHandoverResult = {
  order: CourierOrderJson;
  issuedLineCount: number;
  collected: { amount: string; currency: Currency } | null;
};

export const handOverCourierOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
): Promise<CourierHandoverResult> => {
  await lockOrder(tx, orderId);

  const row = await tx.order.findUnique({
    where: { id: orderId },
    select: COURIER_ORDER_SELECT,
  });
  const verdict = classifyCourierOrder(row, userId);

  if (row === null || verdict === "notFound") {
    throw orderNotFound();
  }

  if (row.courierUserId !== userId) {
    throw orderNotFound();
  }

  if (verdict === "alreadyHandedOver") {
    throw alreadyHandedOver();
  }

  if (row.status !== "DELIVERED") {
    throw orderNotDelivered();
  }

  const timestamp = new Date();
  const issued = await issueDeliveredLines(tx, row.OrderItem);
  const paid =
    collectsAtTheDoor(row.paymentMethod) &&
    row.paymentStatus === "PENDING" &&
    issued > 0;
  const status = await recomputeOrderStatus(
    tx,
    orderId,
    paid ? "PAID" : undefined,
  );

  if (status === "ISSUED") {
    await tx.order.updateMany({
      where: { id: orderId, handedOverAt: null },
      data: { handedOverAt: timestamp },
    });
  }

  const answered = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: COURIER_ORDER_SELECT,
  });

  return {
    order: toCourierOrderJson(answered, userId),
    issuedLineCount: issued,
    collected: paid
      ? {
          amount: row.grandTotal.toFixed(2),
          currency: row.currency,
        }
      : null,
  };
};
