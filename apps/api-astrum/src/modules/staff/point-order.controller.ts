import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../../common/helpers/appError";
import { handleErrors } from "../../common/helpers/errorHandler";
import type { AuthenticatedRequest } from "../../common/types/jwt.payload";
import type { StaffRequest } from "../../common/types/staff.types";
import { STAFF_ERROR_CODES } from "./constants/staff.constants";
import { PointOrderService } from "./point-order.service";

const service = new PointOrderService();

/**
 * The point the role guard resolved from the caller's own row. A point named by
 * the request is never read, so the scope cannot be chosen by the caller (AC-1).
 */
const pointOf = (req: Request): string => {
  const staff = (req as StaffRequest).staff;

  if (!staff?.pickupPointId) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      STAFF_ERROR_CODES.notPointWorker,
      "This account does not work at a pickup point",
    );
  }

  return staff.pickupPointId;
};

export class PointOrderController {
  async listPointOrders(req: Request, res: Response) {
    try {
      const answer = await service.listPointOrders(
        pointOf(req),
        req.query.page,
        req.query.limit,
      );

      res.status(StatusCodes.OK).json(answer);
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async handOver(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedRequest;
      const answer = await service.handOver(
        req.params.orderId as string,
        userId,
        pointOf(req),
      );

      res.status(StatusCodes.OK).json(answer);
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async cancel(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedRequest;
      const answer = await service.cancelOrder(
        req.params.orderId as string,
        userId,
        pointOf(req),
      );

      res.status(StatusCodes.OK).json(answer);
    } catch (error) {
      handleErrors(res, error);
    }
  }
}
