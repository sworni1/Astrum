import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  change: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
  translate: (key: string) => key,
}));

vi.mock("next-intl", () => ({ useTranslations: () => mocks.translate }));

vi.mock("@/common/helpers/showToast", () => ({ showToast: mocks.toast }));

vi.mock("@/hooks/product/useCart/useAddProductToCart", () => ({
  useAddProductToCart: () => ({
    addProductToCartTrigger: mocks.add,
    addProductToCartLoading: false,
    addProductToCartError: null,
  }),
}));

vi.mock("@/hooks/product/useCart/useChangeProductCartQuantity", () => ({
  useChangeProductCartQuantity: () => ({
    changeProductCartQuantityTrigger: mocks.change,
    changeProductCartQuantityLoading: false,
    changeProductCartQuantityError: null,
  }),
}));

vi.mock("@/hooks/product/useCart/useDeleteProductFromCart", () => ({
  useDeleteProductFromCart: () => ({
    deleteProductFromCartTrigger: mocks.remove,
    deleteProductFromCartLoading: false,
    deleteProductFromCartError: null,
  }),
}));

import AddToCartWithQuantity from "@/features/general/AddToCartWithQuantity";

type Props = {
  quantityInCart: number;
  quantity?: number;
  size?: "full" | "sm";
  allowAdd?: boolean;
  isOutOfStock?: boolean;
};

const PRODUCT_ID = "product-1";

describe("AddToCartWithQuantity", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mocks.add.mockReset().mockResolvedValue({ quantityInCart: 1 });
    mocks.change.mockReset();
    mocks.remove.mockReset().mockResolvedValue(undefined);
    mocks.toast.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
  });

  const render = async ({
    quantityInCart,
    quantity = 5,
    size,
    allowAdd,
    isOutOfStock = false,
  }: Props) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <AddToCartWithQuantity
          productId={PRODUCT_ID}
          quantity={quantity}
          quantityInCart={quantityInCart}
          isOutOfStock={isOutOfStock}
          size={size}
          allowAdd={allowAdd}
        />,
      );
    });
  };

  const buttons = (): HTMLButtonElement[] => [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ];

  const click = async (button: HTMLButtonElement) => {
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  it("adds the first unit from the shop card", async () => {
    await render({ quantityInCart: 0 });

    expect(buttons()).toHaveLength(1);
    expect(container.textContent).toBe("addToCart");

    await click(buttons()[0]);

    expect(mocks.add).toHaveBeenCalledWith({ productId: PRODUCT_ID });
    expect(container.textContent).toBe("1");
    expect(buttons()).toHaveLength(2);
  });

  it("raises the count by one through the same server call", async () => {
    mocks.change.mockResolvedValue({ quantityInCart: 3 });
    await render({ quantityInCart: 2, quantity: 5 });

    expect(container.textContent).toBe("2");

    await click(buttons()[1]);

    expect(mocks.change).toHaveBeenCalledWith({ quantity: 3 });
    expect(container.textContent).toBe("3");
  });

  it("drops the line when the last unit goes", async () => {
    await render({ quantityInCart: 1, quantity: 5, allowAdd: false });

    await click(buttons()[0]);

    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe("");
  });

  it("keeps the add button out of a cart line that holds nothing", async () => {
    await render({ quantityInCart: 0, allowAdd: false });

    expect(container.innerHTML).toBe("");
  });

  it("does not offer a unit the shop does not have", async () => {
    await render({ quantityInCart: 5, quantity: 5 });

    expect(buttons()[1].disabled).toBe(true);
  });

  it("reports one refusal for one failed change", async () => {
    mocks.change.mockRejectedValue(new Error("refused"));
    await render({ quantityInCart: 2, quantity: 5 });

    await click(buttons()[1]);

    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "quantityFailed",
      type: "error",
    });
    expect(container.textContent).toBe("2");
  });

  it("reports a failed add instead of leaving the card blank", async () => {
    mocks.add.mockRejectedValue(new Error("refused"));
    await render({ quantityInCart: 0 });

    await click(buttons()[0]);

    expect(mocks.toast).toHaveBeenCalledWith({
      title: "addFailed",
      type: "error",
    });
    expect(container.textContent).toBe("addToCart");
  });
});
