import type { Request, Response } from "express";
import { logger } from "../../common/helpers/logger";
import {
  createRequireSellerOrderWorkflow,
  parseSellerOrderWorkflowEnabled,
} from "./seller-order-workflow.config";

describe("parseSellerOrderWorkflowEnabled", () => {
  it("defaults to disabled and accepts only literal boolean strings (AC-13)", () => {
    expect(parseSellerOrderWorkflowEnabled(undefined)).toBe(false);
    expect(parseSellerOrderWorkflowEnabled("false")).toBe(false);
    expect(parseSellerOrderWorkflowEnabled("true")).toBe(true);
    expect(() => parseSellerOrderWorkflowEnabled("1")).toThrow(
      "SELLER_ORDER_WORKFLOW_ENABLED must be true or false",
    );
    expect(() => parseSellerOrderWorkflowEnabled(" true ")).toThrow(
      "SELLER_ORDER_WORKFLOW_ENABLED must be true or false",
    );
  });
});

describe("createRequireSellerOrderWorkflow", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 503 while disabled and passes through while enabled (AC-13, AC-14)", () => {
    const req = {
      body: { status: "CONFIRMED" },
      params: { orderItemId: "line-1" },
      userId: "seller-1",
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);

    createRequireSellerOrderWorkflow(false)(
      req as unknown as Request,
      res as unknown as Response,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      code: "SELLER_ORDER_WORKFLOW_DISABLED",
      message: "Seller order workflow is disabled.",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "seller.order_item.status_refused",
        userId: "seller-1",
        orderId: null,
        orderItemId: "line-1",
        targetStatus: "CONFIRMED",
        resultCode: "SELLER_ORDER_WORKFLOW_DISABLED",
      }),
    );
    const loggedFields = warn.mock.calls[0][0];
    expect(loggedFields).not.toHaveProperty("deliveryAddress");
    expect(loggedFields).not.toHaveProperty("paymentDetails");

    createRequireSellerOrderWorkflow(true)(
      req as unknown as Request,
      res as unknown as Response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
