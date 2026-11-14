import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewStateStatus, type ReviewState } from "@/common/types/review.types";
import ReviewWriteAction from "@/features/pages/ProductOverview/Reviews/components/ReviewWriteAction";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/review/useCreateReview", () => ({
  useCreateReview: () => ({
    createReviewTrigger: vi.fn(),
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

describe("ReviewWriteAction", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
  });

  const render = async (reviewState: ReviewState | null) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <ReviewWriteAction productId="product-1" reviewState={reviewState} />,
      );
    });

    return container.textContent ?? "";
  };

  it("renders the write control for a delivered line (AC-7)", async () => {
    const text = await render({
      status: ReviewStateStatus.ELIGIBLE,
      orderItemId: "line-1",
    });

    expect(text).toContain("writeReview");
  });

  it("explains that a review needs a delivered order (AC-7)", async () => {
    const text = await render({
      status: ReviewStateStatus.NOT_PURCHASED,
      orderItemId: null,
    });

    expect(text).toContain("onlyAfterDelivery");
    expect(text).not.toContain("writeReview");
  });

  it("explains that the review is already written (AC-7)", async () => {
    const text = await render({
      status: ReviewStateStatus.ALREADY_REVIEWED,
      orderItemId: null,
    });

    expect(text).toContain("alreadyReviewed");
    expect(text).not.toContain("writeReview");
  });

  it("renders nothing for a state the client does not know (AC-7)", async () => {
    const text = await render({
      status: "SOMETHING_NEW" as ReviewStateStatus,
      orderItemId: null,
    });

    expect(text).toBe("");
  });

  it("renders nothing before the product answer arrives (AC-7)", async () => {
    expect(await render(null)).toBe("");
  });
});
