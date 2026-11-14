import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Group = import("@/common/types/order.types").SellerOrderGroup;
type Line = import("@/common/types/order.types").SellerOrderLine;

const state = vi.hoisted(() => ({
  handover: {
    handOver: vi.fn(),
    isHandingOver: false,
    error: null as unknown,
  },
  toast: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const translate = (key: string, values?: Record<string, unknown>) =>
      values
        ? `${namespace}.${key} ${JSON.stringify(values)}`
        : `${namespace}.${key}`;

    return Object.assign(translate, { rich: translate });
  },
  useFormatter: () => ({ dateTime: () => "1 December 2026" }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span data-image-source={src} data-image-alt={alt} />
  ),
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

vi.mock("@/common/helpers/showToast", () => ({ showToast: state.toast }));

vi.mock("@/hooks/seller/useSellerHandover", () => ({
  useSellerHandover: () => state.handover,
}));

vi.mock("@/hooks/seller/useSellerOrderItemStatus", () => ({
  useSellerOrderItemStatus: () => ({
    changeStatus: vi.fn(),
    isChanging: false,
    error: null,
  }),
}));

import {
  OrderItemStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/common/types/order.types";
import SellerOrderGroup from "@/features/pages/SellerOrders/SellerOrderGroup";

const line = (id: string, status: OrderItemStatus): Line => ({
  id,
  productId: `product-${id}`,
  name: `Product ${id}`,
  previewImage: "",
  quantity: 1,
  price: 10,
  currency: "RUB" as Line["currency"],
  status,
});

const groupOf = (overrides: Partial<Group> = {}): Group => ({
  id: "order-1234567890",
  createdAt: "2026-11-08T10:00:00.000Z",
  paymentStatus: PaymentStatus.PENDING,
  paymentMethod: PaymentMethod.CASH,
  isPickup: true,
  pickupPointId: "pp-1",
  pickupPointName: "Central Pickup",
  pickupPointAddress: "Tverskaya 12",
  handedOverAt: null,
  orderItems: [line("line-1", OrderItemStatus.CONFIRMED)],
  ...overrides,
});

let container: HTMLDivElement;
let root: Root;

const tick = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const press = async (element: Element | null | undefined): Promise<void> => {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick();
  });
};

const pressEscape = async (): Promise<void> => {
  await act(async () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await tick();
  });
};

const handoverButton = (): HTMLButtonElement | undefined =>
  [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("seller.handover"),
  );

const dialog = (): Element | null => document.querySelector('[role="dialog"]');

const keep = (): Element | null =>
  document.querySelector('[data-slot="dialog-close"]');

const confirm = (): Element | undefined =>
  [...document.querySelectorAll('[data-slot="dialog-footer"] button')].find(
    (button) => button.textContent?.includes("seller.handoverConfirm"),
  );

const render = async (order: Group, actionsDisabled = false): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <SellerOrderGroup
        order={order}
        actionsDisabled={actionsDisabled}
        onUpdated={vi.fn()}
        onRefused={vi.fn()}
        onHandedOver={vi.fn()}
        onReload={vi.fn()}
      />,
    );
  });
};

