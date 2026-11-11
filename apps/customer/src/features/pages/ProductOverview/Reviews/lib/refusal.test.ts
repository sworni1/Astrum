import { describe, expect, it } from "vitest";
import { classifyReviewRefusal, fieldErrorsOf } from "./refusal";

const refusal = (status: number, data?: unknown) => ({
  isAxiosError: true,
  response: { status, data },
});

describe("classifyReviewRefusal", () => {
  it("maps a 403 REVIEW_ONLY_AFTER_DELIVERY to its own toast (AC-10)", () => {
    expect(
      classifyReviewRefusal(
        refusal(403, { code: "REVIEW_ONLY_AFTER_DELIVERY" }),
      ),
    ).toBe("notDelivered");
  });

  it("maps a 409 REVIEW_ALREADY_EXISTS to its own toast (AC-10)", () => {
    expect(
      classifyReviewRefusal(refusal(409, { code: "REVIEW_ALREADY_EXISTS" })),
    ).toBe("alreadyReviewed");
  });

  it("maps a 400 carrying validation errors to the invalid branch (AC-10)", () => {
    expect(
      classifyReviewRefusal(
        refusal(400, {
          errors: [{ property: "comment", constraints: { minLength: "short" } }],
        }),
      ),
    ).toBe("invalid");
  });

  it("maps another answered 4xx to the generic branch (AC-10)", () => {
    expect(
      classifyReviewRefusal(refusal(403, { code: "REVIEW_PRODUCT_MISMATCH" })),
    ).toBe("generic");
    expect(
      classifyReviewRefusal(refusal(404, { code: "REVIEW_ORDER_ITEM_NOT_FOUND" })),
    ).toBe("generic");
  });

  it("maps a failure with no answer to unconfirmed (AC-10)", () => {
    expect(classifyReviewRefusal({ isAxiosError: true })).toBe("unconfirmed");
    expect(classifyReviewRefusal(new Error("network"))).toBe("unconfirmed");
  });

  it("leaves 403 EMAIL_NOT_CONFIRMED to the shared confirmation toast (AC-10)", () => {
    expect(
      classifyReviewRefusal(refusal(403, { code: "EMAIL_NOT_CONFIRMED" })),
    ).toBe("emailNotConfirmed");
  });
});

describe("fieldErrorsOf", () => {
  it("reads one message per field out of the validation answer (AC-10)", () => {
    expect(
      fieldErrorsOf(
        refusal(400, {
          errors: [
            { property: "comment", constraints: { minLength: "too short" } },
            { property: "rating", constraints: { min: "too small" } },
          ],
        }),
      ),
    ).toEqual([
      { property: "comment", message: "too short" },
      { property: "rating", message: "too small" },
    ]);
  });

  it("answers nothing when the body carries no errors (AC-10)", () => {
    expect(fieldErrorsOf(refusal(500, { message: "boom" }))).toEqual([]);
  });
});
