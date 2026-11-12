import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewComment } from "@/common/types/review.types";
import ReviewCommentItem from ".";

const mocks = vi.hoisted(() => ({
  deleteTrigger: vi.fn(),
  onDeleted: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({
    dateTime: () => "12 November 2026, 10:00",
  }),
}));

vi.mock("@/common/helpers/showToast", () => ({ showToast: vi.fn() }));

vi.mock("@/hooks/review/useDeleteReviewComment", () => ({
  useDeleteReviewComment: () => ({
    deleteCommentTrigger: mocks.deleteTrigger,
    isDeletingComment: false,
  }),
}));

const commentOf = (overrides: Partial<ReviewComment> = {}): ReviewComment => ({
  id: "comment-1",
  authorName: "Ivan",
  body: "the drill is solid",
  createdAt: "2026-11-12T10:00:00.000Z",
  deletedAt: null,
  mine: true,
  ...overrides,
});

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe("ReviewCommentItem (spec 0014)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mocks.deleteTrigger.mockReset();
    mocks.onDeleted.mockReset();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
  });

  const mount = async (
    comment: ReviewComment,
    focusOnMount = false,
    nextComment?: ReviewComment,
  ) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <ul>
          <ReviewCommentItem
            reviewId="review-1"
            comment={comment}
            focusOnMount={focusOnMount}
            onDeleted={(answer) => {
              mocks.onDeleted(answer);
              if (nextComment) {
                root.render(
                  <ul>
                    <ReviewCommentItem
                      reviewId="review-1"
                      comment={nextComment}
                      focusOnMount
                      onDeleted={mocks.onDeleted}
                    />
                  </ul>,
                );
              }
            }}
          />
        </ul>,
      );
    });
    await flush();

    return {
      row: container.querySelector("li") as HTMLLIElement,
      // The confirmation renders in a portal, so the whole document is read.
      buttons: () =>
        Array.from(document.querySelectorAll<HTMLButtonElement>("button")),
    };
  };

  it("renders the stub for a deleted row, with no body and no delete control (AC-11)", async () => {
    const { buttons } = await mount(
      commentOf({ deletedAt: "2026-11-12T11:00:00.000Z" }),
    );

    expect(container.textContent).toContain("comments.deleted");
    expect(container.textContent).not.toContain("the drill is solid");
    expect(container.textContent).not.toContain("Ivan");
    expect(buttons()).toHaveLength(0);
  });

  it("renders no delete control on another customer's row (AC-11)", async () => {
    const { buttons } = await mount(commentOf({ mine: false }));

    expect(container.textContent).toContain("the drill is solid");
    expect(buttons()).toHaveLength(0);
  });

  it("opens the confirmation with focus on the keep control and sends nothing when kept (AC-11)", async () => {
    const { buttons } = await mount(commentOf());

    await act(async () => {
      buttons()[0].click();
    });
    await flush();

    const keep = buttons().find(
      (button) => button.textContent === "comments.keep",
    );

    expect(keep).toBeDefined();
    expect(document.activeElement).toBe(keep);

    await act(async () => {
      keep?.click();
    });
    await flush();

    expect(mocks.deleteTrigger).not.toHaveBeenCalled();
    expect(mocks.onDeleted).not.toHaveBeenCalled();
  });

  it("sends one delete on confirm and reports the stub it was handed (AC-10)", async () => {
    const stub = commentOf({
      body: null,
      authorName: null,
      deletedAt: "2026-11-12T11:00:00.000Z",
    });
    mocks.deleteTrigger.mockResolvedValue({ comment: stub, commentCount: 0 });
    const { buttons } = await mount(commentOf(), false, stub);

    await act(async () => {
      buttons()[0].click();
    });
    await flush();

    const confirm = buttons().find(
      (button) => button.textContent === "comments.deleteConfirm",
    );

    await act(async () => {
      confirm?.click();
    });
    await flush();
    await flush();

    expect(mocks.deleteTrigger).toHaveBeenCalledTimes(1);
    expect(mocks.onDeleted).toHaveBeenCalledWith({
      comment: stub,
      commentCount: 0,
    });
    expect(document.activeElement).toBe(container.querySelector("li"));
    expect(container.textContent).toContain("comments.deleted");
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("focuses the row it is pointed at, which is what the stub needs (AC-11)", async () => {
    const { row } = await mount(commentOf(), true);

    expect(document.activeElement).toBe(row);
  });
});
