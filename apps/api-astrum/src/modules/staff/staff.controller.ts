import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import type { AuthenticatedRequest } from "../../common/types/jwt.payload";
import { StaffService } from "./staff.service";

const service = new StaffService();

export class StaffController {
  async grantPointWorker(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedRequest;
      const answer = await service.grantPointWorker(
        userId,
        req.body.pickupPointId as string,
      );

      res.status(StatusCodes.OK).json(answer);
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async grantCourier(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedRequest;
      const answer = await service.grantCourier(userId);

      res.status(StatusCodes.OK).json(answer);
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async movePoint(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedRequest;
      const answer = await service.movePoint(
        userId,
        req.body.pickupPointId as string,
      );

      res.status(StatusCodes.OK).json(answer);
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async readPoint(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedRequest;
      const answer = await service.readPoint(userId);

      res.status(StatusCodes.OK).json(answer);
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async readCourier(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedRequest;
      const answer = await service.readCourier(userId);

      res.status(StatusCodes.OK).json(answer);
    } catch (error) {
      handleErrors(res, error);
    }
  }
}