describe("SellerOrderGroup pickup block", () => {
  beforeEach(() => {
    state.handover.handOver = vi.fn().mockResolvedValue(undefined);
    state.handover.isHandingOver = false;
    state.handover.error = null;
    state.toast.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("показывает точку и управление выдачей у готовой строки (AC-13)", async () => {
    await render(groupOf());

    expect(container.textContent).toContain("Central Pickup");
    expect(container.textContent).toContain("Tverskaya 12");
    expect(handoverButton()).toBeDefined();
    expect(handoverButton()?.disabled).toBe(false);
  });

  it("не предлагает выдачу, когда готовых строк нет (AC-13)", async () => {
    await render(
      groupOf({
        orderItems: [
          line("line-1", OrderItemStatus.PENDING),
          line("line-2", OrderItemStatus.DELIVERED),
        ],
      }),
    );

    expect(handoverButton()).toBeUndefined();
  });

  it("не предлагает выдачу аккаунту, который ещё не подтверждён (AC-13)", async () => {
    await render(groupOf(), true);

    expect(handoverButton()?.disabled).toBe(true);
  });

  it("показывает дату выдачи и не прячет точку (AC-13)", async () => {
    await render(
      groupOf({
        handedOverAt: "2026-12-01T10:00:00.000Z",
        orderItems: [line("line-1", OrderItemStatus.DELIVERED)],
      }),
    );

    expect(container.textContent).toContain("seller.handedOverAt");
    expect(container.textContent).toContain("Central Pickup");
  });

  it("предлагает выдачу курьерской группе без точки выдачи (AC-7, AC-8)", async () => {
    await render(
      groupOf({
        isPickup: false,
        pickupPointId: null,
        pickupPointName: null,
        pickupPointAddress: null,
      }),
    );

    expect(container.textContent).not.toContain("Central Pickup");
    expect(handoverButton()).toBeDefined();
  });
});

describe("SellerOrderGroup handover dialog", () => {
  beforeEach(() => {
    state.handover.handOver = vi.fn().mockResolvedValue(undefined);
    state.handover.isHandingOver = false;
    state.toast.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("называет точку и число строк и молчит, пока не подтверждено (AC-13)", async () => {
    await render(
      groupOf({
        orderItems: [
          line("line-1", OrderItemStatus.CONFIRMED),
          line("line-2", OrderItemStatus.SHIPPED),
          line("line-3", OrderItemStatus.PENDING),
        ],
      }),
    );
    await press(handoverButton());

    expect(dialog()).not.toBeNull();
    expect(document.body.textContent).toContain("Central Pickup");
    expect(document.body.textContent).toContain('"count":2');
    expect(state.handover.handOver).not.toHaveBeenCalled();
  });

  it("называет число строк без точки у курьерской группы (AC-8)", async () => {
    await render(
      groupOf({
        isPickup: false,
        pickupPointId: null,
        pickupPointName: null,
        pickupPointAddress: null,
      }),
    );
    await press(handoverButton());

    expect(dialog()).not.toBeNull();
    expect(document.body.textContent).toContain("seller.handoverCourierText");
    expect(document.body.textContent).not.toContain("seller.handoverText");
    expect(document.body.textContent).toContain('"count":1');
  });

  it("закрывается по Escape и по отказу, ничего не отправляя (AC-13)", async () => {
    await render(groupOf());
    await press(handoverButton());
    await pressEscape();

    expect(dialog()).toBeNull();
    expect(state.handover.handOver).not.toHaveBeenCalled();

    await press(handoverButton());
    await press(keep());

    expect(dialog()).toBeNull();
    expect(state.handover.handOver).not.toHaveBeenCalled();
  });

  it("отправляет ровно один запрос с подтверждения (AC-13)", async () => {
    await render(groupOf());
    await press(handoverButton());
    await press(confirm());

    expect(state.handover.handOver).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it("держит занятое состояние на управлении и не даёт нажать второй раз (AC-13)", async () => {
    state.handover.isHandingOver = true;

    await render(groupOf());

    expect(handoverButton()?.disabled).toBe(true);
    expect(handoverButton()?.getAttribute("aria-busy")).toBe("true");
    expect(container.textContent).toContain("seller.handoverBusy");
  });

  it("показывает текст отказа и перечитывает список (AC-13)", async () => {
    state.handover.handOver = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { data: { code: "NOTHING_TO_HAND_OVER" } },
    });
    const onReload = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <SellerOrderGroup
          order={groupOf()}
          actionsDisabled={false}
          onUpdated={vi.fn()}
          onRefused={vi.fn()}
          onHandedOver={vi.fn()}
          onReload={onReload}
        />,
      );
    });

    await press(handoverButton());
    await press(confirm());

    expect(state.toast).toHaveBeenCalledTimes(1);
    expect(state.toast.mock.calls[0][0].title).toContain(
      "seller.toasts.nothingToHandOver",
    );
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
