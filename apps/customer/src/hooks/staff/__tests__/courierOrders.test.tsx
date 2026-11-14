import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetcher = vi.hoisted(() => ({
  getData: vi.fn(),
  postItem: vi.fn(),
  deleteItem: vi.fn(),
  patchItem: vi.fn(),
}));

vi.mock("@/hooks/useFetcher", () => ({ useFetcher: () => fetcher }));

import { Currency } from "@/common/types/product.types";
import type { CourierOrder } from "@/hooks/staff/courierOrder.types";
import { useCourierOrderAction } from "@/hooks/staff/useCourierOrderAction";
import { useCourierOrders } from "@/hooks/staff/useCourierOrders";

const order = (id: string): CourierOrder => ({
  id,
  createdAt: "2026-11-14T08:30:00.000Z",
  status: "SHIPPED",
  paymentStatus: "PENDING",
  paymentMethod: "CASH",
  handedOverAt: null,
  grandTotal: 119.98,
  currency: Currency.RUB,
  courierUserId: null,
  deliveryDate: "2026-11-16T09:00:00.000Z",
  deliveryAddress: null,
  orderItems: [],
});

const pageOf = (page: number, ids: string[], totalPages: number) => ({
  orders: ids.map(order),
  page,
  limit: 20,
  total: ids.length,
  totalPages,
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

const renderProbe = async (probe: React.ReactNode): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(probe);
  });
  await flush();
};

const byTestId = (id: string): HTMLElement | null =>
  container.querySelector(`[data-testid='${id}']`);

const textOf = (id: string): string => byTestId(id)?.textContent ?? "";

const OrdersProbe = ({ scope }: { scope: "mine" | "available" }) => {
  const { orders, page, totalPages, isLoading, error, showMore, mutate } =
    useCourierOrders(scope);

  return (
    <div>
      <span data-testid="ids">{orders.map((entry) => entry.id).join(",")}</span>
      <span data-testid="page">{page}</span>
      <span data-testid="totalPages">{totalPages}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error ? "yes" : "no"}</span>
      <button data-testid="more" onClick={showMore}>
        more
      </button>
      <button data-testid="mutate" onClick={() => void mutate()}>
        mutate
      </button>
    </div>
  );
};

