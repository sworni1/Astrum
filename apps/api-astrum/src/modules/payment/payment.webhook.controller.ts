import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import { logger } from "../../common/helpers/logger";
import { PAYMENT_ERROR_CODES } from "./constants/payment.constants";
import { InvalidSignatureError } from "./helpers/payment.errors";
import { isHandledEventType } from "./helpers/payment.helpers";
import {
  readSignature,
  refuse,
  refuseProviderUnavailable,
} from "./helpers/payment.webhook.helpers";
import { paymentGateway } from "./payment.gateway.registry";
import { handleWebhookEvent } from "./payment.webhook.service";

export const handleStripeWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const gateway = paymentGateway();

  if (gateway === null) {
    refuseProviderUnavailable(res);
    return;
  }

  const signature = readSignature(req);

  if (signature === null) {
    refuse(
      res,
      StatusCodes.BAD_REQUEST,
      PAYMENT_ERROR_CODES.invalidSignature,
      "The signature of this callback is missing.",
    );
    return;
  }

  try {
    const event = gateway.constructEvent(req.body as Buffer, signature);

    if (!isHandledEventType(event.type)) {
      res.status(StatusCodes.OK).json({ received: true });
      return;
    }

    const outcome = await handleWebhookEvent(event);

    logger.info({
      event: "payment.webhook.handled",
      type: event.type,
      outcome,
    });

    res.status(StatusCodes.OK).json({ received: true });
  } catch (error) {
    if (error instanceof InvalidSignatureError) {
      refuse(
        res,
        StatusCodes.BAD_REQUEST,
        PAYMENT_ERROR_CODES.invalidSignature,
        error.message,
      );
      return;
    }

    handleErrors(res, error);
  }
};
