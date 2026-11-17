import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderStatus } from "@/common/types/order.types";
import DeliveryProgress from "@/features/pages/Orders/OrderPage/components/DeliveryProgress";

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
    [...container.querySelectorAll("[data-testid='order-progress-step']")].map(
      (span) => span.textContent,
    );
  const rail = (): HTMLElement | null =>
    container.querySelector<HTMLElement>("[data-testid='order-progress']");

  it("renders the four step labels once, not one copy per breakpoint", async () => {
    await render(OrderStatus.SHIPPED);

    expect(labels()).toEqual([
      "status.pending",
      "status.confirmed",
      "status.shipped",
      "status.delivered",
    ]);
  });

  it("paints the labels up to the current step as reached", async () => {
    await render(OrderStatus.CONFIRMED);

    const reached = [
      ...container.querySelectorAll<HTMLElement>(
        "[data-testid='order-progress-step']",
      ),
    ].filter((span) => span.className.includes("text-foreground"));

    expect(reached).toHaveLength(2);
  });

  it("paints no step for a cancelled order", async () => {
    await render(OrderStatus.CANCELED);

    const reached = [
      ...container.querySelectorAll<HTMLElement>(
        "[data-testid='order-progress-step']",
      ),
    ].filter((span) => span.className.includes("text-foreground"));

    expect(reached).toHaveLength(0);
    expect(rail()?.querySelector<HTMLElement>("div")?.style.width).toBe("0%");
  });

  it.each([
    [OrderStatus.PENDING, "0%"],
    [OrderStatus.CONFIRMED, "33.33%"],
    [OrderStatus.SHIPPED, "66.67%"],
    [OrderStatus.DELIVERED, "100%"],
    [OrderStatus.CANCELED, "0%"],
  ])("shows %s progress", async (status, expectedWidth) => {
    await render(status);

    expect(rail()?.querySelector<HTMLElement>("div")?.style.width).toBe(
      expectedWidth,
    );
  });
});