describe("useCourierOrders", () => {
  beforeEach(() => {
    fetcher.getData.mockReset();
    fetcher.getData.mockImplementation(async (url: string) =>
      url.includes("page=2") ? pageOf(2, ["b"], 2) : pageOf(1, ["a"], 2),
    );
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("reads the first page of the asked scope (AC-10)", async () => {
    await renderProbe(<OrdersProbe scope="available" />);

    expect(fetcher.getData).toHaveBeenCalledWith(
      "/staff/courier/orders?scope=available&page=1&limit=20",
    );
    expect(textOf("ids")).toBe("a");
    expect(textOf("page")).toBe("1");
    expect(textOf("loading")).toBe("false");
  });

  it("names the mine scope on its own read (AC-10)", async () => {
    await renderProbe(<OrdersProbe scope="mine" />);

    expect(fetcher.getData).toHaveBeenCalledWith(
      "/staff/courier/orders?scope=mine&page=1&limit=20",
    );
  });

  it("appends the next page when Show more is pressed (AC-10)", async () => {
    await renderProbe(<OrdersProbe scope="mine" />);

    await act(async () => byTestId("more")?.click());
    await flush();

    expect(fetcher.getData).toHaveBeenLastCalledWith(
      "/staff/courier/orders?scope=mine&page=2&limit=20",
    );
    expect(textOf("ids")).toBe("a,b");
  });

  it("drops every accumulated page and re-reads the first one on mutate (AC-10)", async () => {
    await renderProbe(<OrdersProbe scope="mine" />);

    await act(async () => byTestId("more")?.click());
    await flush();
    expect(textOf("ids")).toBe("a,b");

    await act(async () => byTestId("mutate")?.click());
    await flush();

    expect(fetcher.getData).toHaveBeenLastCalledWith(
      "/staff/courier/orders?scope=mine&page=1&limit=20",
    );
    expect(textOf("ids")).toBe("a");
    expect(textOf("page")).toBe("1");
  });

  it("keeps a refusal on the hook for the screen to paint (AC-14)", async () => {
    fetcher.getData.mockRejectedValue(refusal(403, "NOT_COURIER"));

    await renderProbe(<OrdersProbe scope="available" />);

    expect(textOf("error")).toBe("yes");
    expect(textOf("ids")).toBe("");
  });

  it("treats a dropped answer as a failure too (AC-14)", async () => {
    fetcher.getData.mockRejectedValue({
      isAxiosError: true,
      response: undefined,
    });

    await renderProbe(<OrdersProbe scope="available" />);

    expect(textOf("error")).toBe("yes");
    expect(textOf("loading")).toBe("false");
  });
});

const ActionProbe = ({ orderId }: { orderId: string }) => {
  const { run, pending } = useCourierOrderAction();
  const [log, setLog] = useState("idle");

  const send = (action: "claim" | "release" | "handover" | "cancel"): void => {
    void run(orderId, action).then(
      (answer) => setLog(answer ? `ok:${answer.id}` : "null"),
      (error: unknown) =>
        setLog(
          `refused:${
            (error as { response?: { data?: { code?: string } } }).response
              ?.data?.code ?? "none"
          }`,
        ),
    );
  };

  return (
    <div>
      <span data-testid="pending">
        {pending ? `${pending.orderId}:${pending.action}` : "none"}
      </span>
      <span data-testid="log">{log}</span>
      <button data-testid="claim" onClick={() => send("claim")}>
        claim
      </button>
      <button data-testid="release" onClick={() => send("release")}>
        release
      </button>
      <button data-testid="handover" onClick={() => send("handover")}>
        handover
      </button>
      <button data-testid="cancel" onClick={() => send("cancel")}>
        cancel
      </button>
    </div>
  );
};

describe("useCourierOrderAction", () => {
  beforeEach(() => {
    fetcher.postItem.mockReset();
    fetcher.deleteItem.mockReset();
    fetcher.patchItem.mockReset();
    fetcher.postItem.mockResolvedValue({ order: order("order-1") });
    fetcher.deleteItem.mockResolvedValue({ order: order("order-1") });
    fetcher.patchItem.mockResolvedValue({ order: order("order-1") });
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("claims with a POST and no body (AC-10)", async () => {
    await renderProbe(<ActionProbe orderId="order-1" />);

    await act(async () => byTestId("claim")?.click());
    await flush();

    expect(fetcher.postItem).toHaveBeenCalledWith(
      "/staff/courier/orders/order-1/claim",
      { arg: {} },
    );
    expect(textOf("log")).toBe("ok:order-1");
    expect(textOf("pending")).toBe("none");
  });

  it("releases with a DELETE on a bare url (AC-10)", async () => {
    await renderProbe(<ActionProbe orderId="order-1" />);

    await act(async () => byTestId("release")?.click());
    await flush();

    expect(fetcher.deleteItem).toHaveBeenCalledWith(
      "/staff/courier/orders/order-1/claim",
    );
    expect(textOf("log")).toBe("ok:order-1");
  });

  it("hands over and cancels with a PATCH (AC-10)", async () => {
    await renderProbe(<ActionProbe orderId="order-1" />);

    await act(async () => byTestId("handover")?.click());
    await flush();
    await act(async () => byTestId("cancel")?.click());
    await flush();

    expect(fetcher.patchItem).toHaveBeenCalledWith(
      "/staff/courier/orders/order-1/handover",
      { arg: {} },
    );
    expect(fetcher.patchItem).toHaveBeenCalledWith(
      "/staff/courier/orders/order-1/cancel",
      { arg: {} },
    );
  });

  it("returns before a second send while one is in flight (AC-10)", async () => {
    let release: (value: unknown) => void = () => undefined;
    fetcher.patchItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    await renderProbe(<ActionProbe orderId="order-1" />);

    await act(async () => byTestId("handover")?.click());
    await act(async () => byTestId("cancel")?.click());

    expect(fetcher.patchItem).toHaveBeenCalledTimes(1);
    expect(textOf("pending")).toBe("order-1:handover");

    await act(async () => release({ order: order("order-1") }));
    await flush();

    expect(textOf("pending")).toBe("none");
  });

  it("surfaces the refusal code to the caller (AC-14)", async () => {
    fetcher.patchItem.mockRejectedValue(refusal(409, "ALREADY_HANDED_OVER"));

    await renderProbe(<ActionProbe orderId="order-1" />);

    await act(async () => byTestId("handover")?.click());
    await flush();

    expect(textOf("log")).toBe("refused:ALREADY_HANDED_OVER");
    expect(textOf("pending")).toBe("none");
  });
});
