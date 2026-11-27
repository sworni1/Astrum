import { describe, expect, it } from "vitest";
import {
  CHECKOUT_BLOCK_HINTS,
  CHECKOUT_FIELD_HINTS,
  type CheckoutHintState,
  checkoutHint,
} from "@/features/pages/Checkout/lib/hints";

const ready: CheckoutHintState = {
  methodsLoading: false,
  methodsUnavailable: false,
  isPickup: false,
  shippingMethodId: "sm-1",
  pickupPointId: "",
  deliveryAddress: "Tverskaya 12, Moscow",
  deliveryDate: new Date("2026-12-01T12:00:00.000Z"),
  pointsUnavailable: false,
};

describe("checkoutHint", () => {
  it("is silent when every required field is filled (AC-14)", () => {
    expect(checkoutHint(ready)).toBeNull();
  });

  it("names the loading methods before any field (AC-14)", () => {
    expect(
      checkoutHint({ ...ready, methodsLoading: true, shippingMethodId: "" }),
    ).toBe(CHECKOUT_BLOCK_HINTS.methodsLoading);
  });

  it("names an unavailable list before any field (AC-14)", () => {
    expect(
      checkoutHint({
        ...ready,
        methodsUnavailable: true,
        deliveryDate: undefined,
      }),
    ).toBe(CHECKOUT_BLOCK_HINTS.methodsUnavailable);
  });

  it("asks for the method first, then the address, then the date (AC-14)", () => {
    expect(
      checkoutHint({
        ...ready,
        shippingMethodId: "",
        deliveryAddress: "",
        deliveryDate: undefined,
      }),
    ).toBe(CHECKOUT_FIELD_HINTS.shippingMethod);

    expect(
      checkoutHint({
        ...ready,
        deliveryAddress: "",
        deliveryDate: undefined,
      }),
    ).toBe(CHECKOUT_FIELD_HINTS.deliveryAddress);

    expect(checkoutHint({ ...ready, deliveryDate: undefined })).toBe(
      CHECKOUT_FIELD_HINTS.deliveryDate,
    );
  });

  it("holds a pickup method to its point, not to an address (AC-14)", () => {
    const pickup = { ...ready, isPickup: true, deliveryAddress: "" };

    expect(checkoutHint(pickup)).toBe(CHECKOUT_FIELD_HINTS.pickupPoint);
    expect(checkoutHint({ ...pickup, pickupPointId: "pp-1" })).toBeNull();
  });

  it("names an unavailable points list instead of a field (AC-14)", () => {
    expect(
      checkoutHint({
        ...ready,
        isPickup: true,
        pointsUnavailable: true,
        pickupPointId: "",
      }),
    ).toBe(CHECKOUT_BLOCK_HINTS.pointsUnavailable);
  });

  it("treats a short address as missing, the same rule the schema holds (AC-14)", () => {
    expect(checkoutHint({ ...ready, deliveryAddress: "   Tver   " })).toBe(
      CHECKOUT_FIELD_HINTS.deliveryAddress,
    );
    expect(
      checkoutHint({ ...ready, deliveryAddress: "Tverskaya 12" }),
    ).toBeNull();
  });
});
