import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { PAYMENT_ERROR_CODES } from "../constants/payment.constants";

export const refuse = (
  res: Response,
  status: number,
  code: string,
  message: string,
): void => {
  res.status(status).json({ code, message });
};

export const refuseProviderUnavailable = (res: Response): void =>
  refuse(
    res,
    StatusCodes.SERVICE_UNAVAILABLE,
    PAYMENT_ERROR_CODES.providerUnavailable,
    "The payment provider is not configured on this gateway.",
  );

export const readSignature = (req: Request): string | null => {
  const header = req.headers["stripe-signature"];
  const value = Array.isArray(header) ? header[0] : header;

  return value === undefined || value === "" ? null : value;
};
