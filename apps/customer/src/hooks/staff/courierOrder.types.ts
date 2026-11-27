import type { Currency } from "@/common/types/product.types";

export type CourierOrderLine = {
  id: string;
  name: string;
  previewImage: string;
  quantity: number;
  price: number;
  currency: Currency;
  status: string;
};

export type CourierOrder = {
  id: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  handedOverAt: string | null;
  grandTotal: number;
  currency: Currency;
  courierUserId: string | null;
  deliveryDate: string;
  deliveryAddress: string | null;
  orderItems: CourierOrderLine[];
};

export type CourierOrdersPage = {
  orders: CourierOrder[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CourierScope = "mine" | "available";
