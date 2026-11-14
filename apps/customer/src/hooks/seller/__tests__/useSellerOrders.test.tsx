import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getData } = vi.hoisted(() => ({ getData: vi.fn() }));

vi.mock("@/hooks/useFetcher", () => ({ useFetcher: () => ({ getData }) }));

import { useSellerOrders } from "@/hooks/seller/useSellerOrders";

type Snapshot = {
  kind: string;
  loading: boolean;
  total?: number;
  pages?: number;
  first?: string;
};

const Probe = ({ page }: { page: number }) => {
  const { data, kind, isLoading } = useSellerOrders(page);
  const snapshot: Snapshot = {
    kind,
    loading: isLoading,
    total: data?.total,
    pages: data?.totalPages,
    first: data?.orders[0]?.id,
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

const render = async (page: number): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Probe page={page} />
      </SWRConfig>,
    );
  });
  await flush();
};

const page = {
  orders: [
    { id: "order-1", createdAt: "2026-11-08T10:00:00.000Z", orderItems: [] },
  ],
  page: 1,
  limit: 20,
  total: 21,
  totalPages: 2,
};

describe("useSellerOrders", () => {
  beforeEach(() => {
    getData.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("reads one page of 20 lines grouped by order (AC-4, AC-5, AC-15)", async () => {
    getData.mockResolvedValue(page);

    await render(1);

    expect(getData).toHaveBeenCalledWith("/seller/orders?page=1&limit=20");
    expect(read()).toMatchObject({
      kind: "none",
      total: 21,
      pages: 2,
      first: "order-1",
    });
  });

  it("reads a refusal from an account without a business as not a seller (AC-11, AC-15)", async () => {
    getData.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { code: "SELLER_NOT_ASSIGNED" } },
    });

    await render(1);

    expect(read().kind).toBe("notSeller");
    expect(read().total).toBeUndefined();
  });

  it("treats a server fault as a failure that offers a retry (AC-11)", async () => {
    getData.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: {} },
    });

    await render(1);

    expect(read().kind).toBe("failure");
  });
});
