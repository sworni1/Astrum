import type { Currency, Prisma } from "@astrum/db/client";
import type { OrderItemStatus } from "@astrum/db/enums";
import type { OrderListStatus } from "../constants/order.constants";
import { SELLER_LINE_SELECT } from "../constants/seller-order.constants";

export type SellerOrderQuery = {
  status?: Exclude<OrderListStatus, "ALL">;
  q?: string;
};

export type SellerLineSource = Prisma.OrderItemGetPayload<{
  select: typeof SELLER_LINE_SELECT;
}>;

export type SellerLineJson = {
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
  createdAt: Date;
  isPickup: boolean;
  pickupPointName: string | null;
  pickupPointAddress: string | null;
  handedOverAt: Date | null;
  deliveryAddress: string | null;
};

export type SellerLineCounts = {
  all: number;
  delivered: number;
  canceled: number;
};

export type SellerRevenueRow = { currency: Currency; amount: number };

export type SellerSalesStats = {
  revenue: SellerRevenueRow[];
  units: number;
};

export type SellerSalesPage = {
  items: SellerLineJson[];
  counts: SellerLineCounts;
  stats: SellerSalesStats;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type SellerAggregateRow = {
  status: string;
  currency: Currency;
  count: number;
  units: string;
  revenue: string;
};
