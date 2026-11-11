import { describe, expect, it } from "vitest";
import { cancelRefusal } from "./cancelRefusal";

const refusal = (data: unknown) => ({
  isAxiosError: true,
  response: { status: 409, data },
});

describe("cancelRefusal", () => {
  it("names the line status the gateway refused on (spec 0002, AC-10)", () => {
    expect(
      cancelRefusal(
        refusal({
          code: "INVALID_STATUS_TRANSITION",
          message: "An order with a SHIPPED line can no longer be cancelled.",
          from: "SHIPPED",
          to: "CANCELED",
        }),
      ),
    ).toEqual({ key: "cancelBlockedByLine", statusKey: "shipped" });
  });

  it("falls back to the generic failure for another refusal code", () => {
    expect(cancelRefusal(refusal({ code: "ORDER_NOT_FOUND" }))).toEqual({
      key: "cancelFailed",
    });
  });

  it("falls back when the refusal names no known line status", () => {
    expect(
      cancelRefusal(refusal({ code: "INVALID_STATUS_TRANSITION" })),
    ).toEqual({ key: "cancelFailed" });
    expect(
      cancelRefusal(
        refusal({ code: "INVALID_STATUS_TRANSITION", from: "TELEPORTED" }),
      ),
    ).toEqual({ key: "cancelFailed" });
  });

  it("calls a body carrying 404 an answer, not a lost result", () => {
    expect(cancelRefusal(refusal({ code: "ORDER_NOT_FOUND" }))).toEqual({
      key: "cancelFailed",
    });
  });

  it("says the result is unknown when the request got no answer at all", () => {
    expect(cancelRefusal(new Error("network down"))).toEqual({
      key: "cancelUnconfirmed",
    });
    expect(cancelRefusal({ isAxiosError: true, code: "ECONNABORTED" })).toEqual(
      { key: "cancelUnconfirmed" },
    );
  });
});
