import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/common/helpers/showToast", () => ({ showToast: toast }));

import {
  refusalToastFor,
  showRefusalToast,
} from "@/features/pages/PointWorkspace/lib/refusals";

const refusal = (status: number, code: string) => ({
  isAxiosError: true,
  response: { status, data: { code } },
});

const translate = (key: string): string => key;

describe("refusalToastFor", () => {
  it("maps every code the counter can meet to its own text (AC-12)", () => {
    expect(refusalToastFor(refusal(404, "ORDER_NOT_FOUND"))).toEqual({
      key: "orderNotFound",
      retry: false,
    });
    expect(refusalToastFor(refusal(409, "ORDER_NOT_SHIPPED"))).toEqual({
      key: "notShipped",
      retry: false,
    });
    expect(refusalToastFor(refusal(409, "ALREADY_HANDED_OVER"))).toEqual({
      key: "alreadyHandedOver",
      retry: false,
    });
    expect(refusalToastFor(refusal(409, "NOTHING_TO_CANCEL"))).toEqual({
      key: "nothingToCancel",
      retry: false,
    });
    expect(refusalToastFor(refusal(409, "PICKUP_POINT_INACTIVE"))).toEqual({
      key: "pointInactive",
      retry: false,
    });
    expect(refusalToastFor(refusal(403, "NOT_POINT_WORKER"))).toEqual({
      key: "notPointWorker",
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

  it("reads the code, never the server message (AC-12)", () => {
    expect(
      refusalToastFor({
        isAxiosError: true,
        response: {
          status: 409,
          data: { code: "ALREADY_HANDED_OVER", message: "Something else" },
        },
      }),
    ).toEqual({ key: "alreadyHandedOver", retry: false });
  });
});

describe("showRefusalToast", () => {
  beforeEach(() => {
    toast.mockReset();
  });

  it("raises the mapped text with no action for a plain refusal (AC-12)", () => {
    showRefusalToast(refusal(409, "NOTHING_TO_CANCEL"), translate, vi.fn());

    expect(toast).toHaveBeenCalledWith({
      title: "point.queue.refusals.nothingToCancel",
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

    expect(raised.title).toBe("point.queue.refusals.accountStatusUnavailable");
    expect(raised.action.label).toBe("point.queue.refusals.retry");

    raised.action.onClick();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
