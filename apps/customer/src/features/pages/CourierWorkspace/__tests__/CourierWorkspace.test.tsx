import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  courier: {
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
  scopes: [] as string[],
}));

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) =>
    (key: string): string =>
      `${namespace}.${key}`,
  useFormatter: () => ({
    dateTime: (): string => "14 Nov 2026, 11:30",
  }),
  createTranslator: () => (key: string): string => key,
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

vi.mock("@/hooks/staff/useStaffCourier", () => ({
  useStaffCourier: () => mocks.courier,
}));

vi.mock("@/hooks/staff/useCourierOrderAction", () => ({
  useCourierOrderAction: () => ({ run: vi.fn(), pending: null }),
}));

vi.mock("@/hooks/staff/useCourierOrders", () => ({
  useCourierOrders: (scope: string) => {
    mocks.scopes.push(scope);
    return mocks.queue;
  },
}));

import CourierWorkspace from "@/features/pages/CourierWorkspace";

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
    root.render(<CourierWorkspace />);
  });
  await flush();
};

const text = (): string => container.textContent ?? "";

describe("CourierWorkspace", () => {
  beforeEach(() => {
    mocks.courier.isLoading = false;
    mocks.courier.error = null;
    mocks.courier.mutate.mockReset();
    mocks.courier.mutate.mockResolvedValue(undefined);

    mocks.queue.orders = [];
    mocks.queue.page = 1;
    mocks.queue.totalPages = 0;
    mocks.queue.total = 0;
    mocks.queue.isLoading = false;
    mocks.queue.isValidating = false;
    mocks.queue.error = null;
    mocks.scopes = [];
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("shows a skeleton while the read is in flight (AC-11)", async () => {
    mocks.courier.isLoading = true;
    await renderPage();

    expect(
      container.querySelector("[aria-label='staff.loading']"),
    ).not.toBeNull();
  });

  it("shows the courier job and both queues, and no point (AC-11)", async () => {
    mocks.courier.staffRoles = ["COURIER"];
    await renderPage();

    expect(text()).toContain("staff.courier.title");
    expect(text()).toContain("staff.courier.queue.mineTitle");
    expect(text()).toContain("staff.courier.queue.availableTitle");
    expect(mocks.scopes).toEqual(["mine", "available"]);
    expect(container.querySelector("[data-testid='point-name']")).toBeNull();
  });

  it("shows the no role screen with the way to the staff page (AC-11)", async () => {
    mocks.courier.error = refusal(403, "NOT_COURIER");
    await renderPage();

    expect(text()).toContain("staff.courier.noRoleTitle");
    expect(
      container.querySelector("a[href='/staff/onboarding']")?.textContent,
    ).toBe("staff.courier.noRoleAction");
  });

  it("shows the failure screen and retries the read (AC-11)", async () => {
    mocks.courier.error = refusal(500, "INTERNAL_SERVER_ERROR");
    await renderPage();

    expect(text()).toContain("staff.courier.failureTitle");

    const retry = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent?.includes("staff.retry"),
    );

    await act(async () => retry?.click());

    expect(mocks.courier.mutate).toHaveBeenCalledTimes(1);
  });

  it("paints nothing for a 401 (AC-11)", async () => {
    mocks.courier.error = refusal(401, "SESSION_REVOKED");
    await renderPage();

    expect(text()).toBe("");
  });
});
