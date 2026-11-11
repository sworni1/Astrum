import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WriteReviewDialog from ".";

const mocks = vi.hoisted(() => ({ trigger: vi.fn() }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/common/helpers/showToast", () => ({ showToast: vi.fn() }));

vi.mock("@/hooks/review/useCreateReview", () => ({
  useCreateReview: () => ({
    createReviewTrigger: mocks.trigger,
    isCreatingReview: false,
    revalidateReviewData: async () => undefined,
  }),
}));

vi.mock("@/components/ui/dialog", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    Dialog: Pass,
    DialogTrigger: Pass,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
    DialogFooter: Pass,
  };
});

const setText = (element: HTMLTextAreaElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;

  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("WriteReviewDialog", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mocks.trigger.mockReset();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
  });

  const mount = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<WriteReviewDialog productId="product-1" orderItemId="line-1" />);
    });

    return {
      form: container.querySelector("form") as HTMLFormElement,
      comment: container.querySelector("textarea") as HTMLTextAreaElement,
      submit: Array.from(container.querySelectorAll("button")).find(
        (button) => button.type === "submit",
      ) as HTMLButtonElement,
      stars: Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="radio"][value="5"]'),
      ),
    };
  };

  const press = async (form: HTMLFormElement) => {
    await act(async () => {
      form.requestSubmit();
      await Promise.resolve();
    });
  };

  it("sends nothing while a rating is missing and shows the message (AC-8)", async () => {
    const { comment, form } = await mount();

    await act(async () => setText(comment, "solid drill"));
    await press(form);

    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(container.textContent).toContain("ratingRequired");
  });

  it("sends nothing while the comment fails and shows its message (AC-8)", async () => {
    const { comment, form, stars } = await mount();

    await act(async () => {
      stars.forEach((star) => star.click());
      setText(comment, "ab");
    });
    await press(form);

    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(container.textContent).toContain("commentTooShort");
  });

  it("sends the whole review once, with the order line from the product answer (AC-8)", async () => {
    mocks.trigger.mockResolvedValue({ id: "review-1" });
    const { comment, form, stars } = await mount();

    await act(async () => {
      stars.forEach((star) => star.click());
      setText(comment, "solid drill");
    });
    await press(form);

    expect(mocks.trigger).toHaveBeenCalledTimes(1);
    expect(mocks.trigger).toHaveBeenCalledWith({
      orderItemId: "line-1",
      rating: 5,
      qualityRating: 5,
      deliveryRating: 5,
      accuracyRating: 5,
      comment: "solid drill",
    });
  });

  it("sends no second request while the first one is in flight (AC-8)", async () => {
    mocks.trigger.mockImplementation(() => new Promise(() => undefined));
    const { comment, form, stars } = await mount();

    await act(async () => {
      stars.forEach((star) => star.click());
      setText(comment, "solid drill");
    });
    await press(form);
    await press(form);

    expect(mocks.trigger).toHaveBeenCalledTimes(1);
  });
});
