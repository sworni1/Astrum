import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  point: {
    point: null as {
      id: string;
      name: string;
      address: string;
      isActive: boolean;
    } | null,
    staffRoles: [] as string[],
    isLoading: false,
    error: null as unknown,
    mutate: vi.fn(),
  },
  queue: {
    orders: [] as unknown[],
    page: 1,
    totalPages: 0,
    total: 0,
    isLoading: false,
    isValidating: false,
    error: null as unknown,
    showMore: vi.fn(),
    mutate: vi.fn(),
  },
  action: {
    run: vi.fn(),
    pending: null as { orderId: string; action: string } | null,
  },
  toast: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "ru",
  useTranslations:
    (namespace: string) =>
    (key: string): string =>
      `${namespace}.${key}`,
  useFormatter: () => ({
    dateTime: (): string => "14 Nov 2026, 11:30",
  }),
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

vi.mock("@/hooks/staff/useStaffPoint", () => ({
  useStaffPoint: () => mocks.point,
}));

vi.mock("@/hooks/staff/usePointOrders", () => ({
  usePointOrders: () => mocks.queue,
}));

vi.mock("@/hooks/staff/usePointOrderAction", () => ({
  usePointOrderAction: () => mocks.action,
}));

vi.mock("@/common/helpers/showToast", () => ({ showToast: mocks.toast }));

import PointWorkspace from "@/features/pages/PointWorkspace";

const POINT = {
  id: "pp-1",
  name: "Central Pickup",
  address: "Tverskaya 12",
  isActive: true,
};

const order = (id: string, paid = false) => ({
  id,
  createdAt: "2026-11-14T08:30:00.000Z",
  status: "SHIPPED",
  paymentStatus: paid ? "PAID" : "PENDING",
  paymentMethod: "CASH",
  handedOverAt: null,
  grandTotal: 119.98,
  currency: "RUB",
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

const renderPage = async (): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<PointWorkspace />);
  });
  await flush();
};

const text = (): string => container.textContent ?? "";

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

