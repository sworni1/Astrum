import type { OrderItem, Prisma } from "@astrum/db/client";
import type {
  Currency,
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@astrum/db/enums";

export type CourierScope = "mine" | "available";

export type CourierOrderLine = Pick<
  OrderItem,
  "id" | "name" | "previewImage" | "quantity" | "price" | "currency" | "status"
>;

export type CourierOrderRow = {
  id: string;
  createdAt: Date;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  handedOverAt: Date | null;
  grandTotal: Prisma.Decimal;
  currency: Currency;
  courierUserId: string | null;
  deliveryDate: Date;
  deliveryAddress: string | null;
  OrderItem: CourierOrderLine[];
};

export type StaffOrderLineJson = {
  id: string;
  name: string;
  previewImage: string;
  quantity: number;
  price: number;
  currency: Currency;
  status: OrderItemStatus;
};

export type CourierOrderJson = {
  id: string;
  createdAt: Date;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  handedOverAt: Date | null;
  grandTotal: number;
  currency: Currency;
  courierUserId: string | null;
  deliveryDate: Date;
  deliveryAddress: string | null;
  orderItems: StaffOrderLineJson[];
};

export type CourierVerdict =
  | "notFound"
  | "alreadyHandedOver"
  | "claimedByCaller"
  | "claimedByAnother"
  | "notDelivered"
  | "free";

export type ClassifiableOrder = {
  status: OrderStatus;
  handedOverAt: Date | null;
  courierUserId: string | null;
  shippingMethod: { isPickup: boolean };
};

export type PointOrderLine = Pick<
  OrderItem,
  "id" | "name" | "previewImage" | "quantity" | "price" | "currency" | "status"
>;

export type PointOrderRow = {
  id: string;
  createdAt: Date;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  handedOverAt: Date | null;
  grandTotal: Prisma.Decimal;
  currency: Currency;
  OrderItem: PointOrderLine[];
};

export type PointOrderJson = {
  id: string;
  createdAt: Date;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  handedOverAt: Date | null;
  grandTotal: number;
  currency: Currency;
  orderItems: StaffOrderLineJson[];
};
