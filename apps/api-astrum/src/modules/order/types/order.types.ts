import type { Currency, Order, OrderItem, Prisma } from "@astrum/db/client";
import type { OrderItemStatus, OrderStatus } from "@astrum/db/enums";
import { PRODUCT_SELECT } from "../constants/order.constants";

export type OrderLine = { productId: string; quantity: number };

export type Idempotency = { key: string; hash: string };

export type PricedLine = {
  productId: string;
  businessId: string;
  name: string;
  previewImage: string;
  quantity: number;
  currency: Currency;
  unitPrice: Prisma.Decimal;
};

export type RefusalItem = {
  productId: string;
  requested: number;
  available: number;
};

export type CartRow = { productId: string; quantity: number };

export type OrderDetailLine = OrderItem & {
  brandName?: string;

  kind?: string | null;
};

export type OrderDetail = Omit<Order, "OrderItem"> & {
  orderItems: OrderDetailLine[];

  paidAt?: Date | null;
};

export type OrderListLine = {
  id: string;
  name: string;
  previewImage: string;
  quantity: number;
  status: OrderItemStatus;
  receiptDate: Date | null;
};

export type OrderListRow = {
  id: string;
  status: OrderStatus;
  createdAt: Date;
  grandTotal: Prisma.Decimal;
  currency: Currency;
  orderItems: OrderListLine[];
};

export type OrderListCounts = {
  all: number;
  delivered: number;
  canceled: number;
};

export type OrderSpentRow = { currency: Currency; amount: Prisma.Decimal };

export type OrderListPage = {
  items: OrderListRow[];
  counts: OrderListCounts;
  spent: OrderSpentRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CreateOrderResult = { order: OrderDetail; replay: boolean };

export type OrderListQuery = { status?: OrderStatus; q?: string };

export type ProductRow = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_SELECT;
}>;
