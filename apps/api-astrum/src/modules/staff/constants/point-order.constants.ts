import {
  STAFF_ORDER_CANCEL_LINE_SELECT,
  STAFF_ORDER_LINE_SELECT,
} from "./staff-order.constants";

export const POINT_ORDER_SELECT = {
  id: true,
  createdAt: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  handedOverAt: true,
  grandTotal: true,
  currency: true,
  OrderItem: {
    orderBy: { id: "asc" },
    select: STAFF_ORDER_LINE_SELECT,
  },
} as const;

export const POINT_CANCEL_SELECT = {
  ...POINT_ORDER_SELECT,
  userId: true,
  OrderItem: {
    orderBy: { id: "asc" },
    select: STAFF_ORDER_CANCEL_LINE_SELECT,
  },
} as const;
