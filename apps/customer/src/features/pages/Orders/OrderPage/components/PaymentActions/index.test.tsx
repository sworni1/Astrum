import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type Order,
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/common/types/order.types";
import { Currency } from "@/common/types/product.types";
import PaymentActions from "./index";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { time?: string }) =>
    values?.time ? `${key}|${values.time}` : key,
  useFormatter: () => ({ dateTime: () => "21:45" }),
}));

vi.mock("@/hooks/order/usePayOrder", () => ({
  usePayOrder: () => state.pay,
}));

const state: {
  pay: {
    startPayment: () => Promise<{ url: string; expiresAt: string }>;
    isStarting: boolean;
    revalidateOrder: () => Promise<void>;
  };
} = {
  pay: {
    startPayment: vi
      .fn()
      .mockResolvedValue({ url: "https://pay.test/1", expiresAt: "" }),
    isStarting: false,
    revalidateOrder: vi.fn().mockResolvedValue(undefined),
  },
};

const inMinutes = (minutes: number): string =>
  new Date(Date.now() + minutes * 60_000).toISOString();

const order = (overrides: Partial<Order> = {}): Order => ({
  id: "order-1234567890",
  userId: "user-1",
  totalPrice: 100,
  paymentMethod: PaymentMethod.ONLINE_CARD,
  paymentStatus: PaymentStatus.PENDING,
  paymentExpiresAt: inMinutes(20),
  status: OrderStatus.PENDING,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  deliveryAddress: "Some street 1",
  pickupPointId: null,
  pickupPointName: null,
  pickupPointAddress: null,
  handedOverAt: null,
  deliveryDate: new Date("2026-11-05T12:00:00.000Z"),
  orderItems: [
    {
      id: "line-1",
      productId: "p-1",
      name: "Drill",
      previewImage: "",
      quantity: 1,
      price: 100,
      orderId: "order-1234567890",
      status: OrderItemStatus.PENDING,
      userId: "user-1",
    },
  ],
  shippingMethodId: "ship-1",
  shippingMethodName: "Courier",
  deliveryPrice: 10,
  grandTotal: 110,
  currency: Currency.RUB,
  ...overrides,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const render = async (
  view: Order,
  branch: "return" | "cancelled" | null = null,
) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<PaymentActions order={view} branch={branch} />);
  });
};

describe("PaymentActions", () => {
  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("offers the pay control and its deadline for a live online order (AC-13)", async () => {
    await render(order());
    const button = container.querySelector("button");

    expect(button?.textContent).toContain("payment.pay");
    expect(container.textContent).toContain("payment.payBefore|21:45");
  });

  it("hides the control and says the window closed once the deadline passed (AC-13)", async () => {
    await render(order({ paymentExpiresAt: inMinutes(-5) }));

    expect(container.querySelector("button")).toBeNull();
    expect(container.textContent).toContain("payment.windowExpired");
  });

  it("offers no control for a cash order or a paid one (AC-13)", async () => {
    await render(
      order({ paymentMethod: PaymentMethod.CASH, paymentExpiresAt: null }),
    );
    expect(container.querySelector("button")).toBeNull();

    await act(async () => root.unmount());
    container.remove();

    await render(order({ paymentStatus: PaymentStatus.PAID }));
    expect(container.querySelector("button")).toBeNull();
  });

  it("keeps the control after a cancelled provider page and says so (AC-14)", async () => {
    await render(order(), "cancelled");

    expect(container.textContent).toContain("payment.cancelled");
    expect(container.querySelector("button")).not.toBeNull();
  });

  it("explains a refund owed when money arrived after a cancel (AC-12)", async () => {
    await render(
      order({
        status: OrderStatus.CANCELED,
        paymentStatus: PaymentStatus.PAID,
      }),
    );

    expect(container.textContent).toContain("payment.refundOwed");
    expect(container.querySelector("button")).toBeNull();
  });

  it("prints no return copy on a paid order the provider sent the customer back with (AC-14)", async () => {
    await render(order({ paymentStatus: PaymentStatus.PAID }), "return");

    expect(container.textContent).not.toContain("payment.notConfirmed");
    expect(container.textContent).not.toContain("payment.windowExpired");
    expect(container.querySelector("button")).toBeNull();
  });

  it("says the provider has not confirmed a payment that is still open (AC-14)", async () => {
    await render(order({ paymentStatus: PaymentStatus.PENDING }), "return");

    expect(container.textContent).toContain("payment.notConfirmed");
    expect(container.querySelector("button")).not.toBeNull();
  });

  it("disables the trigger while its request runs (AC-13)", async () => {
    state.pay.isStarting = true;
    await render(order());

    expect(container.querySelector("button")?.disabled).toBe(true);
    expect(container.textContent).toContain("payment.paying");

    state.pay.isStarting = false;
  });
});
