import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { patchItem } = vi.hoisted(() => ({ patchItem: vi.fn() }));

vi.mock("@/hooks/useFetcher", () => ({ useFetcher: () => ({ patchItem }) }));

import {
  OrderItemStatus,
  type SellerOrderLine,
} from "@/common/types/order.types";
import { sellerErrorCode } from "@/hooks/seller/sellerError";
import { useSellerOrderItemStatus } from "@/hooks/seller/useSellerOrderItemStatus";

const onUpdated = vi.fn();

const Probe = ({ id, action }: { id: string; action: OrderItemStatus }) => {
  const { changeStatus, error } = useSellerOrderItemStatus(id, onUpdated);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void changeStatus({ status: action }).catch(() => undefined);
        }}
      >
        change
      </button>
      <span data-error={sellerErrorCode(error) ?? ""} />
    </>
  );
};

const line: SellerOrderLine = {
  id: "line-1",
  productId: "product-1",
  name: "Kettle",
  previewImage: "",
  quantity: 2,
  price: 10,
  currency: "RUB" as SellerOrderLine["currency"],
  status: OrderItemStatus.CONFIRMED,
};

let container: HTMLDivElement;
let root: Root;

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const render = async (
  id: string,
  action: OrderItemStatus,
): Promise<HTMLButtonElement> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<Probe id={id} action={action} />);
  });

  return container.querySelector("button") as HTMLButtonElement;
};

const click = async (button: HTMLButtonElement): Promise<void> => {
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await flush();
};

describe("useSellerOrderItemStatus", () => {
  beforeEach(() => {
    patchItem.mockReset();
    onUpdated.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("writes the answered line into the page (AC-9, AC-15)", async () => {
    patchItem.mockResolvedValue(line);
    const button = await render("line-1", OrderItemStatus.CONFIRMED);

    await click(button);

    expect(patchItem).toHaveBeenCalledWith("/order-items/line-1/status", {
      arg: { status: OrderItemStatus.CONFIRMED },
    });
    expect(onUpdated).toHaveBeenCalledWith(line);
  });

  it("surfaces the code of a refused change (AC-10, AC-15)", async () => {
    patchItem.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: "INVALID_STATUS_TRANSITION",
          from: "SHIPPED",
          to: "CANCELLED",
        },
      },
    });
    const button = await render("line-1", OrderItemStatus.CANCELLED);

    await click(button);

    expect(
      container.querySelector("[data-error]")?.getAttribute("data-error"),
    ).toBe("INVALID_STATUS_TRANSITION");
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
