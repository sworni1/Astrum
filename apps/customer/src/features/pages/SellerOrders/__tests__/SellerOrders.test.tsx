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
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
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

import SellerOrders from "@/features/pages/SellerOrders";

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

  it("shows the skeleton alone on the first load (AC-7)", async () => {
    mocks.orders.isLoading = true;

    await render();

    expect(
      container.querySelector('[aria-label="seller.states.loadingLabel"]'),
    ).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).not.toContain("seller.states.emptyTitle");
    expect(container.textContent).not.toContain("seller.states.failureTitle");
  });

  it("shows the empty state when the shop holds no line (AC-7)", async () => {
    mocks.orders.data = { orders: [], page: 1, limit: 20, total: 0, totalPages: 0 };

    await render();

    expect(container.textContent).toContain("seller.states.emptyTitle");
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).not.toContain("pagination.pageOf");
    expect(
      container.querySelector('[aria-label="seller.states.loadingLabel"]'),
    ).toBeNull();
  });

  it("offers the onboarding page to an account that does not sell (AC-7)", async () => {
    mocks.orders.kind = "notSeller";

    await render();

    const link = container.querySelector("a[href='/seller/onboarding']");

    expect(container.textContent).toContain("seller.states.notSellerTitle");
    expect(link?.textContent).toBe("seller.states.notSellerAction");
  });

  it("shows the failure screen with a retry control (AC-7)", async () => {
    mocks.orders.kind = "failure";

    await render();

    const buttons = Array.from(container.querySelectorAll("button"));

    expect(container.textContent).toContain("seller.states.failureTitle");
    expect(buttons.map((button) => button.textContent)).toEqual(["seller.retry"]);
  });

  it("retries the read from the failure control (AC-7)", async () => {
    mocks.orders.kind = "failure";

    await render();

    await act(async () =>
      (container.querySelector("button") as HTMLButtonElement).click(),
    );
    await flush();

    expect(mocks.orders.mutate).toHaveBeenCalledTimes(1);
  });
});
