import type { Currency } from "@/common/types/product.types";

/** One line of a parcel waiting at the counter (spec 0018, AC-2). */
export type PointOrderLine = {
  id: string;
  name: string;
  previewImage: string;
  quantity: number;
  price: number;
  currency: Currency;
  status: string;
};

/** The card's order, with no buyer identity of any kind (spec 0018, AC-2). */
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
