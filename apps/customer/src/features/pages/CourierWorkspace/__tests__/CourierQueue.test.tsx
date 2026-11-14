import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueueData = {
  orders: unknown[];
  page: number;
  totalPages: number;
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  error: unknown;
  showMore: ReturnType<typeof vi.fn>;
  mutate: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => ({
  queues: {} as Record<string, unknown>,
  action: {
    run: vi.fn(),
    pending: null as { orderId: string; action: string } | null,
  },
  scopes: [] as string[],
  toast: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) =>
    (key: string): string =>
      `${namespace}.${key}`,
  useFormatter: () => ({
    dateTime: (): string => "14 Nov 2026, 11:30",
  }),
}));

vi.mock("@/hooks/staff/useCourierOrders", () => ({
  useCourierOrders: (scope: string) => {
    mocks.scopes.push(scope);
    return mocks.queues[scope];
  },
}));

vi.mock("@/hooks/staff/useCourierOrderAction", () => ({
  useCourierOrderAction: () => mocks.action,
}));

vi.mock("@/common/helpers/showToast", () => ({ showToast: mocks.toast }));

import CourierQueue from "@/features/pages/CourierWorkspace/components/CourierQueue";

const order = (id: string, address: string | null = null, paid = false) => ({
  id,
  createdAt: "2026-11-14T08:30:00.000Z",
  status: "SHIPPED",
  paymentStatus: paid ? "PAID" : "PENDING",
  paymentMethod: "CASH",
  handedOverAt: null,
  grandTotal: 119.98,
  currency: "RUB",
  courierUserId: address === null ? null : "courier-1",
  deliveryDate: "2026-11-16T09:00:00.000Z",
  deliveryAddress: address,
  orderItems: [
    {
      id: `${id}-line`,
      name: "Drill",
      previewImage: "http://cdn/drill.png",
      quantity: 2,
      price: 19.99,
      currency: "RUB",
      status: "SHIPPED",
    },
  ],
});

const queueOf = (orders: unknown[], overrides: Partial<QueueData> = {}) => ({
  orders,
  page: 1,
  totalPages: 1,
  total: orders.length,
  isLoading: false,
  isValidating: false,
  error: null as unknown,
  showMore: vi.fn(),
  mutate: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const refusal = (status: number, code: string) => ({
  isAxiosError: true,
  response: { status, data: { code } },
});

let container: HTMLDivElement;
let root: Root;

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const renderQueue = async (): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<CourierQueue />);
  });
  await flush();
};

const byId = (id: string): Element | null =>
  container.querySelector(`[data-testid='${id}']`);

const button = (label: string): HTMLElement | undefined =>
  Array.from(container.querySelectorAll("button")).find((element) =>
    element.textContent?.includes(label),
  );

