import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { OrderItemStatus } from "../../../generated/prisma/enums";
import { logger } from "../../common/helpers/logger";
import { ORDER_ERROR_CODES } from "./order.constants";

export const parseSellerOrderWorkflowEnabled = (
  value: string | undefined,
): boolean => {
  if (value === undefined || value === "false") {
    return false;
  }

  if (value === "true") {
    return true;
  }

  throw new Error("SELLER_ORDER_WORKFLOW_ENABLED must be true or false");
};

export const sellerOrderWorkflowEnabled = parseSellerOrderWorkflowEnabled(
  process.env.SELLER_ORDER_WORKFLOW_ENABLED,
);

export const createRequireSellerOrderWorkflow =
  (enabled: boolean) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (enabled) {
      next();
      return;
    }

    const { userId } = req as Request & { userId: string };
    const targetStatus = Object.values(OrderItemStatus).includes(
      req.body?.status,
    )
      ? req.body.status
      : null;

    logger.warn({
      event: "seller.order_item.status_refused",
      userId,
      orderId: null,
      orderItemId: req.params.orderItemId,
      targetStatus,
      resultCode: ORDER_ERROR_CODES.sellerWorkflowDisabled,
    });

    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      code: ORDER_ERROR_CODES.sellerWorkflowDisabled,
      message: "Seller order workflow is disabled.",
    });
  };

export const requireSellerOrderWorkflow = createRequireSellerOrderWorkflow(
  sellerOrderWorkflowEnabled,
);
