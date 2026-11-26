import type { Prisma } from "@astrum/db/client";
import { lockOrder } from "../order/order-status";
import { COURIER_ORDER_SELECT } from "./constants/courier-order.constants";
import {
  classifyCourierOrder,
  toCourierOrderJson,
} from "./helpers/courier-order.helpers";
import {
  alreadyClaimed,
  alreadyHandedOver,
  orderNotDelivered,
  orderNotFound,
} from "./helpers/staff-order-errors.helpers";
import type { CourierOrderJson } from "./types/staff-order.types";

export const claimCourierOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
): Promise<{ order: CourierOrderJson; wrote: boolean }> => {
  await lockOrder(tx, orderId);

  const row = await tx.order.findUnique({
    where: { id: orderId },
    select: COURIER_ORDER_SELECT,
  });
  const verdict = classifyCourierOrder(row, userId);

  if (row === null || verdict === "notFound") {
    throw orderNotFound();
  }

  if (verdict === "claimedByCaller") {
    return { order: toCourierOrderJson(row, userId), wrote: false };
  }

  if (verdict === "alreadyHandedOver") {
    throw alreadyHandedOver();
  }

  if (verdict === "claimedByAnother") {
    throw alreadyClaimed();
  }

  if (verdict === "notDelivered") {
    throw orderNotDelivered();
  }

  await tx.order.update({
    where: { id: orderId },
    data: { courierUserId: userId },
  });

  return {
    order: toCourierOrderJson({ ...row, courierUserId: userId }, userId),
    wrote: true,
  };
};

export const releaseCourierOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
): Promise<CourierOrderJson> => {
  await lockOrder(tx, orderId);

  const row = await tx.order.findUnique({
    where: { id: orderId },
    select: COURIER_ORDER_SELECT,
  });
  const verdict = classifyCourierOrder(row, userId);

  if (row === null || verdict === "notFound") {
    throw orderNotFound();
  }

  if (verdict === "alreadyHandedOver") {
    throw alreadyHandedOver();
  }

  if (verdict === "claimedByCaller") {
    await tx.order.update({
      where: { id: orderId },
      data: { courierUserId: null },
    });

    return toCourierOrderJson({ ...row, courierUserId: null }, userId);
  }

  if (verdict === "notDelivered" && row.courierUserId === userId) {
    throw orderNotDelivered();
  }

  throw orderNotFound();
};
