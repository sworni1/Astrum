import type { Currency } from "@/common/types/product.types";

export type PointOrderLine = {
  id: string;
  name: string;
  previewImage: string;
  quantity: number;
  price: number;
  currency: Currency;
  status: string;
};

export type PointOrder = {
  id: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  handedOverAt: string | null;
  grandTotal: number;
  currency: Currency;
  orderItems: PointOrderLine[];
};

export type PointOrdersPage = {
  orders: PointOrder[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