describe("PointWorkspace", () => {
  beforeEach(() => {
    mocks.point.point = null;
    mocks.point.isLoading = false;
    mocks.point.error = null;
    mocks.point.mutate.mockReset();
    mocks.point.mutate.mockResolvedValue(undefined);

    mocks.queue.orders = [];
    mocks.queue.page = 1;
    mocks.queue.totalPages = 0;
    mocks.queue.total = 0;
    mocks.queue.isLoading = false;
    mocks.queue.isValidating = false;
    mocks.queue.error = null;
    mocks.queue.showMore.mockReset();
    mocks.queue.mutate.mockReset();
    mocks.queue.mutate.mockResolvedValue(undefined);

    mocks.action.run.mockReset();
    mocks.action.run.mockResolvedValue(order("order-aaaaaaaa"));
    mocks.action.pending = null;

    mocks.toast.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("shows a skeleton while the point is read (AC-10)", async () => {
    mocks.point.isLoading = true;
    await renderPage();

    expect(
      container.querySelector("[aria-label='staff.loading']"),
    ).not.toBeNull();
    expect(text()).not.toContain("staff.point.title");
  });

  it("keeps the point card and paints the queue where the placeholder stood (AC-10)", async () => {
    mocks.point.point = POINT;
    mocks.queue.orders = [order("order-aaaaaaaa")];
    mocks.queue.total = 1;
    await renderPage();

    expect(text()).toContain("staff.point.title");
    expect(text()).toContain("Central Pickup");
    expect(text()).toContain("Tverskaya 12");
    expect(text()).toContain("staff.point.queue.title");
    expect(
      container.querySelector("[data-testid='point-inactive']"),
    ).toBeNull();

    const card = byId("point-order-card");

    expect(card).not.toBeNull();
    expect(card?.textContent).toContain("orders.number");
    expect(card?.textContent).toContain("14 Nov 2026, 11:30");
    expect(card?.textContent).toContain("Drill × 2");
    expect(card?.textContent).toContain("119,98\u00A0₽");
    expect(card?.textContent).toContain("orders.itemStatus.shipped");
  });

  it("names no parcel at a point with an empty queue and keeps the refresh control (AC-10)", async () => {
    mocks.point.point = POINT;
    await renderPage();

    expect(byId("point-queue-empty")?.textContent).toBe(
      "staff.point.queue.empty",
    );
    expect(button("staff.point.queue.refresh")).toBeDefined();
    expect(byId("point-order-card")).toBeNull();
    expect(byId("point-queue-heading")).not.toBeNull();
  });

  it("shows Show more while another page waits and reads it when pressed (AC-10)", async () => {
    mocks.point.point = POINT;
    mocks.queue.orders = [order("order-aaaaaaaa")];
    mocks.queue.totalPages = 2;
    await renderPage();

    const more = button("staff.point.queue.showMore");

    expect(more).toBeDefined();

    await press(more ?? null);

    expect(mocks.queue.showMore).toHaveBeenCalledTimes(1);
  });

  it("hides Show more on the last page (AC-10)", async () => {
    mocks.point.point = POINT;
    mocks.queue.orders = [order("order-aaaaaaaa")];
    mocks.queue.totalPages = 1;
    await renderPage();

    expect(button("staff.point.queue.showMore")).toBeUndefined();
  });

  it("paints the failure screen and retries the queue read (AC-10)", async () => {
    mocks.point.point = POINT;
    mocks.queue.error = refusal(503, "STAFF_ROLE_UNAVAILABLE");
    await renderPage();

    expect(text()).toContain("staff.point.queue.failureTitle");

    await press(button("staff.point.queue.retry") ?? null);

    expect(mocks.queue.mutate).toHaveBeenCalledTimes(1);
  });

  it("keeps the banner and disables both controls on a switched off point (AC-10)", async () => {
    mocks.point.point = { ...POINT, isActive: false };
    mocks.queue.orders = [order("order-aaaaaaaa")];
    mocks.queue.total = 1;
    await renderPage();

    expect(byId("point-inactive")).not.toBeNull();

    const controls = Array.from(
      container.querySelectorAll('[data-slot="alert-dialog-trigger"]'),
    );

    expect(controls).toHaveLength(2);
    expect(controls.every((element) => element.hasAttribute("disabled"))).toBe(
      true,
    );
  });

  it("sends nothing until the confirm control of a dialog is pressed (AC-11)", async () => {
    mocks.point.point = POINT;
    mocks.queue.orders = [order("order-aaaaaaaa")];
    await renderPage();

    await press(container.querySelector('[data-slot="alert-dialog-trigger"]'));

    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(mocks.action.run).not.toHaveBeenCalled();

    await press(document.querySelector('[data-slot="alert-dialog-action"]'));

    expect(mocks.action.run).toHaveBeenCalledWith("order-aaaaaaaa", "handover");
  });

  it("closes the row, re-reads the list and moves the focus to the heading (AC-11, AC-14)", async () => {
    mocks.point.point = POINT;
    mocks.queue.orders = [order("order-aaaaaaaa")];
    // The closed order leaves the list on the re-read, so its card unmounts.
    mocks.queue.mutate.mockImplementation(async () => {
      mocks.queue.orders = [];
    });
    await renderPage();

    await press(container.querySelector('[data-slot="alert-dialog-trigger"]'));
    await press(document.querySelector('[data-slot="alert-dialog-action"]'));
    await flush();

    expect(mocks.queue.mutate).toHaveBeenCalled();
    expect(document.activeElement).toBe(byId("point-queue-heading"));
    expect(byId("point-queue-live")?.textContent).toBe(
      "staff.point.queue.successHandover",
    );
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "staff.point.queue.successHandover",
      type: "success",
    });
  });

  it("opens the cancel dialog with the money sentence on a paid order (AC-11)", async () => {
    mocks.point.point = POINT;
    mocks.queue.orders = [order("order-bbbbbbbb", true)];
    await renderPage();

    const triggers = Array.from(
      container.querySelectorAll('[data-slot="alert-dialog-trigger"]'),
    );

    await press(triggers[1] ?? null);

    const dialog = document.querySelector('[role="alertdialog"]');

    expect(dialog?.textContent).toContain("staff.point.queue.cancelTitle");
    expect(dialog?.textContent).toContain("staff.point.queue.cancelPaidText");
  });

  it("shows the no role screen with the way to the staff page (AC-10)", async () => {
    mocks.point.error = refusal(403, "NOT_POINT_WORKER");
    await renderPage();

    expect(text()).toContain("staff.point.noRoleTitle");
    expect(
      container.querySelector("a[href='/staff/onboarding']")?.textContent,
    ).toBe("staff.point.noRoleAction");
  });

  it("paints nothing for a 401, because the fetcher ends the session (AC-10)", async () => {
    mocks.point.error = refusal(401, "SESSION_REVOKED");
    await renderPage();

    expect(text()).toBe("");
  });
});
