import { describe, expect, it } from "vitest";
import type { ReviewPage } from "@/common/types/review.types";
import { mergeReviewPages, reviewsKey, reviewsPageKey } from "./reviewsKeys";

const pageOf = (
  ids: string[],
  overrides: Partial<ReviewPage> = {},
): ReviewPage => ({
  reviews: ids.map((id) => ({
    id,
    authorName: "Ivan",
    rating: 5,
    qualityRating: 5,
    deliveryRating: 5,
    accuracyRating: 5,
    comment: "solid drill",
    photos: [],
    createdAt: "2026-11-11T10:00:00.000Z",
  })),
  nextCursor: null,
  hasNextPage: false,
  aggregate: { total: ids.length, averageRating: 5, distribution: {} },
  ...overrides,
});

describe("mergeReviewPages", () => {
  it("keeps the order the gateway answered (AC-4)", () => {
    expect(mergeReviewPages([pageOf(["a", "b"]), pageOf(["c"])]).map((r) => r.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("never repeats an id already on screen (AC-4)", () => {
    expect(
      mergeReviewPages([pageOf(["a", "b"]), pageOf(["b", "c"])]).map((r) => r.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("survives the first page not having arrived yet (AC-4)", () => {
    expect(mergeReviewPages([undefined, pageOf(["a"])]).map((r) => r.id)).toEqual([
      "a",
    ]);
  });
});

describe("review keys", () => {
  it("keeps one key for the first page, so the header and the block share it (AC-4)", () => {
    expect(reviewsKey("product-1")).toBe("/products/product-1/reviews");
  });

  it("gives every appended page its own key (AC-4)", () => {
    expect(reviewsPageKey("product-1", "review-1")).toBe(
      "/products/product-1/reviews?after=review-1",
    );
  });
});
