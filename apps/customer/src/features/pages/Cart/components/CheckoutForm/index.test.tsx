import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Method = { id: string; name: string; price: number; currency: string };

const state = vi.hoisted(() => ({
  shipping: {
    methods: [] as Method[],
    isLoading: false,
    error: null as unknown,
    mutate: vi.fn(),
  },
  checkout: { handleCheckout: vi.fn() },
  toast: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
  useFormatter: () => ({ dateTime: (value: Date) => value.toISOString() }),
}));

vi.mock("@/hooks", () => ({
  useCheckout: () => state.checkout,
  useShippingMethods: () => state.shipping,
}));

vi.mock("@/common", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, showToast: state.toast };
});

import CheckoutForm from "./index";

const METHODS: Method[] = [
  { id: "sm-1", name: "Standard Delivery", price: 299, currency: "RUB" },
  { id: "sm-2", name: "Express Delivery", price: 799, currency: "RUB" },
];

const CART = [
  { id: "p-1", name: "Drill", price: 56, quantityInCart: 2 },
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
    root.render(<CheckoutForm cartItems={CART} subtotal={112} />);
  });
  await flush();
};

const text = (): string => container.textContent ?? "";
const trigger = (): HTMLButtonElement =>
  container.querySelector("[data-slot='select-trigger']") as HTMLButtonElement;
const submit = (): HTMLButtonElement =>
  container.querySelector("button[type='submit']") as HTMLButtonElement;
const buttonByText = (label: string): HTMLButtonElement =>
  [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === label,
  ) as HTMLButtonElement;

describe("CheckoutForm delivery states", () => {
  beforeEach(() => {
    state.shipping.methods = [];
    state.shipping.isLoading = false;
    state.shipping.error = null;
    state.shipping.mutate = vi.fn();
    state.checkout.handleCheckout = vi.fn();
    state.toast.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("показывает загрузку на самом триггере и закрывает выбор (AC-9, AC-10)", async () => {
    state.shipping.isLoading = true;

    await render();

    expect(trigger().textContent).toContain("cart.shippingLoading");
    expect(trigger().disabled).toBe(true);
    expect(submit().disabled).toBe(true);
  });

  it("показывает недоступность доставки и повторяет запрос (AC-10)", async () => {
    await render();

    expect(text()).toContain("cart.shippingUnavailable");
    expect(trigger().disabled).toBe(true);
    expect(submit().disabled).toBe(true);

    await act(async () => {
      buttonByText("cart.shippingRetry").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(state.shipping.mutate).toHaveBeenCalledTimes(1);
  });

  it("держит ту же недоступность, когда запрос упал (AC-10)", async () => {
    state.shipping.error = { message: "gateway is down" };

    await render();

    expect(text()).toContain("cart.shippingUnavailable");
    expect(trigger().disabled).toBe(true);
  });

  it("показывает три суммы в рублях без знака доллара (AC-9)", async () => {
    state.shipping.methods = METHODS;

    await render();

    expect(text()).toContain("₽112.00");
    expect(text()).toContain("₽0.00");
    expect(text()).toContain("₽112.00");
    expect(text()).not.toContain("$");
    expect(trigger().disabled).toBe(false);
  });

  it("не отправляет заказ, пока способ доставки не выбран (AC-10)", async () => {
    state.shipping.methods = METHODS;

    await render();

    expect(text()).toContain("cart.placeOrder");
    expect(text()).not.toContain("${price}");
    expect(submit().disabled).toBe(true);
  });
});
