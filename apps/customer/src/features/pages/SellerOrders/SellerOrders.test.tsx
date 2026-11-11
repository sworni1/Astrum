import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orders: {
    data: undefined as unknown,
    kind: "none" as string,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  },
  user: { profileData: { status: "ACTIVE" } },
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
  createTranslator: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/hooks/seller/useSellerOrders", () => ({
  useSellerOrders: () => mocks.orders,
}));

vi.mock("@/hooks/user/useUser", () => ({ useUser: () => mocks.user }));

import SellerOrders from ".";

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
    root.render(<SellerOrders />);
  });
  await flush();
};

describe("SellerOrders panel states", () => {
  beforeEach(() => {
    mocks.orders.kind = "none";
    mocks.orders.data = undefined;
    mocks.orders.isLoading = false;
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("offers the onboarding page to an account that does not sell (AC-12)", async () => {
    mocks.orders.kind = "notSeller";
    await render();

    const link = container.querySelector("a[href='/seller/onboarding']");

    expect(container.textContent).toContain("seller.states.notSellerTitle");
    expect(link?.textContent).toBe("seller.states.notSellerAction");
  });

  it("keeps the disabled screen when the workflow flag is off (AC-12)", async () => {
    mocks.orders.kind = "disabled";
    await render();

    expect(container.textContent).toContain("seller.states.disabledTitle");
    expect(container.querySelector("a[href='/seller/onboarding']")).toBeNull();
  });
});
