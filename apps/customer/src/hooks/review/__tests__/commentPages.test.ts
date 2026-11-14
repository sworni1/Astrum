import { describe, expect, it } from "vitest";
import type {
  ReviewComment,
  ReviewCommentPage,
} from "@/common/types/review.types";
import { mergeCommentPages } from "@/hooks/review/commentPages";

const commentOf = (id: string): ReviewComment => ({
  id,
  authorName: "Ivan",
  body: `body ${id}`,
  createdAt: "2026-11-12T09:00:00.000Z",
  deletedAt: null,
  mine: false,
});

const pageOf = (
  ids: string[],
  overrides: Partial<ReviewCommentPage> = {},
): ReviewCommentPage => ({
  comments: ids.map(commentOf),
  nextCursor: null,
  hasNextPage: false,
  ...overrides,
});

describe("mergeCommentPages", () => {
  it("keeps the order the gateway answered", () => {
    expect(
      mergeCommentPages([pageOf(["a", "b"]), pageOf(["c"])]).map(
        (row) => row.id,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("never repeats an id across two pages (AC-11)", () => {
    expect(
      mergeCommentPages([pageOf(["a", "b"]), pageOf(["b", "c"])]).map(
        (row) => row.id,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("survives the first page not having arrived yet", () => {
    expect(
      mergeCommentPages([undefined, pageOf(["a"])]).map((row) => row.id),
    ).toEqual(["a"]);
  });
});
