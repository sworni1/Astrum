import { describe, expect, it } from "vitest";
import { resolveStaffPageState } from "@/hooks/staff/staffPage";

const refusal = (status: number, code?: string) => ({
  isAxiosError: true,
  response: { status, data: code ? { code } : {} },
});

describe("resolveStaffPageState", () => {
  it("is loading while the read runs and ready when it lands (AC-13)", () => {
    expect(resolveStaffPageState(null, true, "NOT_POINT_WORKER")).toBe(
      "loading",
    );
    expect(resolveStaffPageState(null, false, "NOT_POINT_WORKER")).toBe(
      "ready",
    );
  });

  it("paints the no role screen from the refusal code (AC-13)", () => {
    expect(
      resolveStaffPageState(
        refusal(403, "NOT_POINT_WORKER"),
        false,
        "NOT_POINT_WORKER",
      ),
    ).toBe("noRole");
    expect(
      resolveStaffPageState(refusal(403, "NOT_COURIER"), false, "NOT_COURIER"),
    ).toBe("noRole");
  });

  it("treats another role code as a failure, not as no role (AC-13)", () => {
    expect(
      resolveStaffPageState(
        refusal(403, "NOT_COURIER"),
        false,
        "NOT_POINT_WORKER",
      ),
    ).toBe("failure");
  });

  it("paints nothing for a 401, because the fetcher ends the session (AC-13)", () => {
    expect(
      resolveStaffPageState(refusal(401, "SESSION_REVOKED"), false, "x"),
    ).toBe("sessionGone");
  });

  it("treats an outage, a 500 and a timeout as failures (AC-13)", () => {
    expect(
      resolveStaffPageState(
        refusal(503, "STAFF_ROLE_UNAVAILABLE"),
        false,
        "NOT_POINT_WORKER",
      ),
    ).toBe("failure");
    expect(resolveStaffPageState(refusal(500), false, "NOT_POINT_WORKER")).toBe(
      "failure",
    );
    expect(resolveStaffPageState(new Error("timeout"), false, "x")).toBe(
      "failure",
    );
  });
});
