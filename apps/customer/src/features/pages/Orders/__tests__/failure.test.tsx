import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import Orders from "@/features/pages/Orders";

const { useGetOrders } = vi.hoisted(() => ({ useGetOrders: vi.fn() }));

vi.mock("@/hooks/order/useGetOrders", () => ({ useGetOrders }));

vi.mock("next-intl", () => ({
  useTranslations:
    () =>
    (key: string): string =>
      key,
  useFormatter: () => ({ dateTime: () => "DATE" }),
  useLocale: () => "ru",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({ default: () => <span data-image="" /> }));
vi.mock("@/common/helpers/showToast", () => ({ showToast: vi.fn() }));

import { showToast } from "@/common/helpers/showToast";

describe("A failed orders read", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("raises one toast, and no second one when the screen renders again (AC-13)", async () => {
    const error = { message: "orders are down" };

    useGetOrders.mockReturnValue({
      page: undefined,
      isLoading: false,
      isValidating: false,
      error,
      mutate: vi.fn(),
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<Orders />);
    });

    expect(showToast).toHaveBeenCalledTimes(1);

    const tab = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')[2];

    await act(async () => {
      tab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({ title: "failed", type: "error" });
  });
});
