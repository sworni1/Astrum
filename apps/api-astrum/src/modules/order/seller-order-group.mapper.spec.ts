import { toSellerOrderGroupJson } from "./seller-order.service";

/**
 * The seller read carries both payment columns, because a payment status alone
 * cannot tell an online order from cash (spec 0015, AC-16).
 */
describe("toSellerOrderGroupJson", () => {
  it("отдаёт paymentStatus и paymentMethod группы вместе со строками (AC-16)", () => {
    const json = toSellerOrderGroupJson({
      id: "order-1",
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
      paymentStatus: "PENDING",
      paymentMethod: "ONLINE_CARD",
      pickupPointId: null,
      pickupPointName: null,
      pickupPointAddress: null,
      handedOverAt: null,
      shippingMethod: { isPickup: false },
      OrderItem: [],
    });

    expect(json.paymentStatus).toBe("PENDING");
    expect(json.paymentMethod).toBe("ONLINE_CARD");
    expect(json.isPickup).toBe(false);
  });
});
