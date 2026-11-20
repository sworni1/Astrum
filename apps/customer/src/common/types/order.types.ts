import type { Currency } from "./product.types";

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  ISSUED = "ISSUED",
  CANCELED = "CANCELED",
}

export enum PaymentMethod {
  CASH = "CASH",
  CARD_ON_DELIVERY = "CARD_ON_DELIVERY",
  ONLINE_CARD = "ONLINE_CARD",
  PAYPAL = "PAYPAL",
  STRIPE = "STRIPE",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
  CANCELLED = "CANCELLED",
}

export enum OrderItemStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  CANCELLED = "CANCELLED",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  ISSUED = "ISSUED",
  RETURNED = "RETURNED",
  BACKORDERED = "BACKORDERED",
  REPLACED = "REPLACED",
}

export interface ShippingMethod {
  id: string;
  name: string;
  price: number;
  currency: Currency;
  isPickup: boolean;
}

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  previewImage: string;
  quantity: number;
  price: number;

  brandName: string;

  kind: string | null;

  subtotal: number;
  orderId: string;
  receiptDate?: string;
  status: OrderItemStatus;
  userId: string;
  product?: {
    id: string;
    name: string;
    previewImage: string;
    description?: string;
  };
}

export interface Order {
  id: string;
  userId: string;
  totalPrice: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentDetails?: string;
  paymentExpiresAt: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  deliveryAddress: string | null;
  deliveryDate: Date;
  orderItems: OrderItem[];
  shippingMethodId: string;
  shippingMethodName: string;
  deliveryPrice: number;
  grandTotal: number;
  currency: Currency;
  pickupPointId: string | null;
  pickupPointName: string | null;
  pickupPointAddress: string | null;
  handedOverAt: string | null;

  shippedAt: string | null;

  paidAt: string | null;
}

export type OrderLineRow = {
  id: string;
  name: string;
  previewImage: string;
  quantity: number;
  status: OrderItemStatus;
  receiptDate: string | null;
};

export type OrderListRow = {
  id: string;
  status: OrderStatus;
  createdAt: string;
  grandTotal: number;
  currency: Currency;
  orderItems: OrderLineRow[];
};

export type OrderListStatus = "ALL" | "DELIVERED" | "CANCELED";

export interface OrderListPage {
  items: OrderListRow[];
  counts: { all: number; delivered: number; canceled: number };
  spent: { currency: Currency; amount: number }[];
}

export interface CreateOrderItemDto {
  productId: string;
  quantity: number;
}

export interface CreateOrderDto {
  paymentMethod: PaymentMethod;
  deliveryAddress: string | null;
  deliveryDate: Date;
  shippingMethodId: string;
  pickupPointId?: string | null;
  orderItems: CreateOrderItemDto[];
}

export interface UpdateOrderStatusDto {
  status: OrderStatus;
}

export interface PayOrderResponse {
  url: string;
  expiresAt: string;
}

export interface SyncPaymentResponse {
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  paymentExpiresAt: string | null;
}

export interface UpdateOrderItemStatusDto {
  status: OrderItemStatus;
  receiptDate?: string;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type SellerListStatus = "ALL" | "DELIVERED" | "CANCELED";

export type SellerLineRow = {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  previewImage: string;
  quantity: number;
  price: number;
  subtotal: number;
  currency: Currency;
  status: OrderItemStatus;
  createdAt: string;
  isPickup: boolean;
  pickupPointName: string | null;
  pickupPointAddress: string | null;
  handedOverAt: string | null;
  deliveryAddress: string | null;
};

export type SellerLineCounts = {
  all: number;
  delivered: number;
  canceled: number;
};

export type SellerSalesStats = {
  revenue: { currency: Currency; amount: number }[];
  units: number;
};

export interface SellerSalesPage {
  items: SellerLineRow[];
  counts: SellerLineCounts;
  stats: SellerSalesStats;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
