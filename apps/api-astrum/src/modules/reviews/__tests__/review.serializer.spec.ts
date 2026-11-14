import {
  buildDistribution,
  roundAverageRating,
  serializeReview,
  serializeReviewComment,
  type ReviewCommentRow,
  type ReviewRow,
} from "../review.serializer";

const rowFor = (overrides: Partial<ReviewRow> = {}): ReviewRow => ({
  id: "review-1",
  rating: 5,
  qualityRating: 4,
  deliveryRating: 3,
  accuracyRating: 5,
  comment: "solid drill",
  photos: ["http://cdn/one.png"],
  likeCount: 3,
  commentCount: 2,
  createdAt: new Date("2026-11-11T10:00:00.000Z"),
  User: { nickName: " Ivan " },
  ...overrides,
});

describe("serializeReview", () => {
  it("publishes only the fields the screen reads (AC-12)", () => {
    const review = serializeReview(rowFor());

    expect(review).toEqual({
      id: "review-1",
      authorName: "Ivan",
      rating: 5,
      qualityRating: 4,
      deliveryRating: 3,
      accuracyRating: 5,
      comment: "solid drill",
      photos: ["http://cdn/one.png"],
      likeCount: 3,
      commentCount: 2,
      createdAt: new Date("2026-11-11T10:00:00.000Z"),
    });
  });

  it("answers a null author name for an empty nickname (AC-12)", () => {
    expect(
      serializeReview(rowFor({ User: { nickName: "   " } })).authorName,
    ).toBeNull();
    expect(serializeReview(rowFor({ User: null })).authorName).toBeNull();
  });

  it("publishes both counters as integers from the stored columns (AC-2)", () => {
    const review = serializeReview(rowFor({ likeCount: 0, commentCount: 0 }));

    expect(review.likeCount).toBe(0);
    expect(review.commentCount).toBe(0);
  });
});

const commentRowFor = (
  overrides: Partial<ReviewCommentRow> = {},
): ReviewCommentRow => ({
  id: "comment-1",
  body: "the drill is solid",
  createdAt: new Date("2026-11-11T11:00:00.000Z"),
  deletedAt: null,
  userId: "user-1",
  User: { nickName: " Ivan " },
  ...overrides,
});

describe("serializeReviewComment", () => {
  it("never publishes the author id and marks the author's own row (AC-7)", () => {
    const mine = serializeReviewComment(commentRowFor(), "user-1");
    const theirs = serializeReviewComment(commentRowFor(), "user-2");

    expect(Object.keys(mine).sort()).toEqual([
      "authorName",
      "body",
      "createdAt",
      "deletedAt",
      "id",
      "mine",
    ]);
    expect(mine.mine).toBe(true);
    expect(theirs.mine).toBe(false);
    expect(mine.authorName).toBe("Ivan");
  });

  it("answers no text and no author for a deleted row (AC-7, AC-10)", () => {
    const deleted = serializeReviewComment(
      commentRowFor({ deletedAt: new Date("2026-11-11T12:00:00.000Z") }),
      "user-1",
    );

    expect(deleted.body).toBeNull();
    expect(deleted.authorName).toBeNull();
    expect(deleted.mine).toBe(true);
    expect(deleted.deletedAt).toBeInstanceOf(Date);
  });

  it("answers a null author name for an empty nickname", () => {
    expect(
      serializeReviewComment(
        commentRowFor({ User: { nickName: "  " } }),
        "user-1",
      ).authorName,
    ).toBeNull();
  });
});

describe("buildDistribution", () => {
  it("zero fills the five keys (AC-12)", () => {
    expect(buildDistribution([{ rating: 5, count: 2 }])).toEqual({
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 2,
    });
  });

  it("ignores a rating outside the five keys", () => {
    expect(buildDistribution([{ rating: 9, count: 4 }])).toEqual({
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
    });
  });
});

describe("roundAverageRating", () => {
  it("rounds to two decimals and answers zero for nothing (AC-12)", () => {
    expect(roundAverageRating(4.666)).toBe(4.67);
    expect(roundAverageRating(5)).toBe(5);
    expect(roundAverageRating(null)).toBe(0);
  });
});
