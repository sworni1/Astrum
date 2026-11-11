import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCancelOrder } from "./useCancelOrder";

const { trigger, showToast } = vi.hoisted(() => ({
  trigger: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@/hooks/order/useUpdateOrderStatus", () => ({
  useUpdateOrderStatus: () => ({
    updateOrderStatusTrigger: trigger,
    updateOrderStatusIsMutating: false,
    updateOrderStatusError: null,
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
    showToast.mockReset();
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
  });

  it("names the line status that blocks the cancel (spec 0002, AC-10)", async () => {
    trigger.mockRejectedValue(shippedRefusal);
    const button = await render("order-1");

    await click(button);

    expect(showToast).toHaveBeenCalledWith({
      title: "cancelBlockedByLine:itemStatus.shipped",
      type: "error",
    });
  });

  it("keeps the generic failure for an unreadable error", async () => {
    trigger.mockRejectedValue(new Error("network down"));
    const button = await render("order-1");

    await click(button);

    expect(showToast).toHaveBeenCalledWith({
      title: "cancelFailed",
      type: "error",
    });
  });
});
