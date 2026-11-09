import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import { SellerOnboardingService } from "./onboarding.service";

const service = new SellerOnboardingService();

const userIdOf = (req: Request): string =>
  (req as Request & { userId: string }).userId;

export class SellerOnboardingController {
  async createShop(req: Request, res: Response) {
    try {
      const result = await service.createShop(
        userIdOf(req),
        req.body.name as string,
      );

      res.status(StatusCodes.OK).json(result);
    } catch (error) {
      handleErrors(res, error);
    }
  }
}
