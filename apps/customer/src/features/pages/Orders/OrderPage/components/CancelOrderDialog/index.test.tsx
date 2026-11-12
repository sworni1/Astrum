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
import CancelOrderDialog from "./index";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const order = (paymentStatus: PaymentStatus): Order => ({
  id: "order-1234567890",
  userId: "user-1",
  totalPrice: 100,
  paymentMethod: PaymentMethod.ONLINE_CARD,
  paymentStatus,
  paymentExpiresAt: null,
  status: OrderStatus.PENDING,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  deliveryAddress: "Some street 1",
  pickupPointId: null,
  pickupPointName: null,
  pickupPointAddress: null,
  handedOverAt: null,
  deliveryDate: new Date("2026-11-10T00:00:00.000Z"),
  orderItems: [
    {
      id: "item-1",
      productId: "product-1234567890",
      name: "Kettle",
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
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onConfirm: () => void;

const trigger = (): HTMLElement | null =>
  container.querySelector('[data-slot="alert-dialog-trigger"]');

const dialog = (): Element | null =>
  document.querySelector('[role="alertdialog"]');

const keep = (): HTMLElement | null =>
  document.querySelector('[data-slot="alert-dialog-cancel"]');

const send = (): HTMLElement | null =>
  document.querySelector('[data-slot="alert-dialog-action"]');

const tick = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const press = async (element: Element | null): Promise<void> => {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick();
  });
};

const pressEscape = async (): Promise<void> => {
  await act(async () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await tick();
  });
};

const render = async (
  paymentStatus: PaymentStatus = PaymentStatus.PAID,
): Promise<void> => {
  onConfirm = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <CancelOrderDialog
        order={order(paymentStatus)}
        isCancelling={false}
        onConfirm={onConfirm}
      />,
    );
  });
};

describe("CancelOrderDialog", () => {
  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("sends nothing until its sending control is pressed (AC-2)", async () => {
    await render();
    await press(trigger());

    expect(dialog()).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();

    await press(send());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it("closes on Escape and on the keep control without a request (AC-2, AC-10)", async () => {
    await render();
    await press(trigger());
    await pressEscape();

    expect(dialog()).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();

    await press(trigger());
    await press(keep());

    expect(dialog()).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("puts the first focus on the keep control (AC-10)", async () => {
    await render();
    await press(trigger());

    expect(document.activeElement).toBe(keep());
  });

  it("names a pending payment and says nothing about money once taken (AC-3)", async () => {
    await render(PaymentStatus.PENDING);
    await press(trigger());
    expect(dialog()?.textContent).toContain("cancelDialog.paymentPending");

    await press(keep());
    await act(async () => root.unmount());
    container.remove();

    await render(PaymentStatus.PAID);
    await press(trigger());
    expect(dialog()?.textContent).not.toContain("cancelDialog.paymentPending");
  });
});
