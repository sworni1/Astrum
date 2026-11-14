import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import { logger } from "../../common/helpers/logger";
import { PAYMENT_ERROR_CODES, isHandledEventType } from "./constants/payment.constants";
import { InvalidSignatureError } from "./payment.gateway";
import { paymentGateway } from "./payment.gateway.registry";
import { handleWebhookEvent } from "./payment.webhook.service";

const refused = (res: Response, status: number, code: string, message: string) => {
  res.status(status).json({ code, message });
};

const providerUnavailable = (res: Response): void =>
  refused(
    res,
    StatusCodes.SERVICE_UNAVAILABLE,
    PAYMENT_ERROR_CODES.providerUnavailable,
    "The payment provider is not configured on this gateway.",
  );

const readSignature = (req: Request): string | null => {
  const header = req.headers["stripe-signature"];
  const value = Array.isArray(header) ? header[0] : header;

  return value === undefined || value === "" ? null : value;
};

/**
 * The one public route of the feature. The signature is checked before any
 * database write, the body is the raw buffer because a parsed body cannot be
 * verified, and an unconfigured gateway writes nothing at all (AC-1, AC-5).
 */
export const handleStripeWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const gateway = paymentGateway();

  if (gateway === null) {
    providerUnavailable(res);
    return;
  }

  const signature = readSignature(req);

  if (signature === null) {
    refused(
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

    logger.info({ event: "payment.webhook.handled", type: event.type, outcome });

    res.status(StatusCodes.OK).json({ received: true });
  } catch (error) {
    if (error instanceof InvalidSignatureError) {
      refused(
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
