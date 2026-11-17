import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  screen: {} as Record<string, unknown>,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values === undefined ? key : `${key} ${JSON.stringify(values)}`,
  useFormatter: () => ({ dateTime: () => "DATE" }),
  useLocale: () => "ru",
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/features/pages/SellerOrders/hooks/useSalesFilters", () => ({
  useSalesFilters: () => mocks.screen,
}));

import SellerOrders from "@/features/pages/SellerOrders";

let container: HTMLDivElement;
let root: Root;

const page = {
  items: [],
  counts: { all: 0, delivered: 0, canceled: 0 },
  stats: { revenue: [], units: 0 },
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
};

const baseScreen = () => ({
  status: "ALL",
  selectStatus: vi.fn(),
  inputValue: "",
  setInputValue: vi.fn(),
  debouncedQuery: "",
  setPageNumber: vi.fn(),
  page,
  counts: page.counts,
  stats: page.stats,
  kind: "none",
  isLoading: false,
  isValidating: false,
  firstLoad: false,
  failed: false,
  empty: "none",
  retry: vi.fn(),
});

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const render = async (): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<SellerOrders />);
  });
  await flush();
};

const text = (): string => container.textContent ?? "";

describe("SellerOrders states", () => {
  beforeEach(() => {
    mocks.screen = baseScreen();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("shows the heading, tiles and rows skeletons on the first load (AC-11)", async () => {
    mocks.screen = { ...baseScreen(), firstLoad: true, page: undefined };

    await render();

    expect(
      container.querySelector('[aria-label="states.loadingLabel"]'),
    ).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();
    expect(text()).not.toContain("states.emptyTitle");
    expect(text()).not.toContain("states.failureTitle");
  });

  it("shows the no lines state when the shop owns nothing (AC-11)", async () => {
    mocks.screen = { ...baseScreen(), empty: "noLines" };

    await render();

    expect(text()).toContain("states.emptyTitle");
    expect(text()).toContain("states.emptyText");
    expect(text()).not.toContain("pagination.pageOf");
  });

  it("keeps the search visible and names the query when nothing matches (AC-11)", async () => {
    mocks.screen = {
      ...baseScreen(),
      empty: "noResults",
      debouncedQuery: "drill",
      inputValue: "drill",
      counts: { all: 4, delivered: 4, canceled: 0 },
    };

    await render();

    expect(text()).toContain("emptySearchTitle");
    expect(text()).toContain('emptySearchText {"query":"drill"}');
    expect(container.querySelector('input[type="search"]')).not.toBeNull();
  });

  it("shows the empty tab state when the chosen tab holds nothing (AC-11)", async () => {
    mocks.screen = {
      ...baseScreen(),
      empty: "emptyTab",
      status: "CANCELED",
      counts: { all: 4, delivered: 0, canceled: 0 },
    };

    await render();

    expect(text()).toContain("emptyTabTitle");
    expect(text()).toContain("emptyTabText");
  });

  it("renders the failure block with a retry and no empty state (AC-11)", async () => {
    const retry = vi.fn();

    mocks.screen = { ...baseScreen(), failed: true, retry };

    await render();

    expect(text()).toContain("states.failureTitle");
    expect(text()).toContain("states.failureText");
    expect(text()).not.toContain("states.emptyTitle");

    const button = container.querySelector("button:not([role])") as HTMLButtonElement;

    await act(async () => button.click());
    await flush();

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("offers the onboarding page to an account that does not sell (AC-11)", async () => {
    mocks.screen = { ...baseScreen(), kind: "notSeller", page: undefined };

    await render();

    const link = container.querySelector("a[href='/seller/onboarding']");

    expect(text()).toContain("states.notSellerTitle");
    expect(link?.textContent).toBe("states.notSellerAction");
  });
});
