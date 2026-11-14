import { describe, expect, it } from "vitest";
import {
  distributionRows,
  formatAverageRating,
  ratingShare,
} from "@/features/pages/ProductOverview/Reviews/lib/distribution";

describe("ratingShare", () => {
  it("prints the integer share of the total and never divides by zero (AC-3)", () => {
    expect(ratingShare(1, 3)).toBe(33);
    expect(ratingShare(2, 3)).toBe(67);
    expect(ratingShare(0, 0)).toBe(0);
  });

  it("does not force the five shares to add up to 100 (AC-3)", () => {
    const shares = distributionRows({ "5": 1, "3": 1, "1": 1 }, 3).map(
      (row) => row.share,
    );

    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(99);
  });
});

describe("distributionRows", () => {
  it("answers five rows from five stars to one, zero filled (AC-3)", () => {
    const rows = distributionRows({ "5": 2 }, 3);

    expect(rows.map((row) => row.star)).toEqual([5, 4, 3, 2, 1]);
    expect(rows.map((row) => row.count)).toEqual([2, 0, 0, 0, 0]);
    expect(rows.map((row) => row.share)).toEqual([67, 0, 0, 0, 0]);
  });

  it("prints 0% for a row with no review (AC-3)", () => {
    expect(distributionRows({ "5": 1 }, 1)[1].share).toBe(0);
  });
});

describe("formatAverageRating", () => {
  it("prints one decimal (AC-3, AC-5)", () => {
    expect(formatAverageRating(4.666)).toBe("4.7");
    expect(formatAverageRating(5)).toBe("5.0");
    expect(formatAverageRating(0)).toBe("0.0");
  });
});
