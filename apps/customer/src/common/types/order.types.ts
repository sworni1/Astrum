import type { Currency } from "./product.types";

// Enums - matching database schema exactly
export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELED = "CANCELED", // Note: CANCELED not CANCELLED to match DB
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
  CANCELLED = "CANCELLED", // DB uses CANCELLED (with double L)
}

export enum OrderItemStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  CANCELLED = "CANCELLED", // DB uses CANCELLED (with double L)
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  RETURNED = "RETURNED",
  BACKORDERED = "BACKORDERED",
  REPLACED = "REPLACED",
}

// Interfaces - matching database schema
export interface ShippingMethod {
  id: string;
  name: string;
  price: number;
  currency: Currency;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  previewImage: string;
  quantity: number;
  price: number;
  orderId: string;
  receiptDate?: string; // DateTime from DB
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
  status: OrderStatus;
  createdAt: string; // ISO string from DB
  updatedAt: string; // ISO string from DB
  deliveryAddress: string; // Simple string as in DB
  deliveryDate: Date; // ISO string from DB
  orderItems: OrderItem[]; // camelCase to match backend response
  shippingMethodId: string;
  shippingMethodName: string; // Snapshot taken when the order was created
  deliveryPrice: number; // Snapshot taken when the order was created
  grandTotal: number; // totalPrice plus deliveryPrice, stored on the row
  currency: Currency;
}

export type OrderListItem = Omit<Order, "orderItems"> & {
  orderItemsCount: number;
  previewImage: string | null;
};

// DTOs for API calls
export interface CreateOrderItemDto {
  productId: string;
  quantity: number;
}

export interface CreateOrderDto {
  paymentMethod: PaymentMethod;
  paymentDetails?: string;
  deliveryAddress: string; // Simple string as in DB
  deliveryDate: Date; // Date type for form, converted to ISO string for API
  shippingMethodId: string;
  orderItems: CreateOrderItemDto[]; // camelCase for backend compatibility
}

export interface UpdateOrderStatusDto {
  status: OrderStatus;
}

export interface UpdateOrderItemStatusDto {
  status: OrderItemStatus;
  receiptDate?: string;
}

// Response Types
export interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SellerOrderLine {
  id: string;
  productId: string;
  name: string;
  previewImage: string;
  quantity: number;
  price: number;
  currency: Currency;
  status: OrderItemStatus;
}

export interface SellerOrderGroup {
  id: string;
  createdAt: string;
  orderItems: SellerOrderLine[];
}

export interface SellerOrdersPage {
  orders: SellerOrderGroup[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
