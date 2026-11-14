import type { Currency } from "@/common/types/product.types";

/** One line of a courier parcel, as the gateway answers it (spec 0019, AC-3). */
export type CourierOrderLine = {
  id: string;
  name: string;
  previewImage: string;
  quantity: number;
  price: number;
  currency: Currency;
  status: string;
};

/**
 * The courier's card. The address is answered only on a parcel the caller
 * claimed, so the pool rows carry `null` (spec 0019, AC-3).
 */
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

/** The two lists the courier page reads (spec 0019, AC-2). */
export type CourierScope = "mine" | "available";
