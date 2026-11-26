import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getData } = vi.hoisted(() => ({ getData: vi.fn() }));

vi.mock("@/hooks/useFetcher", () => ({
  useFetcher: () => ({
    fetcher: {},
    getData,
    deleteItem: vi.fn(),
    patchItem: vi.fn(),
    postItem: vi.fn(),
    putItem: vi.fn(),
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values === undefined ? key : `${key} ${JSON.stringify(values)}`,
  useFormatter: () => ({
    dateTime: (value: Date, options?: { hour?: string }) =>
      options?.hour === undefined
        ? `handed ${value.toISOString()}`
        : `placed ${value.toISOString()}`,
  }),
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

vi.mock("next/image", () => ({
  default: ({ src }: { src: string }) => <span data-src={src} />,
}));

vi.mock("@/common/helpers/showToast", () => ({ showToast: vi.fn() }));

import { showToast } from "@/common/helpers/showToast";
import SellerOrders from "@/features/pages/SellerOrders";

const NBSP = "\u00A0";

const toast = vi.mocked(showToast);

let container: HTMLDivElement;
let root: Root;

const line = (over: Record<string, unknown> = {}) => ({
  id: "line-1",
  orderId: "order-12345678",
  productId: "product-1",
  name: "Kettle",
  previewImage: "",
  quantity: 3,
  price: 9.99,
  subtotal: 29.97,
  currency: "RUB",
  status: "DELIVERED",
  createdAt: "2026-11-08T10:00:00.000Z",
  isPickup: true,
  pickupPointName: "Central",
  pickupPointAddress: "Tverskaya 12",
  handedOverAt: "2026-11-13T12:00:00.000Z",
  deliveryAddress: null,
  ...over,
});

const page = {
  items: [line()],
  counts: { all: 25, delivered: 21, canceled: 4 },
  stats: { revenue: [{ currency: "RUB", amount: 46332 }], units: 7 },
  page: 1,
  limit: 20,
  total: 25,
  totalPages: 2,
};

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const renderPage = async (): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <SellerOrders />
      </SWRConfig>,
    );
  });
  await flush();
};

const text = (): string => container.textContent ?? "";

const cells = (): HTMLElement[] =>
  Array.from(
    (
      container.querySelector("tbody tr") as HTMLTableRowElement
    ).querySelectorAll("td"),
  );

const typeQuery = async (value: string): Promise<void> => {
  const input = container.querySelector(
    'input[type="search"]',
  ) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  setter?.call(input, value);

  await act(async () => {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("SellerOrders table", () => {
  beforeEach(() => {
    getData.mockReset();
    getData.mockResolvedValue(page);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("prints the six column labels in the mockup order (AC-9)", async () => {
    await renderPage();

    const labels = Array.from(container.querySelectorAll("thead th")).map(
      (cell) => cell.textContent,
    );

    expect(container.querySelector("table")?.getAttribute("aria-label")).toBe(
      "title",
    );
    expect(labels).toEqual([
      "columns.orderNumber",
      "columns.product",
      "columns.receipt",
      "columns.subtotal",
      "columns.date",
      "columns.status",
    ]);
    expect(
      Array.from(container.querySelectorAll("thead th")).every(
        (cell) => cell.getAttribute("scope") === "col",
      ),
    ).toBe(true);
  });

  it("prints the four tiles from the counts and the money (AC-6)", async () => {
    await renderPage();

    const labels = Array.from(
      container.querySelectorAll(".text-sm.text-muted-foreground"),
    )
      .map((node) => node.textContent)
      .filter((value) => value?.startsWith("stats."));
    const values = Array.from(container.querySelectorAll("span.text-2xl")).map(
      (node) => node.textContent,
    );

    expect(labels).toEqual([
      "stats.revenue",
      "stats.units",
      "stats.delivered",
      "stats.canceled",
    ]);
    expect(values).toEqual([`46${NBSP}332,00${NBSP}₽`, "7", "21", "4"]);
  });

  it("prints the three tabs with their counts under an accessible strip (AC-7)", async () => {
    await renderPage();

    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));

    expect(
      container.querySelector('[role="tablist"]')?.getAttribute("aria-label"),
    ).toBe("tabs.label");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'tabs.all {"count":25}',
      'tabs.delivered {"count":21}',
      'tabs.canceled {"count":4}',
    ]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(getData).toHaveBeenCalledWith("/seller/orders?page=1&limit=20");
  });

  it("reads the chosen tab from the server and returns to the first page (AC-7)", async () => {
    await renderPage();

    const canceled = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    )[2];

    await act(async () => canceled.click());
    await flush();

    expect(getData).toHaveBeenCalledWith(
      "/seller/orders?status=CANCELED&page=1&limit=20",
    );
    expect(canceled.getAttribute("aria-selected")).toBe("true");
  });

  it("moves a settled query into the request 300 ms after the last keystroke (AC-8)", async () => {
    await renderPage();

    const input = container.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;

    expect(input.getAttribute("aria-label")).toBe("search.label");
    expect(input.getAttribute("placeholder")).toBe("search.placeholder");

    vi.useFakeTimers();

    try {
      await typeQuery("drill");
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
    } finally {
      vi.useRealTimers();
    }

    await flush();

    expect(getData).toHaveBeenCalledWith(
      "/seller/orders?q=drill&page=1&limit=20",
    );
  });

  it("prints one row per line with the six mockup cells (AC-9)", async () => {
    await renderPage();

    const [order, product, receipt, amount, date, status] = cells();

    expect(order.textContent).toContain("12345678");
    expect(order.querySelector(".font-mono")).not.toBeNull();
    expect(order.querySelector(".font-mono")?.getAttribute("aria-label")).toBe(
      'orderNumber {"number":"12345678"}',
    );
    expect(product.textContent).toContain("Kettle");
    expect(product.textContent).toContain('quantity {"count":3}');
    expect(
      container.querySelectorAll("a[href='/products/product-1']"),
    ).toHaveLength(2);
    expect(receipt.textContent).toContain("Central");
    expect(receipt.textContent).toContain("handed 2026-11-13T12:00:00.000Z");
    expect(amount.textContent).toContain(`29,97${NBSP}₽`);
    expect(amount.className).toContain("text-right");
    expect(date.textContent).toContain("placed 2026-11-08T10:00:00.000Z");
    expect(status.textContent).toContain("delivered");
    expect(status.className).toContain("justify-end");
    expect(status.querySelector(".rounded-full")?.className).toContain(
      "whitespace-nowrap",
    );
  });

  it("prints a courier address and the missing address note (AC-9)", async () => {
    getData.mockResolvedValue({
      ...page,
      items: [
        line({
          id: "line-courier",
          isPickup: false,
          pickupPointName: null,
          pickupPointAddress: null,
          handedOverAt: null,
          deliveryAddress: "Lenina 5",
        }),
        line({
          id: "line-empty",
          isPickup: false,
          pickupPointName: null,
          pickupPointAddress: null,
          handedOverAt: null,
          deliveryAddress: null,
        }),
      ],
    });

    await renderPage();

    const rows = Array.from(container.querySelectorAll("tbody tr"));

    expect(rows[0].textContent).toContain("receipt.courier");
    expect(rows[0].textContent).toContain("Lenina 5");
    expect(rows[1].textContent).toContain("receipt.noAddress");
  });

  it("labels every cell for the stacked card below sm (AC-12)", async () => {
    await renderPage();

    const labels = cells().map((cell) =>
      Array.from(cell.querySelectorAll("span")).find((span) =>
        span.className.includes("sm:hidden"),
      ),
    );

    expect(labels.map((label) => label?.textContent)).toEqual([
      "columns.orderNumber",
      "columns.product",
      "columns.receipt",
      "columns.subtotal",
      "columns.date",
      "columns.status",
    ]);
  });

  it("slices lines 20 at a time and disables the ends of the range (AC-10)", async () => {
    await renderPage();

    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("nav button"),
    );

    expect(text()).toContain('found {"count":25}');
    expect(text()).toContain('pagination.pageOf {"page":1,"totalPages":2}');
    expect(buttons.map((button) => button.textContent)).toEqual([
      "pagination.back",
      "pagination.next",
    ]);
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);

    await act(async () => buttons[1].click());
    await flush();

    expect(getData).toHaveBeenCalledWith("/seller/orders?page=2&limit=20");
  });

  it("sends no control that writes anything (AC-1)", async () => {
    await renderPage();

    const buttons = Array.from(container.querySelectorAll("button")).map(
      (button) => button.getAttribute("role") ?? button.textContent,
    );

    expect(buttons).toEqual([
      "tab",
      "tab",
      "tab",
      "pagination.back",
      "pagination.next",
    ]);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("raises one toast for a failed read and none for the typed refusal (AC-11)", async () => {
    toast.mockClear();
    getData.mockRejectedValueOnce(new Error("gateway down"));

    await renderPage();

    expect(text()).toContain("states.failureTitle");
    expect(toast).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    container.remove();

    getData.mockReset();
    getData.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { code: "SELLER_NOT_ASSIGNED" } },
    });

    await renderPage();

    expect(text()).toContain("states.notSellerTitle");
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
