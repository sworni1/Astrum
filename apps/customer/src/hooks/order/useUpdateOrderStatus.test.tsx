import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@/common/types/order.types";
import { useUpdateOrderStatus } from "./useUpdateOrderStatus";

type MutationOptions = { onSuccess?: (order: Order) => Promise<void> };

const state = vi.hoisted(() => ({
  mutate: vi.fn(),
  options: undefined as MutationOptions | undefined,
}));

vi.mock("swr", () => ({
  useSWRConfig: () => ({ mutate: state.mutate }),
}));

vi.mock("swr/mutation", () => ({
  default: (_key: string, _fetcher: unknown, options: MutationOptions) => {
    state.options = options;

    return { trigger: vi.fn(), isMutating: false, error: undefined };
  },
}));

vi.mock("@/hooks/useFetcher", () => ({
  useFetcher: () => ({ patchItem: vi.fn() }),
}));

const order = { id: "order-1" } as Order;

const RevalidateButton = () => {
  const { revalidateOrder } = useUpdateOrderStatus("order-1");

  return (
    <button type="button" onClick={() => void revalidateOrder()}>
      revalidate
    </button>
  );
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const render = async (node: ReactNode): Promise<HTMLButtonElement | null> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => root.render(node));

  return container.querySelector("button");
};

const click = async (button: HTMLButtonElement | null): Promise<void> => {
  await act(async () => {
    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe("useUpdateOrderStatus", () => {
  beforeEach(() => {
    state.mutate.mockReset();
    state.options = undefined;
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("writes the answer into the detail cache, then revalidates both keys (AC-5)", async () => {
    await render(<RevalidateButton />);

    await act(async () => {
      await state.options?.onSuccess?.(order);
    });

    expect(state.mutate.mock.calls).toEqual([
      ["/orders/order-1", order, false],
      ["/orders/order-1"],
      ["/orders"],
    ]);
  });

  it("never rejects a re read, so a failed read cannot swallow the toast (AC-6)", async () => {
    state.mutate.mockRejectedValue(new Error("read failed"));
    const button = await render(<RevalidateButton />);

    await click(button);

    expect(state.mutate).toHaveBeenCalledTimes(2);
  });
});
