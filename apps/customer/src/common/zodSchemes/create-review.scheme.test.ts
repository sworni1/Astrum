import en from "@messages/en.json";
import { describe, expect, it } from "vitest";
import { createReviewFormSchema } from "./create-review.scheme";
import type { ValidationTranslator } from "./translator";

const translator = ((key: keyof typeof en.validation) =>
  en.validation[key]) as unknown as ValidationTranslator;

const schema = createReviewFormSchema(translator);

const validValues = {
  rating: 5,
  qualityRating: 4,
  deliveryRating: 3,
  accuracyRating: 5,
  comment: "solid drill",
};

const issuesOf = (values: Record<string, unknown>) => {
  const result = schema.safeParse(values);

  return result.success
    ? []
    : result.error.issues.map((issue) => String(issue.path[0]));
};

describe("createReviewFormSchema", () => {
  it("accepts a full review (AC-8)", () => {
    expect(issuesOf(validValues)).toEqual([]);
  });

  it("refuses a comment of four characters after the trim (AC-8)", () => {
    expect(issuesOf({ ...validValues, comment: "  abcd  " })).toEqual([
      "comment",
    ]);
  });

  it("refuses a missing detail rating (AC-8)", () => {
    const { accuracyRating, ...withoutAccuracy } = validValues;

    expect(accuracyRating).toBe(5);
    expect(issuesOf(withoutAccuracy)).toEqual(["accuracyRating"]);
  });

  it("refuses an overall rating outside one to five (AC-8)", () => {
    expect(issuesOf({ ...validValues, rating: 0 })).toEqual(["rating"]);
    expect(issuesOf({ ...validValues, rating: 6 })).toEqual(["rating"]);
  });

  it("counts the comment in UTF-16 units, as the server does (AC-8)", () => {
    expect(issuesOf({ ...validValues, comment: "😀😀" })).toEqual(["comment"]);
    expect(issuesOf({ ...validValues, comment: "😀😀a" })).toEqual([]);
  });
});
