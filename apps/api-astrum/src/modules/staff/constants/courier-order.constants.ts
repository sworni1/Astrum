import {
  STAFF_ORDER_CANCEL_LINE_SELECT,
  STAFF_ORDER_LINE_SELECT,
} from "./staff-order.constants";

export const COURIER_ORDER_SELECT = {
  id: true,
  createdAt: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  handedOverAt: true,
  grandTotal: true,
  currency: true,
  courierUserId: true,
  deliveryDate: true,
  deliveryAddress: true,
  shippingMethod: { select: { isPickup: true } },
  OrderItem: {
    orderBy: { id: "asc" },
    select: STAFF_ORDER_LINE_SELECT,
  },
} as const;

export const COURIER_CANCEL_SELECT = {
  ...COURIER_ORDER_SELECT,
  userId: true,
  OrderItem: {
    orderBy: { id: "asc" },
    select: STAFF_ORDER_CANCEL_LINE_SELECT,
  },
} as const;
