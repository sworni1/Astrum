import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateReviewDto } from "./create-review.dto";

const build = (body: Record<string, unknown>): CreateReviewDto =>
  plainToInstance(CreateReviewDto, body, { excludeExtraneousValues: true });

const invalidProperties = async (
  body: Record<string, unknown>,
): Promise<string[]> =>
  (await validate(build(body))).map((error) => error.property);

const validBody = (overrides: Record<string, unknown> = {}) => ({
  orderItemId: "line-1",
  rating: 5,
  qualityRating: 4,
  deliveryRating: 3,
  accuracyRating: 5,
  comment: "solid drill",
  ...overrides,
});

describe("CreateReviewDto", () => {
  it("drops a product id sent in the body (AC-11)", () => {
    const dto = build(validBody({ productId: "product-from-body" }));

    expect(dto).not.toHaveProperty("productId");
  });

  it("trims the comment before validation (AC-11)", () => {
    const dto = build(validBody({ comment: "   solid drill   " }));

    expect(dto.comment).toBe("solid drill");
  });

  it("refuses a comment shorter than five characters after the trim (AC-8, AC-11)", async () => {
    expect(await invalidProperties(validBody({ comment: "  ab  " }))).toEqual([
      "comment",
    ]);
  });

  it("refuses a comment longer than 2000 characters (AC-11)", async () => {
    expect(
      await invalidProperties(validBody({ comment: "a".repeat(2001) })),
    ).toEqual(["comment"]);
  });

  it("accepts a comment of exactly 2000 characters (AC-11)", async () => {
    expect(
      await invalidProperties(validBody({ comment: "a".repeat(2000) })),
    ).toEqual([]);
  });

  it("refuses a missing detail rating and an out of range overall rating (AC-8)", async () => {
    const missingDetail = await invalidProperties(
      validBody({ accuracyRating: undefined }),
    );
    const outOfRange = await invalidProperties(validBody({ rating: 6 }));

    expect(missingDetail).toEqual(["accuracyRating"]);
    expect(outOfRange).toEqual(["rating"]);
  });
});
