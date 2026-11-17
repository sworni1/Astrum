import type { Currency } from "@/common/types/product.types";
import type { PickupPoint, ShippingMethod } from "@/common/types/order.types";
import type { CheckoutHintKey } from "./hints";

/**
 * Everything the checkout screen reads besides the form itself: the two lists,
 * the chosen method's money and the one hint line (spec 0024, AC-11 to AC-14).
 * Every value here is derived, so the screen never holds a second copy of it.
 */
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
