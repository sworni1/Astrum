import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import { toShippingMethodListJson } from "./shipping.mapper";
import { ShippingService } from "./shipping.service";

const shippingService = new ShippingService();

export class ShippingController {
  async getShippingMethods(_req: Request, res: Response) {
    try {
      const methods = await shippingService.getActiveMethods();

      res.status(StatusCodes.OK).json(toShippingMethodListJson(methods));
    } catch (error) {
      handleErrors(res, error);
    }
  }
}
