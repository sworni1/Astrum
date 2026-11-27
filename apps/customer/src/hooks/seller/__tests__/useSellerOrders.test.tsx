import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getData } = vi.hoisted(() => ({ getData: vi.fn() }));

vi.mock("@/hooks/useFetcher", () => ({ useFetcher: () => ({ getData }) }));

import { Currency } from "@/common/types/product.types";
import {
  SELLER_ORDERS_PAGE_SIZE,
  type SellerOrdersFilters,
  sellerOrdersKey,
  useSellerOrders,
} from "@/hooks/seller/useSellerOrders";

type Snapshot = {
  kind: string;
  loading: boolean;
  total?: number;
  pages?: number;
  first?: string;
  units?: number;
};

const Probe = ({ filters }: { filters: SellerOrdersFilters }) => {
  const { page, kind, isLoading } = useSellerOrders(filters);
  const snapshot: Snapshot = {
    kind,
    loading: isLoading,
    total: page?.total,
    pages: page?.totalPages,
    first: page?.items[0]?.id,
    units: page?.stats.units,
  };

  return <span data-state={JSON.stringify(snapshot)} />;
};

let container: HTMLDivElement;
let root: Root;

const read = (): Snapshot => {
  const node = container.querySelector("[data-state]");
  return JSON.parse(node?.getAttribute("data-state") ?? "{}") as Snapshot;
};

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const render = async (filters: SellerOrdersFilters): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Probe filters={filters} />
      </SWRConfig>,
    );
  });
  await flush();
};

const answer = {
  items: [
    {
      id: "line-1",
      orderId: "order-12345678",
      productId: "product-1",
      name: "Kettle",
      previewImage: "",
      quantity: 2,
      price: 19.99,
      subtotal: 39.98,
      currency: Currency.RUB,
      status: "DELIVERED",
      createdAt: "2026-11-08T10:00:00.000Z",
      isPickup: true,
      pickupPointName: null,
      pickupPointAddress: null,
      handedOverAt: null,
      deliveryAddress: null,
    },
  ],
  counts: { all: 21, delivered: 1, canceled: 0 },
  stats: { revenue: [{ currency: Currency.RUB, amount: 39.98 }], units: 2 },
  page: 1,
  limit: 20,
  total: 21,
  totalPages: 2,
};

describe("sellerOrdersKey", () => {
  it("sends the bare first page when no filter is set (AC-7, AC-8)", () => {
    expect(sellerOrdersKey()).toBe("/seller/orders?page=1&limit=20");
    expect(sellerOrdersKey({ status: "ALL" })).toBe(
      "/seller/orders?page=1&limit=20",
    );
    expect(sellerOrdersKey({ q: "   " })).toBe(
      "/seller/orders?page=1&limit=20",
    );
  });

  it("carries the chosen tab, the trimmed query and the page (AC-2)", () => {
    expect(sellerOrdersKey({ status: "CANCELED", q: " drill ", page: 2 })).toBe(
      `/seller/orders?status=CANCELED&q=drill&page=2&limit=${SELLER_ORDERS_PAGE_SIZE}`,
    );
  });
});

describe("useSellerOrders", () => {
  beforeEach(() => {
    getData.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("reads one page of 20 lines with their counts and money (AC-1, AC-10)", async () => {
    getData.mockResolvedValue(answer);

    await render({});

    expect(getData).toHaveBeenCalledWith("/seller/orders?page=1&limit=20");
    expect(read()).toMatchObject({
      kind: "none",
      total: 21,
      pages: 2,
      first: "line-1",
      units: 2,
    });
  });

  it("reads a refusal from an account without a business as not a seller (AC-11)", async () => {
    getData.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { code: "SELLER_NOT_ASSIGNED" } },
    });

    await render({});

    expect(read().kind).toBe("notSeller");
    expect(read().total).toBeUndefined();
  });

  it("treats a server fault as a failure that offers a retry (AC-11)", async () => {
    getData.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: {} },
    });

    await render({});

    expect(read().kind).toBe("failure");
  });
});
