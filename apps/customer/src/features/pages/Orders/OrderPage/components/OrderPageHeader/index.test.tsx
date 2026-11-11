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
import OrderPageHeader from "./index";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => "1 November 2026" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

const CANCEL_TRIGGER = '[data-slot="alert-dialog-trigger"]';

const order = (status: OrderStatus): Order => ({
  id: "order-1234567890",
  userId: "user-1",
  totalPrice: 100,
  paymentMethod: PaymentMethod.ONLINE_CARD,
  paymentStatus: PaymentStatus.PAID,
  status,
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

const render = async (status: OrderStatus): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <OrderPageHeader
        order={order(status)}
        isCancelling={false}
        onCancel={vi.fn()}
      />,
    );
  });
};

describe("OrderPageHeader", () => {
  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("offers the cancel action at the two statuses the gateway accepts (AC-1)", async () => {
    await render(OrderStatus.PENDING);
    expect(container.querySelector(CANCEL_TRIGGER)).not.toBeNull();

    await act(async () => root.unmount());
    container.remove();

    await render(OrderStatus.CONFIRMED);
    expect(container.querySelector(CANCEL_TRIGGER)).not.toBeNull();
  });

  it("offers no cancel action once the parcel moved or the order is closed (AC-1)", async () => {
    for (const status of [
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELED,
    ]) {
      await render(status);
      expect(container.querySelector(CANCEL_TRIGGER)).toBeNull();

      await act(async () => root.unmount());
      container.remove();
    }
  });
});
