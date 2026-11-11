import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import { PickupService } from "./pickup.service";

const pickupService = new PickupService();

export class PickupController {
  async getPickupPoints(_req: Request, res: Response) {
    try {
      const points = await pickupService.getActivePoints();

      res.status(StatusCodes.OK).json({ points });
    } catch (error) {
      handleErrors(res, error);
    }
  }
}
