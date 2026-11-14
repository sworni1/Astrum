import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../../common/helpers/appError";
import { handleErrors } from "../../common/helpers/errorHandler";
import type { AuthenticatedRequest } from "../../common/types/jwt.payload";
import { STAFF_ERROR_CODES } from "./constants/staff.constants";
import {
  type CourierScope,
  CourierOrderService,
} from "./courier-order.service";

const service = new CourierOrderService();

/**
 * The list the caller asked for. `validateDto` reads a body only, so the query is
 * checked here, and a repeated `scope` arrives as an array and is refused like any
 * other unknown value (AC-2).
 */
const readScope = (value: unknown): CourierScope => {
  if (value === undefined) {
    return "mine";
  }

  if (value === "mine" || value === "available") {
    return value;
  }

  throw new AppError(
    StatusCodes.UNPROCESSABLE_ENTITY,
    STAFF_ERROR_CODES.validation,
    "The scope is not one of the two lists.",
  );
};

export class CourierOrderController {
  async listCourierOrders(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedRequest;
      const answer = await service.listCourierOrders(
        userId,
        readScope(req.query.scope),
        req.query.page,
        req.query.limit,
      );

      res.status(StatusCodes.OK).json(answer);
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async claim(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedRequest;
      const answer = await service.claim(
        req.params.orderId as string,
        userId,
      );

      res.status(StatusCodes.OK).json(answer);
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async release(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedRequest;
      const answer = await service.release(
        req.params.orderId as string,
        userId,
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
      );

      res.status(StatusCodes.OK).json(answer);
    } catch (error) {
      handleErrors(res, error);
    }
  }
}
