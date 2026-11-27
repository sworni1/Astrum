import type { Response } from "express";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { AppError } from "./appError";
import { logger } from "./logger";

export const handleErrors = (res: Response, err: unknown): void => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message,
      ...err.details,
    });
    return;
  }

  logger.error({
    event: "request.failed",
    reason: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
};
