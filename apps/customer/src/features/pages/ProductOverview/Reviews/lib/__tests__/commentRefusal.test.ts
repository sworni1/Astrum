import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { COMMENT_REFUSAL_KEYS, classifyCommentRefusal } from "@/features/pages/ProductOverview/Reviews/lib/commentRefusal";

const refusal = (
  status?: number,
  body?: Record<string, unknown>,
): AxiosError => {
  const config = { headers: new AxiosHeaders() } as never;

  return new AxiosError(
    "refused",
    "ERR_BAD_REQUEST",
    config,
    null,
    status === undefined
      ? undefined
      : {
          status,
          statusText: "refused",
          data: body ?? {},
          headers: {},
          config: config as never,
        },
  );
};

describe("classifyCommentRefusal", () => {
  it("answers invalid for a 400 carrying the validation array (AC-8)", () => {
    expect(
      classifyCommentRefusal(
        refusal(400, { errors: [{ property: "body", constraints: {} }] }),
      ),
    ).toBe("invalid");
  });

  it("answers rateLimited for the hourly refusal (AC-9)", () => {
    expect(
      classifyCommentRefusal(
        refusal(429, { code: "REVIEW_COMMENT_RATE_LIMITED" }),
      ),
    ).toBe("rateLimited");
  });

  it("answers generic for another client refusal (AC-10)", () => {
    expect(
      classifyCommentRefusal(
        refusal(403, { code: "REVIEW_COMMENT_FORBIDDEN" }),
      ),
    ).toBe("generic");
  });

  it("answers unconfirmed when no answer arrived at all (AC-9)", () => {
    expect(classifyCommentRefusal(refusal())).toBe("unconfirmed");
    expect(classifyCommentRefusal(new Error("offline"))).toBe("unconfirmed");
  });

  it("keeps the confirmation branch apart, so no second toast is raised (AC-5)", () => {
    expect(
      classifyCommentRefusal(refusal(403, { code: "EMAIL_NOT_CONFIRMED" })),
    ).toBe("emailNotConfirmed");
  });

  it("maps every branch that raises its own toast to a catalog key (AC-13)", () => {
    expect(COMMENT_REFUSAL_KEYS).toEqual({
      invalid: "comments.refused.invalid",
      rateLimited: "comments.refused.rateLimited",
      generic: "comments.refused.generic",
      unconfirmed: "comments.refused.unconfirmed",
    });
  });
});
