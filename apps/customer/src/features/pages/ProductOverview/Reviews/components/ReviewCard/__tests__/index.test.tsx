import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductReview } from "@/common/types/review.types";
import { showToast } from "@/common/helpers/showToast";
import { useReviewLikes } from "@/hooks/review/useReviewLikes";
import ReviewCard from "@/features/pages/ProductOverview/Reviews/components/ReviewCard";
import { useReviewCounts } from "@/features/pages/ProductOverview/Reviews/hooks/useReviewCounts";

const mocks = vi.hoisted(() => ({
  getData: vi.fn(),
  putItem: vi.fn(),
  deleteItem: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => "12 November 2026" }),
}));

vi.mock("@/common/helpers/showToast", () => ({ showToast: vi.fn() }));

vi.mock("@/hooks/useFetcher", () => ({
  useFetcher: () => ({
    getData: mocks.getData,
    putItem: mocks.putItem,
    deleteItem: mocks.deleteItem,
  }),
}));

const reviewOf = (overrides: Partial<ProductReview> = {}): ProductReview => ({
  id: "review-1",
  authorName: "Ivan",
  rating: 5,
  qualityRating: 5,
  deliveryRating: 4,
  accuracyRating: 5,
  comment: "solid drill",
  photos: [],
  likeCount: 3,
  commentCount: 0,
  createdAt: "2026-11-11T10:00:00.000Z",
  ...overrides,
});

/** The same wiring the block uses: one liked set and one count map per block. */
const Harness = ({ reviews }: { reviews: ProductReview[] }) => {
  const likes = useReviewLikes("product-1");
  const counts = useReviewCounts();

  return (
    <div>
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          counts={counts}
          likes={likes}
        />
      ))}
    </div>
  );
};

const deferred = () => {
  let resolve: (value: unknown) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe("ReviewCard like control (spec 0014)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mocks.getData.mockReset().mockResolvedValue({ reviewIds: [] });
    mocks.putItem.mockReset();
    mocks.deleteItem.mockReset();
    vi.mocked(showToast).mockClear();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
  });

  const mount = async (reviews: ProductReview[]) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<Harness reviews={reviews} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    return {
      likes: Array.from(
        container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"),
      ),
    };
  };

  it("prints the stored number and reads unpressed before any press (AC-1)", async () => {
    const { likes } = await mount([reviewOf()]);

    expect(likes[0].getAttribute("aria-pressed")).toBe("false");
    expect(likes[0].getAttribute("aria-label")).toBe("like");
    expect(likes[0].textContent).toContain("3");
    expect(likes[0].getAttribute("aria-busy")).toBe("false");
  });

  it("moves the number and the pressed state before the answer, then prints the answered number (AC-6)", async () => {
    const pending = deferred();
    mocks.putItem.mockReturnValue(pending.promise);
    const { likes } = await mount([reviewOf()]);

    await act(async () => {
      likes[0].click();
      await Promise.resolve();
    });

    expect(likes[0].getAttribute("aria-pressed")).toBe("true");
    expect(likes[0].textContent).toContain("4");
    expect(likes[0].getAttribute("aria-busy")).toBe("true");
    // No body: the route takes none, and a JSON `null` body is refused by
    // `express.json()` before the route runs (spec 0014, AC-4).
    expect(mocks.putItem).toHaveBeenCalledWith("/reviews/review-1/like");

    await act(async () => {
      pending.resolve({ liked: true, likeCount: 9 });
      await Promise.resolve();
    });

    expect(likes[0].textContent).toContain("9");
    expect(likes[0].getAttribute("aria-pressed")).toBe("true");
    expect(likes[0].getAttribute("aria-busy")).toBe("false");
  });

  it("restores the number and the pressed state after a refusal, and re reads the set (AC-6)", async () => {
    mocks.putItem.mockRejectedValue(new Error("refused"));
    const { likes } = await mount([reviewOf()]);
    const readsBefore = mocks.getData.mock.calls.length;

    await act(async () => {
      likes[0].click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(likes[0].getAttribute("aria-pressed")).toBe("false");
    expect(likes[0].textContent).toContain("3");
    expect(showToast).toHaveBeenCalledWith({
      title: "likeFailed",
      type: "error",
    });
    expect(mocks.getData.mock.calls.length).toBeGreaterThan(readsBefore);
  });

  it("sends nothing on a second press while the first request runs (AC-6)", async () => {
    const pending = deferred();
    mocks.putItem.mockReturnValue(pending.promise);
    const { likes } = await mount([reviewOf()]);

    await act(async () => {
      likes[0].click();
      await Promise.resolve();
      likes[0].click();
      await Promise.resolve();
    });

    expect(mocks.putItem).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({ liked: true, likeCount: 4 });
      await Promise.resolve();
    });
  });

  it("moves the number of a row from an appended page and leaves the other alone (AC-6)", async () => {
    mocks.putItem.mockResolvedValue({ liked: true, likeCount: 6 });
    const { likes } = await mount([
      reviewOf(),
      reviewOf({ id: "review-2", likeCount: 5 }),
    ]);

    await act(async () => {
      likes[1].click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(likes[0].textContent).toContain("3");
    expect(likes[1].textContent).toContain("6");
    expect(mocks.putItem).toHaveBeenCalledWith("/reviews/review-2/like");
  });

  it("names the thread, prints the comment number and keeps it closed until pressed (AC-1, AC-11)", async () => {
    await mount([reviewOf({ commentCount: 2 })]);

    const toggle = container.querySelector<HTMLButtonElement>(
      "button[aria-controls]",
    );

    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(toggle?.getAttribute("aria-controls")).toBe(
      "review-review-1-comments",
    );
    expect(toggle?.getAttribute("aria-label")).toBe("comments.open");
    expect(toggle?.textContent).toContain("2");
    expect(container.querySelector("#review-review-1-comments")).toBeNull();
  });
});
