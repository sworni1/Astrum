import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderStatus } from "@/common/types/order.types";
import DeliveryProgress from "./index";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("DeliveryProgress", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
  });

  const render = async (status: OrderStatus) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<DeliveryProgress status={status} />);
    });
  };

  const labels = (): (string | null)[] =>
    [...container.querySelectorAll("span")].map((span) => span.textContent);
  const discs = (): HTMLElement[] => [
    ...container.querySelectorAll<HTMLElement>("[class*='rounded-full']"),
  ];

  it("renders the four steps once, not one copy per breakpoint", async () => {
    await render(OrderStatus.SHIPPED);

    expect(labels()).toEqual([
      "status.pending",
      "status.confirmed",
      "status.shipped",
      "status.delivered",
    ]);
    expect(discs()).toHaveLength(4);
  });

  it("paints the steps up to the current one green", async () => {
    await render(OrderStatus.CONFIRMED);

    expect(
      discs().filter((disc) => disc.className.includes("bg-green-500")),
    ).toHaveLength(2);
    expect(
      discs().filter((disc) => disc.className.includes("bg-gray-600")),
    ).toHaveLength(2);
  });

  it("paints no step for a cancelled order", async () => {
    await render(OrderStatus.CANCELED);

    expect(
      discs().filter((disc) => disc.className.includes("bg-green-500")),
    ).toHaveLength(0);
  });

  it.each([
    [OrderStatus.PENDING, "0%"],
    [OrderStatus.CONFIRMED, "33.33%"],
    [OrderStatus.SHIPPED, "66.67%"],
    [OrderStatus.DELIVERED, "100%"],
    [OrderStatus.CANCELED, "0%"],
  ])("shows %s progress", async (status, expectedWidth) => {
    await render(status);

    expect(container.querySelector<HTMLElement>("[style]")?.style.width).toBe(
      expectedWidth,
    );
  });
});
