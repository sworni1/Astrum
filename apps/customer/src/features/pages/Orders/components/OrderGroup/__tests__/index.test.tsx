import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type OrderListRow,
  OrderItemStatus,
  OrderStatus,
} from "@/common/types/order.types";
import { Currency } from "@/common/types/product.types";
import OrderGroup from "@/features/pages/Orders/components/OrderGroup";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span data-image-source={src} data-image-alt={alt} />
  ),
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

const state = vi.hoisted(() => ({ calls: [] as Intl.DateTimeFormatOptions[] }));

vi.mock("next-intl", () => ({
  useLocale: () => "ru",
  useTranslations:
    () =>
    (key: string, values?: { count?: number; number?: string }) => {
      if (key === "quantity") {
        return `${values?.count} pcs`;
      }

      if (key === "number") {
        return `Order #${values?.number}`;
      }

      return key;
    },
  useFormatter: () => ({
    dateTime: (value: Date, options: Intl.DateTimeFormatOptions = {}) => {
      const timeZone = options.timeZone ?? "UTC";

      state.calls.push({ ...options, timeZone });

      return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(
        value,
      );
    },
  }),
}));

const order: OrderListRow = {
  id: "01JG8ZP4XQ6s5hb6l1",
  status: OrderStatus.DELIVERED,
  createdAt: "2026-11-14T10:00:00.000Z",
  grandTotal: 61078.6,
  currency: Currency.RUB,
  orderItems: [
    {
      id: "line-1",
      name: "Parker Urban T200",
      previewImage: "https://cdn.test/pen.png",
      quantity: 18,
      status: OrderItemStatus.DELIVERED,
      receiptDate: "2026-11-19T10:00:00.000Z",
    },
  ],
};

describe("OrderGroup", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
  });

  const render = async (item: OrderListRow): Promise<void> => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<OrderGroup order={item} />);
    });
  };

  const line = (item: OrderListRow) => item.orderItems[0];

  it("ведёт на заказ и печатает номер, дату и сумму (AC-10)", async () => {
    await render(order);

    const link = container.querySelector("a");

    expect(link?.getAttribute("href")).toBe(`/orders/${order.id}`);
    expect(link?.getAttribute("aria-label")).toBe(
      `Order #${order.id.slice(-8)}`,
    );
    expect(container.textContent).toContain(order.id.slice(-8));
    expect(container.textContent).toContain("61\u00A0078,60\u00A0₽");
  });

  it("печатает дату заказа в часовом поясе браузера (AC-10)", async () => {
    await render(order);

    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const expected = new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeZone: browserZone,
    }).format(new Date(order.createdAt));

    expect(container.textContent).toContain(expected);
    expect(state.calls[0]?.timeZone).toBe(browserZone);
  });

  it("печатает строку заказа с картинкой, количеством и статусом (AC-11)", async () => {
    await render(order);

    const image = container.querySelector("[data-image-source]");

    expect(image?.getAttribute("data-image-source")).toBe(
      line(order).previewImage,
    );
    expect(image?.getAttribute("data-image-alt")).toBe(line(order).name);
    expect(container.textContent).toContain("Parker Urban T200");
    expect(container.textContent).toContain("18 pcs");
    expect(container.textContent).toContain("itemStatus.delivered");
  });

  it("печатает дату получения рядом со статусом строки (AC-11)", async () => {
    await render(order);

    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const expected = new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeZone: browserZone,
    }).format(new Date(line(order).receiptDate as string));

    expect(container.textContent).toContain(expected);
  });

  it("держит квадрат с иконкой вместо пустой картинки (AC-11)", async () => {
    await render({
      ...order,
      orderItems: [{ ...line(order), previewImage: "" }],
    });

    expect(container.querySelector("[data-image-source]")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