const press = async (element: Element | null): Promise<void> => {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const triggers = (): Element[] =>
  Array.from(
    container.querySelectorAll('[data-slot="alert-dialog-trigger"]'),
  );

describe("CourierQueue", () => {
  beforeEach(() => {
    mocks.queues.mine = queueOf([]);
    mocks.queues.available = queueOf([]);
    mocks.scopes = [];
    mocks.action.run.mockReset();
    mocks.action.run.mockResolvedValue(order("order-aaaaaaaa"));
    mocks.action.pending = null;
    mocks.toast.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
    document.body.innerHTML = "";
  });

  it("paints a pool card with its number, both dates, the line and the total, and no address (AC-3, AC-11)", async () => {
    mocks.queues.available = queueOf([order("order-aaaaaaaa")]);
    await renderQueue();

    const card = byId("courier-order-card");

    expect(card?.textContent).toContain("orders.number");
    expect(card?.textContent).toContain("14 Nov 2026, 11:30");
    expect(card?.textContent).toContain("orders.deliveryDate");
    expect(card?.textContent).toContain("Drill × 2");
    expect(card?.textContent).toContain("119.98");
    expect(card?.textContent).toContain("orders.itemStatus.shipped");
    expect(byId("courier-order-address")).toBeNull();
    expect(triggers()).toHaveLength(1);
  });

  it("shows the address and the three controls on a claimed card (AC-11)", async () => {
    mocks.queues.mine = queueOf([order("order-bbbbbbbb", "Tverskaya 12")]);
    await renderQueue();

    const card = byId("courier-order-card");

    expect(byId("courier-order-address")?.textContent).toContain(
      "Tverskaya 12",
    );
    expect(card?.textContent).toContain("orders.deliveryAddress");
    expect(triggers()).toHaveLength(3);

    const labels = triggers().map((element) => element.textContent);

    expect(labels).toEqual([
      "staff.courier.queue.handoverLabel",
      "staff.courier.queue.cancelLabel",
      "staff.courier.queue.releaseLabel",
    ]);
  });

  it("sends nothing until the confirm control is pressed, then reads both sections again (AC-12)", async () => {
    mocks.queues.mine = queueOf([order("order-bbbbbbbb", "Tverskaya 12")]);
    await renderQueue();

    await press(triggers()[0] ?? null);

    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(mocks.action.run).not.toHaveBeenCalled();

    await press(document.querySelector('[data-slot="alert-dialog-action"]'));

    expect(mocks.action.run).toHaveBeenCalledWith(
      "order-bbbbbbbb",
      "handover",
    );

    const mine = mocks.queues.mine as QueueData;
    const available = mocks.queues.available as QueueData;

    expect(mine.mutate).toHaveBeenCalled();
    expect(available.mutate).toHaveBeenCalled();
  });

  it("closes the dialog with the keep control and sends nothing (AC-12)", async () => {
    mocks.queues.available = queueOf([order("order-aaaaaaaa")]);
    await renderQueue();

    await press(triggers()[0] ?? null);
    await press(document.querySelector('[data-slot="alert-dialog-cancel"]'));

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(mocks.action.run).not.toHaveBeenCalled();
  });

  it("opens the cancel dialog with the money sentence on a paid parcel (AC-12)", async () => {
    mocks.queues.mine = queueOf([order("order-bbbbbbbb", "Tverskaya 12", true)]);
    await renderQueue();

    await press(triggers()[1] ?? null);

    const dialog = document.querySelector('[role="alertdialog"]');

    expect(dialog?.textContent).toContain("staff.courier.queue.cancelTitle");
    expect(dialog?.textContent).toContain(
      "staff.courier.queue.cancelPaidText",
    );
  });

  it("shows the refusal the response code names, not the server prose (AC-12)", async () => {
    mocks.queues.available = queueOf([order("order-aaaaaaaa")]);
    mocks.action.run.mockRejectedValue(refusal(409, "ALREADY_CLAIMED"));
    await renderQueue();

    await press(triggers()[0] ?? null);
    await press(document.querySelector('[data-slot="alert-dialog-action"]'));
    await flush();

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "staff.courier.queue.refusals.alreadyClaimed",
        type: "error",
      }),
    );
  });

  it("offers a retry on a refusal the map does not hold (AC-12)", async () => {
    mocks.queues.available = queueOf([order("order-aaaaaaaa")]);
    mocks.action.run.mockRejectedValue(refusal(500, "INTERNAL_SERVER_ERROR"));
    await renderQueue();

    await press(triggers()[0] ?? null);
    await press(document.querySelector('[data-slot="alert-dialog-action"]'));
    await flush();

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "staff.courier.queue.refusals.generic",
        action: {
          label: "staff.courier.queue.refusals.retry",
          onClick: expect.any(Function),
        },
      }),
    );
  });

  it("announces the success in the section that acted and moves the focus to its heading (AC-13)", async () => {
    mocks.queues.mine = queueOf([order("order-bbbbbbbb", "Tverskaya 12")]);
    await renderQueue();

    await press(triggers()[0] ?? null);
    await press(document.querySelector('[data-slot="alert-dialog-action"]'));
    await flush();

    expect(byId("courier-mine-live")?.textContent).toBe(
      "staff.courier.queue.successHandover",
    );
    expect(document.activeElement).toBe(byId("courier-mine-heading"));
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "staff.courier.queue.successHandover",
      type: "success",
    });
  });

  it("keeps its own empty text per section (AC-11)", async () => {
    await renderQueue();

    expect(byId("courier-mine-empty")?.textContent).toBe(
      "staff.courier.queue.emptyMine",
    );
    expect(byId("courier-available-empty")?.textContent).toBe(
      "staff.courier.queue.emptyAvailable",
    );
    expect(byId("courier-mine-heading")).not.toBeNull();
    expect(byId("courier-available-heading")).not.toBeNull();
  });

  it("shows Show more only in the section that has another page (AC-2, AC-11)", async () => {
    mocks.queues.mine = queueOf([order("order-bbbbbbbb", "Tverskaya 12")]);
    mocks.queues.available = queueOf([order("order-aaaaaaaa")], {
      totalPages: 2,
    });
    await renderQueue();

    const more = Array.from(container.querySelectorAll("button")).filter(
      (element) => element.textContent?.includes("staff.courier.queue.showMore"),
    );

    expect(more).toHaveLength(1);

    await press(more[0] ?? null);

    const available = mocks.queues.available as QueueData;

    expect(available.showMore).toHaveBeenCalledTimes(1);
  });

  it("paints one section's failure with Retry and keeps the other's rows (AC-11)", async () => {
    mocks.queues.mine = queueOf([], {
      error: refusal(503, "STAFF_ROLE_UNAVAILABLE"),
    });
    mocks.queues.available = queueOf([order("order-aaaaaaaa")]);
    await renderQueue();

    expect(byId("courier-mine-section")?.textContent).toContain(
      "staff.courier.queue.failureTitle",
    );
    expect(byId("courier-order-card")).not.toBeNull();
    expect(button("staff.courier.queue.retry")).toBeDefined();

    await press(button("staff.courier.queue.retry") ?? null);

    const mine = mocks.queues.mine as QueueData;

    expect(mine.mutate).toHaveBeenCalledTimes(1);
  });

  it("shows a skeleton per section while its own read runs (AC-11)", async () => {
    mocks.queues.mine = queueOf([], { isLoading: true });
    mocks.queues.available = queueOf([order("order-aaaaaaaa")]);
    await renderQueue();

    expect(
      byId("courier-mine-section")?.querySelector(
        "[aria-label='staff.courier.queue.loading']",
      ),
    ).not.toBeNull();
  });

  it("keeps the trigger aria-disabled rather than disabled while a request runs (AC-12)", async () => {
    mocks.queues.available = queueOf([order("order-aaaaaaaa")]);
    mocks.action.pending = { orderId: "order-aaaaaaaa", action: "claim" };
    await renderQueue();

    const trigger = triggers()[0];

    expect(trigger?.getAttribute("aria-disabled")).toBe("true");
    expect(trigger?.hasAttribute("disabled")).toBe(false);
    expect(trigger?.getAttribute("aria-busy")).toBe("true");
    expect(trigger?.textContent).toBe("staff.courier.queue.claimBusy");
  });
});
