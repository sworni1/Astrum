/** The first missing field in form order, with the catalog key of its hint (AC-14). */
export const CHECKOUT_FIELD_HINTS = {
  shippingMethod: "hintShippingMethod",
  pickupPoint: "hintPickupPoint",
  deliveryAddress: "hintDeliveryAddress",
  deliveryDate: "hintDeliveryDate",
} as const;

/** The blocks that name no field, checked before every field (AC-14). */
export const CHECKOUT_BLOCK_HINTS = {
  methodsLoading: "hintShippingLoading",
  methodsUnavailable: "hintShippingUnavailable",
  pointsUnavailable: "hintPickupUnavailable",
} as const;

/** The address the form accepts, the same length the schema demands. */
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

/**
 * The one line under the submit button: the first thing that still blocks the
 * order, at most one, in the order the fields are drawn (spec 0024, AC-14).
 * `null` means the order may be placed, so the hint and the disabled button
 * never disagree.
 */
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
