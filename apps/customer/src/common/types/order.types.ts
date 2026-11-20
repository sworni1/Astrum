import type { Currency } from "./product.types";

// Enums - matching database schema exactly
export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  ISSUED = "ISSUED",
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
  ISSUED = "ISSUED",
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
  /** The shop of the line, resolved by the detail read (spec 0027, AC-1). */
  brandName: string;
  /** `Product.subcategory`; null when no product row carries that id. */
  kind: string | null;
  /** `price * quantity`, computed on the server so the browser never multiplies. */
  subtotal: number;
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
  paymentExpiresAt: string | null; // Deadline of the payment window, null for a cash order
  status: OrderStatus;
  createdAt: string; // ISO string from DB
  updatedAt: string; // ISO string from DB
  deliveryAddress: string | null; // Simple string as in DB, null on a pickup order
  deliveryDate: Date; // ISO string from DB
  orderItems: OrderItem[]; // camelCase to match backend response
  shippingMethodId: string;
  shippingMethodName: string; // Snapshot taken when the order was created
  deliveryPrice: number; // Snapshot taken when the order was created
  grandTotal: number; // totalPrice plus deliveryPrice, stored on the row
  currency: Currency;
  pickupPointId: string | null;
  pickupPointName: string | null;
  pickupPointAddress: string | null;
  handedOverAt: string | null;
  /** The moment the parcel started moving, written by the shipping pass (spec 0031). */
  shippedAt: string | null;
  /** Stamp of the newest PAID attempt, resolved by the detail read (spec 0027). */
  paidAt: string | null;
}

/**
 * One line of an order in the list read: the snapshot columns the screen prints,
 * without price, currency or `businessId` (spec 0025, AC-6).
 */
export type OrderLineRow = {
  id: string;
  name: string;
  previewImage: string;
  quantity: number;
  status: OrderItemStatus;
  receiptDate: string | null;
};

/** One order of the list read, with its own lines and no service column (AC-6). */
export type OrderListRow = {
  id: string;
  status: OrderStatus;
  createdAt: string;
  grandTotal: number;
  currency: Currency;
  orderItems: OrderLineRow[];
};

/** The three tabs the read understands, wire values (AC-2). */
export type OrderListStatus = "ALL" | "DELIVERED" | "CANCELED";

/**
 * What `GET /orders` answers: the filtered rows, the counts of every order of
 * the caller and the money spent per currency (spec 0025, AC-1).
 */
export interface OrderListPage {
  items: OrderListRow[];
  counts: { all: number; delivered: number; canceled: number };
  spent: { currency: Currency; amount: number }[];
}

// DTOs for API calls
export interface CreateOrderItemDto {
  productId: string;
  quantity: number;
}

export interface CreateOrderDto {
  paymentMethod: PaymentMethod;
  deliveryAddress: string | null; // null on a pickup order
  deliveryDate: Date; // Date type for form, converted to ISO string for API
  shippingMethodId: string;
  pickupPointId?: string | null;
  orderItems: CreateOrderItemDto[]; // camelCase for backend compatibility
}

export interface UpdateOrderStatusDto {
  status: OrderStatus;
}

/** What the pay route answers: where to send the browser, and until when. */
export interface PayOrderResponse {
  url: string;
  expiresAt: string;
}

/** What the sync route answers: the order as the provider sees it. */
export interface SyncPaymentResponse {
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  paymentExpiresAt: string | null;
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

/** The three tabs the seller read understands, wire values (spec 0026, AC-2). */
export type SellerListStatus = "ALL" | "DELIVERED" | "CANCELED";

/**
 * One flat line of the seller table: the six columns plus the order facts the
 * row repeats, with its own subtotal computed on the server (spec 0026, AC-3).
 */
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

/** The three tab counts over every line of the seller (AC-4). */
export type SellerLineCounts = {
  all: number;
  delivered: number;
  canceled: number;
};

/** Revenue per currency and pieces sold, over delivered lines only (AC-5). */
export type SellerSalesStats = {
  revenue: { currency: Currency; amount: number }[];
  units: number;
};

/** What `GET /seller/orders` answers (spec 0026, AC-1). */
export interface SellerSalesPage {
  items: SellerLineRow[];
  counts: SellerLineCounts;
  stats: SellerSalesStats;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

