import type { PickupPoint, ShippingMethod } from "@/common/types/order.types";
import type { Currency } from "@/common/types/product.types";
import type { CheckoutHintKey } from "./hints";

export type CheckoutFormState = {
  methods: ShippingMethod[];
  methodsLoading: boolean;
  methodsUnavailable: boolean;
  points: PickupPoint[];
  pointsLoading: boolean;
  pointsFailed: boolean;
  pointsUnavailable: boolean;
  isPickup: boolean;
  shippingMethodId: string;
  pickupPointId: string;
  selectedMethod?: ShippingMethod;
  selectedPoint?: PickupPoint;
  currency: Currency;
  subtotal: number;
  shippingPrice: number;
  total: number;
  hint: CheckoutHintKey | null;
  isSubmitting: boolean;
  retryMethods: () => void;
  retryPoints: () => void;
};
