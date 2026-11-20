export const CHECKOUT_FIELD_HINTS = {
  shippingMethod: "hintShippingMethod",
  pickupPoint: "hintPickupPoint",
  deliveryAddress: "hintDeliveryAddress",
  deliveryDate: "hintDeliveryDate",
} as const;

export const CHECKOUT_BLOCK_HINTS = {
  methodsLoading: "hintShippingLoading",
  methodsUnavailable: "hintShippingUnavailable",
  pointsUnavailable: "hintPickupUnavailable",
} as const;

export const MIN_DELIVERY_ADDRESS = 10;

export type CheckoutHintKey =
  | (typeof CHECKOUT_FIELD_HINTS)[keyof typeof CHECKOUT_FIELD_HINTS]
  | (typeof CHECKOUT_BLOCK_HINTS)[keyof typeof CHECKOUT_BLOCK_HINTS];

export type CheckoutHintState = {
  methodsLoading: boolean;
  methodsUnavailable: boolean;
  isPickup: boolean;
  shippingMethodId: string;
  pickupPointId: string;
  deliveryAddress: string;
  deliveryDate?: Date;
  pointsUnavailable: boolean;
};

export const checkoutHint = (state: CheckoutHintState): CheckoutHintKey | null => {
  if (state.methodsLoading) {
    return CHECKOUT_BLOCK_HINTS.methodsLoading;
  }

  if (state.methodsUnavailable) {
    return CHECKOUT_BLOCK_HINTS.methodsUnavailable;
  }

  if (state.shippingMethodId === "") {
    return CHECKOUT_FIELD_HINTS.shippingMethod;
  }

  if (state.isPickup) {
    if (state.pointsUnavailable) {
      return CHECKOUT_BLOCK_HINTS.pointsUnavailable;
    }

    if (state.pickupPointId === "") {
      return CHECKOUT_FIELD_HINTS.pickupPoint;
    }
  } else if (state.deliveryAddress.trim().length < MIN_DELIVERY_ADDRESS) {
    return CHECKOUT_FIELD_HINTS.deliveryAddress;
  }

  if (!state.deliveryDate) {
    return CHECKOUT_FIELD_HINTS.deliveryDate;
  }

  return null;
};
