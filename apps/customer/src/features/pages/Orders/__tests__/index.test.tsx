import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Currency } from "@/common/types/product.types";
import Orders from "@/features/pages/Orders";

const page = {
  items: [
    {
      id: "01JG8ZP4XQ6s5hb6l1",
      status: "DELIVERED",
      createdAt: "2026-11-14T10:00:00.000Z",
      grandTotal: 61078.6,
      currency: Currency.RUB,
      orderItems: [
        {
          id: "line-1",
          name: "Parker Urban T200",
          previewImage: "",
          quantity: 18,
          status: "DELIVERED",
          receiptDate: "2026-11-19T10:00:00.000Z",
        },
      ],
    },
  ],
  counts: { all: 1, delivered: 1, canceled: 0 },
  spent: [{ currency: Currency.RUB, amount: 61078.6 }],
};

vi.mock("@/hooks/order/useGetOrders", () => ({
  useGetOrders: () => ({
    page,
    isLoading: false,
    isValidating: false,
    error: null,
    mutate: vi.fn(),
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations:
    () =>
    (key: string, values?: { count?: number; number?: string }) =>
      `${key}:${values?.count ?? values?.number ?? ""}`,
  useFormatter: () => ({ dateTime: () => "DATE" }),
  useLocale: () => "ru",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({ default: () => <span data-image="" /> }));

describe("Orders screen smoke", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("renders the shell, the tiles, the tabs, the search and one group", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<Orders />);
    });

    const text = container.textContent ?? "";

    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(container.querySelector('[role="tablist"]')).not.toBeNull();
    expect(text).toContain("stats.orders:1");
    expect(text).toContain("stats.received:1");
    expect(text).toContain("61\u00A0078,60\u00A0₽");
    expect(container.querySelector('input[type="search"]')).not.toBeNull();
    expect(text).toContain("6s5hb6l1");
    expect(text).toContain("Parker Urban T200");
    expect(text).toContain("quantity:18");
    expect(text).toContain("itemStatus.delivered");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/orders/01JG8ZP4XQ6s5hb6l1",
    );
  });
});
