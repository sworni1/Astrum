import type { Prisma } from "@astrum/db/client";
import { toMoney } from "../../../common/helpers/money";
import type { PointOrderJson, PointOrderRow } from "../types/staff-order.types";
import { pickupPointInactive } from "./staff-order-errors.helpers";

export const toPointOrderJson = (row: PointOrderRow): PointOrderJson => ({
  id: row.id,
  createdAt: row.createdAt,
  status: row.status,
  paymentStatus: row.paymentStatus,
  paymentMethod: row.paymentMethod,
  handedOverAt: row.handedOverAt,
  grandTotal: toMoney(row.grandTotal),
  currency: row.currency,
  orderItems: row.OrderItem.map((line) => ({
    id: line.id,
    name: line.name,
    previewImage: line.previewImage,
    quantity: line.quantity,
    price: toMoney(line.price),
    currency: line.currency,
    status: line.status,
  })),
});

export const requireActivePoint = async (
  tx: Prisma.TransactionClient,
  pickupPointId: string,
): Promise<void> => {
  const point = await tx.pickupPoint.findUnique({
    where: { id: pickupPointId },
    select: { isActive: true },
  });

  if (!point?.isActive) {
    throw pickupPointInactive();
  }
};
