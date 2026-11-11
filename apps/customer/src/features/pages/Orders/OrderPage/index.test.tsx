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
import OrderPage from "./index";

const mocks = vi.hoisted(() => ({
  getOrder: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@/hooks/order/useGetOrderById", () => ({
  useGetOrderById: mocks.getOrder,
}));

vi.mock("@/hooks/order/useUpdateOrderStatus", () => ({
  useUpdateOrderStatus: () => ({
    updateOrderStatusTrigger: vi.fn(),
    updateOrderStatusIsMutating: false,
    updateOrderStatusError: null,
  }),
}));

vi.mock("@/common/helpers/showToast", () => ({
  showToast: mocks.showToast,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => "1 November 2026" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span data-image-source={src} data-image-alt={alt} />
  ),
}));

const order: Order = {
  id: "order-1234567890",
  userId: "user-1",
  totalPrice: 100,
  paymentMethod: PaymentMethod.ONLINE_CARD,
  paymentStatus: PaymentStatus.PAID,
  status: OrderStatus.CONFIRMED,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  deliveryAddress: "Some street 1",
  deliveryDate: new Date("2026-11-10T00:00:00.000Z"),
  orderItems: [
    {
      id: "item-1",
      productId: "product-1234567890",
      name: "Kettle",
      previewImage: "",
      quantity: 2,
      price: 50,
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
};

describe("OrderPage", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
    mocks.getOrder.mockReset();
    mocks.showToast.mockReset();
  });

  const render = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<OrderPage orderId="order-1234567890" />);
    });
  };

  it("composes the five named sections of the screen", async () => {
    mocks.getOrder.mockReturnValue({
      order,
      isLoading: false,
      error: null,
    });

    await render();

    const text = container.textContent ?? "";

    for (const section of [
      "number",
      "deliveryAddress",
      "paymentMethod",
      "shippingMethod",
      "summary",
      "deliveryStatus",
      "itemsTitle",
    ]) {
      expect(text).toContain(section);
    }

    expect(text).toContain("Kettle");
    expect(text).toContain("itemStatus.pending");
  });

  it("raises the failure toast from an effect, once, and still renders a state", async () => {
    const error = { message: "not found", status: 404 };
    mocks.getOrder.mockReturnValue({
      order: undefined,
      isLoading: false,
      error,
    });

    await render();

    expect(container.textContent).toContain("notFoundTitle");
    expect(mocks.showToast).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(<OrderPage orderId="order-1234567890" />);
    });

    expect(mocks.showToast).toHaveBeenCalledTimes(1);

    mocks.getOrder.mockReturnValue({
      order: undefined,
      isLoading: false,
      error: { message: "not found", status: 404 },
    });

    await act(async () => {
      root.render(<OrderPage orderId="order-1234567890" />);
    });

    expect(mocks.showToast).toHaveBeenCalledTimes(2);
  });
});
