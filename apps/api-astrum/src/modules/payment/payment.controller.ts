import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import { paymentService } from "./payment.service";

const userIdOf = (req: Request): string =>
  (req as Request & { userId: string }).userId;

const orderIdOf = (req: Request): string => req.params.orderId as string;

/** The two provider routes that sit behind the order mount and its token (AC-4, AC-10). */
export class PaymentController {
  async startPayment(req: Request, res: Response) {
    try {
      const result = await paymentService.startPayment(
        orderIdOf(req),
        userIdOf(req),
      );

      res.status(result.created ? StatusCodes.CREATED : StatusCodes.OK).json({
        url: result.url,
        expiresAt: result.expiresAt.toISOString(),
      });
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async syncPayment(req: Request, res: Response) {
    try {
      const result = await paymentService.syncPayment(
        orderIdOf(req),
        userIdOf(req),
      );

      res.status(StatusCodes.OK).json({
        ...result,
        paymentExpiresAt: result.paymentExpiresAt?.toISOString() ?? null,
      });
    } catch (error) {
      handleErrors(res, error);
    }
  }
}
