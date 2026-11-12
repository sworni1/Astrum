import { beforeEach, describe, expect, it, vi } from "vitest";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("@/common/helpers/showToast", () => ({ showToast }));

import { refusalToastFor, showRefusalToast } from "./refusals";

const refusal = (status: number, data: Record<string, unknown>) => ({
  isAxiosError: true,
  response: { status, data },
});

const translate = (key: string, values?: Record<string, string>): string =>
  values ? `${key} ${JSON.stringify(values)}` : key;

describe("refusalToastFor", () => {
  it("names both ends of the move a stale click lost (AC-10)", () => {
    expect(
      refusalToastFor(
        refusal(409, {
          code: "INVALID_STATUS_TRANSITION",
          from: "SHIPPED",
          to: "CANCELLED",
        }),
      ),
    ).toEqual({
      key: "invalidTransition",
      values: { from: "SHIPPED", to: "CANCELLED" },
      retry: false,
    });
  });

  it.each([
    [404, "ORDER_ITEM_NOT_FOUND", "orderItemNotFound"],
    [422, "VALIDATION", "validation"],
    [403, "EMAIL_NOT_CONFIRMED", "emailNotConfirmed"],
  ])(
    "maps %i %s to its own catalog key and asks for no retry (AC-10)",
    (status: number, code: string, key: string) => {
      expect(refusalToastFor(refusal(status, { code }))).toEqual({
        key,
        retry: false,
      });
    },
  );

  it("offers a retry only for an account state that could not be read (AC-10)", () => {
    expect(
      refusalToastFor(refusal(503, { code: "ACCOUNT_STATUS_UNAVAILABLE" })),
    ).toEqual({ key: "accountStatusUnavailable", retry: true });
  });

  it("falls back to the generic failure with a retry (AC-10)", () => {
    expect(refusalToastFor(refusal(500, {}))).toEqual({
      key: "generic",
      retry: true,
    });
    expect(
      refusalToastFor({ isAxiosError: true, code: "ECONNABORTED" }),
    ).toEqual({ key: "generic", retry: true });
    expect(refusalToastFor(new Error("no answer"))).toEqual({
      key: "generic",
      retry: true,
    });
  });

  it("never carries the english prose the gateway sent (AC-10)", () => {
    const toast = refusalToastFor(
      refusal(409, {
        code: "INVALID_STATUS_TRANSITION",
        message: "A line cannot move from SHIPPED to CANCELLED.",
        from: "SHIPPED",
        to: "CANCELLED",
      }),
    );

    expect(toast).not.toHaveProperty("message");
    expect(JSON.stringify(toast)).not.toContain("A line cannot move");
  });
});

describe("showRefusalToast", () => {
  beforeEach(() => {
    showToast.mockReset();
  });

  it("writes the catalog text and no action where a person must act (AC-10)", () => {
    const onRetry = vi.fn();

    showRefusalToast(
      refusal(409, {
        code: "INVALID_STATUS_TRANSITION",
        from: "SHIPPED",
        to: "CANCELLED",
      }),
      translate,
      onRetry,
    );

    expect(showToast).toHaveBeenCalledWith({
      title: 'toasts.invalidTransition {"from":"SHIPPED","to":"CANCELLED"}',
      type: "error",
    });
  });

  it("adds the retry action for a server fault (AC-10)", () => {
    const onRetry = vi.fn();

    showRefusalToast(refusal(500, {}), translate, onRetry);

    expect(showToast).toHaveBeenCalledWith({
      title: "toasts.generic",
      type: "error",
      action: { label: "toasts.retry", onClick: onRetry },
    });
  });
});
