import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/common/helpers/showToast", () => ({ showToast: toast }));

import {
  refusalToastFor,
  showRefusalToast,
} from "@/features/pages/CourierWorkspace/lib/refusals";

const refusal = (status: number, code: string) => ({
  isAxiosError: true,
  response: { status, data: { code } },
});

const translate = (key: string): string => key;

describe("refusalToastFor", () => {
  it("maps every code the courier can meet to its own text (AC-12)", () => {
    expect(refusalToastFor(refusal(404, "ORDER_NOT_FOUND"))).toEqual({
      key: "orderNotFound",
      retry: false,
    });
    expect(refusalToastFor(refusal(409, "ORDER_NOT_DELIVERED"))).toEqual({
      key: "notDelivered",
      retry: false,
    });
    expect(refusalToastFor(refusal(409, "ALREADY_HANDED_OVER"))).toEqual({
      key: "alreadyHandedOver",
      retry: false,
    });
    expect(refusalToastFor(refusal(409, "ALREADY_CLAIMED"))).toEqual({
      key: "alreadyClaimed",
      retry: false,
    });
    expect(refusalToastFor(refusal(409, "NOTHING_TO_CANCEL"))).toEqual({
      key: "nothingToCancel",
      retry: false,
    });
    expect(refusalToastFor(refusal(403, "NOT_COURIER"))).toEqual({
      key: "notCourier",
      retry: false,
    });
    expect(refusalToastFor(refusal(503, "STAFF_ROLE_UNAVAILABLE"))).toEqual({
      key: "roleUnavailable",
      retry: false,
    });
    expect(refusalToastFor(refusal(422, "VALIDATION"))).toEqual({
      key: "validation",
      retry: false,
    });
  });

  it("offers a retry only where the request may simply be sent again (AC-12)", () => {
    expect(refusalToastFor(refusal(503, "ACCOUNT_STATUS_UNAVAILABLE"))).toEqual(
      {
        key: "accountStatusUnavailable",
        retry: true,
      },
    );
    expect(refusalToastFor(refusal(500, "INTERNAL"))).toEqual({
      key: "generic",
      retry: true,
    });
    expect(
      refusalToastFor({ isAxiosError: true, response: undefined }),
    ).toEqual({
      key: "generic",
      retry: true,
    });
  });

  it("leaves the confirmation code to the shared interceptor (AC-12)", () => {
    expect(refusalToastFor(refusal(403, "EMAIL_NOT_CONFIRMED"))).toEqual({
      key: "generic",
      retry: true,
    });
  });
});

describe("showRefusalToast", () => {
  beforeEach(() => {
    toast.mockReset();
  });

  it("raises the mapped text with no action for a plain refusal (AC-12)", () => {
    showRefusalToast(refusal(409, "ALREADY_CLAIMED"), translate, vi.fn());

    expect(toast).toHaveBeenCalledWith({
      title: "refusals.alreadyClaimed",
      type: "error",
    });
  });

  it("carries the retry action where the map asks for one (AC-12)", () => {
    const retry = vi.fn();

    showRefusalToast(
      refusal(503, "ACCOUNT_STATUS_UNAVAILABLE"),
      translate,
      retry,
    );

    const raised = toast.mock.calls[0][0] as {
      title: string;
      action: { label: string; onClick: () => void };
    };

    expect(raised.title).toBe("refusals.accountStatusUnavailable");
    expect(raised.action.label).toBe("refusals.retry");

    raised.action.onClick();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
