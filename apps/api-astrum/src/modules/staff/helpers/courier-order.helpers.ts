import type { PaymentMethod } from "@astrum/db/enums";
import { toMoney } from "../../../common/helpers/money";
import type {
  ClassifiableOrder,
  CourierOrderJson,
  CourierOrderRow,
  CourierVerdict,
} from "../types/staff-order.types";

export const toCourierOrderJson = (
  row: CourierOrderRow,
  viewerId: string,
): CourierOrderJson => ({
  id: row.id,
  createdAt: row.createdAt,
  status: row.status,
  paymentStatus: row.paymentStatus,
  paymentMethod: row.paymentMethod,
  handedOverAt: row.handedOverAt,
  grandTotal: toMoney(row.grandTotal),
  currency: row.currency,
  courierUserId: row.courierUserId,
  deliveryDate: row.deliveryDate,

  deliveryAddress: row.courierUserId === viewerId ? row.deliveryAddress : null,
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

export const classifyCourierOrder = (
  order: ClassifiableOrder | null,
  userId: string,
): CourierVerdict => {
  if (order === null || order.shippingMethod.isPickup) {
    return "notFound";
  }

  if (order.handedOverAt !== null) {
    return "alreadyHandedOver";
  }

  if (order.courierUserId === userId) {
    return order.status === "DELIVERED" ? "claimedByCaller" : "notDelivered";
  }

  if (order.courierUserId !== null) {
    return "claimedByAnother";
  }

  return order.status === "DELIVERED" ? "free" : "notDelivered";
};

export const collectsAtTheDoor = (method: PaymentMethod): boolean =>
  method === "CASH" || method === "CARD_ON_DELIVERY";
