import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import { ShippingService } from "./shipping.service";

const shippingService = new ShippingService();

export class ShippingController {
  async getShippingMethods(_req: Request, res: Response) {
    try {
      const methods = await shippingService.getMethodListJson();

      res.status(StatusCodes.OK).json(methods);
    } catch (error) {
      handleErrors(res, error);
    }
  }
}
