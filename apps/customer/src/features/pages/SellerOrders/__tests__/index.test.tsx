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
    values ? `${key} ${JSON.stringify(values)}` : key,
  useFormatter: () => ({
    dateTime: (value: Date, options?: { timeStyle?: string }) =>
      options?.timeStyle
        ? `placed ${value.toISOString()}`
        : `date ${value.toISOString()}`,
    number: (value: number) => String(value),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    unoptimized,
  }: {
    alt: string;
    src: string;
    unoptimized?: boolean;
  }) => (
    <span
      data-alt={alt}
      data-src={src}
      data-unoptimized={String(unoptimized ?? false)}
    />
  ),
}));

import SellerOrders from "@/features/pages/SellerOrders";

let container: HTMLDivElement;
let root: Root;

const line = (over: Record<string, unknown> = {}) => ({
  id: "line-1",
  productId: "product-1",
  name: "Kettle",
  previewImage: "",
  quantity: 3,
  price: 9.99,
  currency: "RUB",
  status: "CONFIRMED",
  ...over,
});

const order = {
  id: "order-12345678",
  createdAt: "2026-11-08T10:00:00.000Z",
  paymentStatus: "PENDING",
  paymentMethod: "ONLINE_CARD",
  isPickup: true,
  pickupPointId: "pp-1",
  pickupPointName: "Central",
  pickupPointAddress: "Tverskaya 12",
  handedOverAt: "2026-11-13T12:00:00.000Z",
  orderItems: [line()],
};

const page = {
  orders: [order],
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
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

const answersWith = (answer: unknown): void => {
  getData.mockResolvedValue(answer);
};

const text = (): string => container.textContent ?? "";

const band = (): HTMLTableRowElement =>
  container.querySelectorAll("tbody tr")[0] as HTMLTableRowElement;

const firstLineRow = (): HTMLTableRowElement =>
  container.querySelectorAll("tbody tr")[1] as HTMLTableRowElement;

describe("SellerOrders table", () => {
  beforeEach(() => {
    getData.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("prints the five column labels in order under an accessible table name (AC-1)", async () => {
    answersWith(page);

    await renderPage();

    const table = container.querySelector("table");
    const labels = Array.from(container.querySelectorAll("thead th")).map(
      (cell) => cell.textContent,
    );

    expect(table?.getAttribute("aria-label")).toBe("title");
    expect(labels).toEqual([
      "columns.orderNumber",
      "columns.product",
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

  it("prints the facts of the order in a band above its lines (AC-2)", async () => {
    answersWith(page);

    await renderPage();

    const facts = band().textContent ?? "";

    expect(band().querySelector("span[title='order-12345678']")).not.toBeNull();
    expect(facts).toContain("orderNumber");
    expect(facts).toContain("12345678");
    expect(facts).toContain("paymentLabel");
    expect(facts).toContain("statusCount");
    expect(facts).toContain("Central");
    expect(facts).toContain("Tverskaya 12");
    expect(facts).toContain("handedOverAt");
    expect(band().querySelectorAll("td")[1].getAttribute("colspan")).toBe("4");
  });

  it("prints the placed date in the date column and none in the band (AC-3)", async () => {
    answersWith(page);

    await renderPage();

    const row = firstLineRow();
    const cells = Array.from(row.querySelectorAll("td"));

    expect(cells[3].textContent).toContain("placed 2026-11-08T10:00:00.000Z");
    expect(band().textContent).not.toContain("placed");
    expect(band().textContent).toContain("date 2026-11-13T12:00:00.000Z");
  });

  it("prints the rounded line sum beside the product and its quantity (AC-4)", async () => {
    answersWith(page);

    await renderPage();

    const cells = Array.from(firstLineRow().querySelectorAll("td"));

    expect(cells[1].textContent).toContain("Kettle × 3");
    expect(cells[1].querySelector("a[href='/products/product-1']")).not.toBeNull();
    expect(cells[2].textContent).toContain("29.97");
    expect(text()).not.toContain("29.970000");
    expect(text()).not.toContain("toFixed");
  });

  it("offers no control that sends a request and renders no dialog (AC-5)", async () => {
    answersWith(page);

    await renderPage();

    const buttons = Array.from(container.querySelectorAll("button")).map(
      (button) => button.textContent,
    );

    expect(buttons).toEqual(["pagination.back", "pagination.next"]);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("labels every line value so the row reads as a card on a narrow screen (AC-8)", async () => {
    answersWith(page);

    await renderPage();

    const cells = Array.from(firstLineRow().querySelectorAll("td")).filter(
      (cell) => cell.textContent !== "",
    );
    const labelled = cells.map((cell) =>
      Array.from(cell.querySelectorAll("span")).find(
        (span) => span.className.includes("sm:sr-only"),
      ),
    );

    expect(labelled.map((label) => label?.textContent)).toEqual([
      "columns.product",
      "columns.subtotal",
      "columns.date",
      "columns.status",
    ]);
  });

  it("asks for the last page instead of printing page three of two (AC-7)", async () => {
    getData.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("page=2")
          ? { ...page, page: 2, total: 21, totalPages: 2 }
          : { orders: [], page: 1, limit: 20, total: 21, totalPages: 2 },
      ),
    );

    await renderPage();
    await flush();

    expect(getData).toHaveBeenCalledWith("/seller/orders?page=2&limit=20");
    expect(text()).toContain("Kettle");
    expect(text()).toContain('"page":2');
  });

  it("keeps the shown rows under a loading strip while the next page loads (AC-7)", async () => {
    let settle: (value: unknown) => void = () => undefined;
    const secondPage = new Promise((resolve) => {
      settle = resolve;
    });

    getData.mockImplementation((url: string) =>
      url.includes("page=2")
        ? secondPage
        : Promise.resolve({ ...page, total: 21, totalPages: 2 }),
    );

    await renderPage();

    const next = Array.from(container.querySelectorAll("button")).find(
      (node) => node.textContent === "pagination.next",
    ) as HTMLButtonElement;

    expect(next.disabled).toBe(false);

    await act(async () => next.click());
    await flush();

    expect(text()).toContain("Kettle");
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    await act(async () => {
      settle({
        orders: [{ ...order, id: "order-2", orderItems: [line({ name: "Whistle" })] }],
        page: 2,
        limit: 20,
        total: 21,
        totalPages: 2,
      });
    });
    await flush();

    expect(text()).toContain("Whistle");
    expect(text()).not.toContain("Kettle");
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("sends an external thumbnail past the optimizer and keeps a local one on it (AC-4)", async () => {
    answersWith({
      ...page,
      orders: [
        {
          ...order,
          orderItems: [
            line({ id: "line-remote", previewImage: "https://placehold.co/600x400" }),
            line({ id: "line-local", name: "Mug", previewImage: "/images/mug.png" }),
          ],
        },
      ],
    });

    await renderPage();

    const thumbs = Array.from(container.querySelectorAll("[data-src]"));

    expect(thumbs.map((node) => node.getAttribute("data-src"))).toEqual([
      "https://placehold.co/600x400",
      "/images/mug.png",
    ]);
    expect(thumbs.map((node) => node.getAttribute("data-unoptimized"))).toEqual([
      "true",
      "false",
    ]);
  });
});
