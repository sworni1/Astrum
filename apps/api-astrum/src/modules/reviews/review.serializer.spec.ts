import {
  buildDistribution,
  roundAverageRating,
  serializeReview,
  type ReviewRow,
} from "./review.serializer";

const rowFor = (overrides: Partial<ReviewRow> = {}): ReviewRow => ({
  id: "review-1",
  rating: 5,
  qualityRating: 4,
  deliveryRating: 3,
  accuracyRating: 5,
  comment: "solid drill",
  photos: ["http://cdn/one.png"],
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
      createdAt: new Date("2026-11-11T10:00:00.000Z"),
    });
  });

  it("answers a null author name for an empty nickname (AC-12)", () => {
    expect(serializeReview(rowFor({ User: { nickName: "   " } })).authorName).toBeNull();
    expect(serializeReview(rowFor({ User: null })).authorName).toBeNull();
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
