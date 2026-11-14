import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { postItem } = vi.hoisted(() => ({ postItem: vi.fn() }));

vi.mock("@/hooks/useFetcher", () => ({ useFetcher: () => ({ postItem }) }));

import { sellerErrorCode } from "@/hooks/seller/sellerError";
import { useBecomeSeller } from "@/hooks/seller/useBecomeSeller";

const Probe = () => {
  const { becomeSeller, error } = useBecomeSeller();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void becomeSeller({ name: "My Shop" }).catch(() => undefined);
        }}
      >
        open
      </button>
      <span data-error={sellerErrorCode(error) ?? ""} />
    </>
  );
};

let container: HTMLDivElement;
let root: Root;

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const render = async (): Promise<HTMLButtonElement> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<Probe />);
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

const refusal = (code: string) => ({
  isAxiosError: true,
  response: { status: 422, data: { code } },
});

describe("useBecomeSeller", () => {
  beforeEach(() => {
    postItem.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("posts one name and answers the stored shop (AC-5, AC-9)", async () => {
    const result = { isSeller: true, businessName: "My Shop" };
    postItem.mockResolvedValue(result);
    const button = await render();

    await click(button);

    expect(postItem).toHaveBeenCalledWith("/seller/onboarding", {
      arg: { name: "My Shop" },
    });
  });

  it("keeps the validation code of a 422 refusal (AC-10)", async () => {
    postItem.mockRejectedValue(refusal("VALIDATION"));
    const button = await render();

    await click(button);

    expect(
      container.querySelector("[data-error]")?.getAttribute("data-error"),
    ).toBe("VALIDATION");
  });

  it("keeps the code of a 403 refusal (AC-10)", async () => {
    postItem.mockRejectedValue(refusal("EMAIL_NOT_CONFIRMED"));
    const button = await render();

    await click(button);

    expect(
      container.querySelector("[data-error]")?.getAttribute("data-error"),
    ).toBe("EMAIL_NOT_CONFIRMED");
  });

  it("surfaces a network failure without a code (AC-10)", async () => {
    postItem.mockRejectedValue(new Error("Network Error"));
    const button = await render();

    await click(button);

    expect(
      container.querySelector("[data-error]")?.getAttribute("data-error"),
    ).toBe("");
  });
});
