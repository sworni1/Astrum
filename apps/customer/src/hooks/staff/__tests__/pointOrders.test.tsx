import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetcher = vi.hoisted(() => ({
  getData: vi.fn(),
  patchItem: vi.fn(),
}));

vi.mock("@/hooks/useFetcher", () => ({ useFetcher: () => fetcher }));

import { Currency } from "@/common/types/product.types";
import type { PointOrder } from "@/hooks/staff/pointOrder.types";
import { usePointOrderAction } from "@/hooks/staff/usePointOrderAction";
import { usePointOrders } from "@/hooks/staff/usePointOrders";

const order = (id: string): PointOrder => ({
  id,
  createdAt: "2026-11-14T08:30:00.000Z",
  status: "SHIPPED",
  paymentStatus: "PENDING",
  paymentMethod: "CASH",
  handedOverAt: null,
  grandTotal: 119.98,
  currency: Currency.RUB,
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

const OrdersProbe = () => {
  const { orders, page, totalPages, isLoading, error, showMore, mutate } =
    usePointOrders();

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

describe("usePointOrders", () => {
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

  it("reads the first page of the caller's own point (AC-10)", async () => {
    await renderProbe(<OrdersProbe />);

    expect(fetcher.getData).toHaveBeenCalledWith(
      "/staff/point/orders?page=1&limit=20",
    );
    expect(textOf("ids")).toBe("a");
    expect(textOf("page")).toBe("1");
    expect(textOf("loading")).toBe("false");
  });

  it("appends the next page when Show more is pressed (AC-10)", async () => {
    await renderProbe(<OrdersProbe />);

    await act(async () => byTestId("more")?.click());
    await flush();

    expect(fetcher.getData).toHaveBeenLastCalledWith(
      "/staff/point/orders?page=2&limit=20",
    );
    expect(textOf("ids")).toBe("a,b");
  });

  it("drops every accumulated page and re-reads the first one on mutate (AC-11)", async () => {
    await renderProbe(<OrdersProbe />);

    await act(async () => byTestId("more")?.click());
    await flush();
    expect(textOf("ids")).toBe("a,b");

    await act(async () => byTestId("mutate")?.click());
    await flush();

    expect(fetcher.getData).toHaveBeenLastCalledWith(
      "/staff/point/orders?page=1&limit=20",
    );
    expect(textOf("ids")).toBe("a");
    expect(textOf("page")).toBe("1");
  });

  it("keeps the refusal on the hook for the screen to paint (AC-12)", async () => {
    fetcher.getData.mockRejectedValue(refusal(403, "NOT_POINT_WORKER"));

    await renderProbe(<OrdersProbe />);

    expect(textOf("error")).toBe("yes");
    expect(textOf("ids")).toBe("");
  });

  it("treats a dropped answer as a failure too (AC-12)", async () => {
    fetcher.getData.mockRejectedValue({
      isAxiosError: true,
      response: undefined,
    });

    await renderProbe(<OrdersProbe />);

    expect(textOf("error")).toBe("yes");
    expect(textOf("loading")).toBe("false");
  });
});

const ActionProbe = ({ orderId }: { orderId: string }) => {
  const { run, pending } = usePointOrderAction();
  const [log, setLog] = useState("idle");

  const send = (action: "handover" | "cancel"): void => {
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
      <button data-testid="handover" onClick={() => send("handover")}>
        handover
      </button>
      <button data-testid="cancel" onClick={() => send("cancel")}>
        cancel
      </button>
    </div>
  );
};

describe("usePointOrderAction", () => {
  beforeEach(() => {
    fetcher.patchItem.mockReset();
    fetcher.patchItem.mockResolvedValue({ order: order("order-1") });
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("patches the action route with no body and answers the order (AC-11)", async () => {
    await renderProbe(<ActionProbe orderId="order-1" />);

    await act(async () => byTestId("handover")?.click());
    await flush();

    expect(fetcher.patchItem).toHaveBeenCalledWith(
      "/staff/point/orders/order-1/handover",
      { arg: {} },
    );
    expect(textOf("log")).toBe("ok:order-1");
    expect(textOf("pending")).toBe("none");
  });

  it("sends the cancel through the cancel route (AC-11)", async () => {
    await renderProbe(<ActionProbe orderId="order-2" />);

    await act(async () => byTestId("cancel")?.click());
    await flush();

    expect(fetcher.patchItem).toHaveBeenCalledWith(
      "/staff/point/orders/order-2/cancel",
      { arg: {} },
    );
  });

  it("returns before a second send while one request runs (AC-11)", async () => {
    fetcher.patchItem.mockReturnValue(new Promise(() => undefined));
    await renderProbe(<ActionProbe orderId="order-1" />);

    await act(async () => byTestId("handover")?.click());
    await flush();

    expect(textOf("pending")).toBe("order-1:handover");

    await act(async () => byTestId("cancel")?.click());
    await flush();

    expect(fetcher.patchItem).toHaveBeenCalledTimes(1);
    expect(textOf("log")).toBe("null");
  });

  it("lets the refusal through for the screen to map (AC-12)", async () => {
    fetcher.patchItem.mockRejectedValue(refusal(409, "ALREADY_HANDED_OVER"));
    await renderProbe(<ActionProbe orderId="order-1" />);

    await act(async () => byTestId("handover")?.click());
    await flush();

    expect(textOf("log")).toBe("refused:ALREADY_HANDED_OVER");
    expect(textOf("pending")).toBe("none");
  });
});
