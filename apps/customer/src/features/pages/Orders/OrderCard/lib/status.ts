import { OrderStatus } from "@/common/types/order.types";

export type StatusKey =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "canceled";

export const ORDER_STATUS_KEYS: Record<OrderStatus, StatusKey> = {
  [OrderStatus.PENDING]: "pending",
  [OrderStatus.CONFIRMED]: "confirmed",
  [OrderStatus.SHIPPED]: "shipped",
  [OrderStatus.DELIVERED]: "delivered",
  [OrderStatus.CANCELED]: "canceled",
};

export const getStatusVariant = (status: OrderStatus) => {
  switch (status) {
    case OrderStatus.PENDING:
    case OrderStatus.CONFIRMED:
      return "bg-yellow-500 hover:bg-yellow-500";
    case OrderStatus.SHIPPED:
      return "bg-blue-500 hover:bg-blue-500";
    case OrderStatus.DELIVERED:
      return "bg-green-500 hover:bg-green-500";
    case OrderStatus.CANCELED:
      return "bg-red-500 hover:bg-red-500";
    default:
      return "bg-gray-500 hover:bg-gray-500";
  }
};
