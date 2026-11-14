import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCancelOrder } from "@/features/pages/Orders/OrderPage/hooks/useCancelOrder";

const { trigger, revalidate, showToast, state } = vi.hoisted(() => ({
  trigger: vi.fn(),
  revalidate: vi.fn(),
  showToast: vi.fn(),
  state: { mutating: false },
}));

vi.mock("@/hooks/order/useUpdateOrderStatus", () => ({
  useUpdateOrderStatus: () => ({
    updateOrderStatusTrigger: trigger,
    updateOrderStatusIsMutating: state.mutating,
    updateOrderStatusError: null,
    revalidateOrder: revalidate,
  }),
}));

vi.mock("@/common/helpers/showToast", () => ({ showToast }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));

const Probe = ({ orderId }: { orderId: string }) => {
  const { cancel } = useCancelOrder(orderId);

  return (
    <button type="button" onClick={() => void cancel()}>
      cancel
    </button>
  );
};

const shippedRefusal = {
  isAxiosError: true,
  response: {
    status: 409,
    data: {
      code: "INVALID_STATUS_TRANSITION",
      message: "An order with a SHIPPED line can no longer be cancelled.",
      from: "SHIPPED",
      to: "CANCELED",
    },
  },
};

let container: HTMLDivElement;
let root: Root;

const render = async (orderId: string): Promise<HTMLButtonElement> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<Probe orderId={orderId} />);
  });

  return container.querySelector("button") as HTMLButtonElement;
};

const click = async (button: HTMLButtonElement): Promise<void> => {
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe("useCancelOrder", () => {
  beforeEach(() => {
    trigger.mockReset();
    revalidate.mockReset();
    showToast.mockReset();
    state.mutating = false;
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("reports the cancelled order", async () => {
    trigger.mockResolvedValue({});
    const button = await render("order-1");

    await click(button);

    expect(trigger).toHaveBeenCalledWith({ status: "CANCELED" });
    expect(showToast).toHaveBeenCalledWith({
      title: "cancelSuccess",
      type: "success",
    });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("names the line status that blocks the cancel and re reads the order (spec 0011, AC-6)", async () => {
    trigger.mockRejectedValue(shippedRefusal);
    const button = await render("order-1");

    await click(button);

    expect(showToast).toHaveBeenCalledWith({
      title: "cancelBlockedByLine:itemStatus.shipped",
      type: "error",
    });
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("keeps the generic failure for an answer carrying an error", async () => {
    trigger.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { code: "ORDER_NOT_FOUND" } },
    });
    const button = await render("order-1");

    await click(button);

    expect(showToast).toHaveBeenCalledWith({
      title: "cancelFailed",
      type: "error",
    });
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("says the result is unknown when no answer arrived, and still re reads", async () => {
    trigger.mockRejectedValue(new Error("network down"));
    const button = await render("order-1");

    await click(button);

    expect(showToast).toHaveBeenCalledWith({
      title: "cancelUnconfirmed",
      type: "error",
    });
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("sends nothing on a second press while the request runs", async () => {
    state.mutating = true;
    const button = await render("order-1");

    await click(button);

    expect(trigger).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
