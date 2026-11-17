import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Method = {
  id: string;
  name: string;
  price: number;
  currency: string;
  isPickup?: boolean;
};
type Point = { id: string; name: string; address: string };

const state = vi.hoisted(() => ({
  shipping: {
    methods: [] as Method[],
    isLoading: false,
    error: null as unknown,
    mutate: vi.fn(),
  },
  pickup: {
    points: [] as Point[],
    isLoading: false,
    error: null as unknown,
    mutate: vi.fn(),
  },
  checkout: { handleCheckout: vi.fn() },
  toast: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "ru",
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
  useFormatter: () => ({ dateTime: (value: Date) => value.toISOString() }),
}));

vi.mock("next/image", () => ({
  default: () => <span data-testid="line-image" />,
}));

vi.mock("@/hooks/order/useCheckout", () => ({
  useCheckout: () => state.checkout,
}));

vi.mock("@/hooks/shipping/useShippingMethods", () => ({
  useShippingMethods: () => state.shipping,
}));

vi.mock("@/hooks/pickup/usePickupPoints", () => ({
  usePickupPoints: () => state.pickup,
}));

vi.mock("@/common/helpers/showToast", () => ({ showToast: state.toast }));

import CheckoutForm from "@/features/pages/Checkout/components/CheckoutForm";

const METHODS: Method[] = [
  { id: "sm-1", name: "Standard Delivery", price: 299, currency: "RUB" },
  { id: "sm-2", name: "Express Delivery", price: 799, currency: "RUB" },
];

const LINES = [
  { id: "p-1", name: "Drill", price: 56, quantityInCart: 2, previewImage: "" },
] as never;

let container: HTMLDivElement;
let root: Root;

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const render = async (): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<CheckoutForm lines={LINES} />);
  });
  await flush();
};

const text = (): string => container.textContent ?? "";
const submit = (): HTMLButtonElement =>
  container.querySelector("button[type='submit']") as HTMLButtonElement;
const buttonByText = (label: string): HTMLButtonElement =>
  [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === label,
  ) as HTMLButtonElement;
const methods = (): HTMLInputElement[] => [
  ...container.querySelectorAll<HTMLInputElement>(
    "input[name='shippingMethodId']",
  ),
];

describe("CheckoutForm delivery states", () => {
  beforeEach(() => {
    state.shipping.methods = [];
    state.shipping.isLoading = false;
    state.shipping.error = null;
    state.shipping.mutate = vi.fn();
    state.pickup.points = [];
    state.pickup.isLoading = false;
    state.pickup.error = null;
    state.pickup.mutate = vi.fn();
    state.checkout.handleCheckout = vi.fn();
    state.toast.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("держит загрузку на способе доставки и закрывает отправку (AC-9, AC-14)", async () => {
    state.shipping.isLoading = true;

    await render();

    expect(text()).toContain("cart.shippingMethod");
    expect(text()).toContain("cart.hintShippingLoading");
    expect(submit().disabled).toBe(true);
  });

  it("показывает недоступность доставки и повторяет запрос (AC-15)", async () => {
    await render();

    expect(text()).toContain("cart.shippingUnavailable");
    expect(submit().disabled).toBe(true);

    await act(async () => {
      buttonByText("cart.shippingRetry").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(state.shipping.mutate).toHaveBeenCalledTimes(1);
  });

  it("держит ту же недоступность, когда запрос упал (AC-15)", async () => {
    state.shipping.error = { message: "gateway is down" };

    await render();

    expect(text()).toContain("cart.shippingUnavailable");
    expect(submit().disabled).toBe(true);
  });

  it("печатает три суммы в рублях и цену каждого способа (AC-11, AC-13)", async () => {
    state.shipping.methods = METHODS;

    await render();

    expect(text()).toContain("112,00\u00A0₽");
    expect(text()).toContain("0,00\u00A0₽");
    expect(text()).not.toContain("$");
    expect(text()).toContain("Standard Delivery");
    expect(text()).toContain("299,00\u00A0₽");
    expect(text()).toContain("799,00\u00A0₽");
    expect(methods()).toHaveLength(2);
  });

  it("не отправляет заказ, пока способ доставки не выбран (AC-14)", async () => {
    state.shipping.methods = METHODS;

    await render();

    expect(text()).toContain("cart.placeOrder");
    expect(text()).toContain("cart.hintShippingMethod");
    expect(submit().disabled).toBe(true);
  });

  it("держит поле адреса, пока способ не выбран, и не показывает поле точки (AC-8)", async () => {
    state.shipping.methods = [
      ...METHODS,
      {
        id: "sm-pickup",
        name: "Pickup at the shop",
        price: 0,
        currency: "RUB",
        isPickup: true,
      },
    ];
    state.pickup.points = [
      { id: "pp-1", name: "Central Pickup", address: "Tverskaya 12" },
    ];

    await render();

    expect(container.querySelector("textarea")).not.toBeNull();
    expect(text()).toContain("cart.deliveryAddress");
    expect(text()).not.toContain("cart.pickupSelect");
    expect(submit().disabled).toBe(true);
  });
});
