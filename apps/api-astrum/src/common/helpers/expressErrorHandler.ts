import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  INVALID_JSON_CODE,
  INVALID_JSON_MESSAGE,
  PAYLOAD_TOO_LARGE_CODE,
  PAYLOAD_TOO_LARGE_MESSAGE,
} from "../constants/app.constants";
import { handleErrors } from "./errorHandler";

type BodyParserError = { type?: string };

const bodyParserType = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null
    ? (error as BodyParserError).type
    : undefined;

export const expressErrorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const type = bodyParserType(error);

  if (type === "entity.parse.failed") {
    res.status(StatusCodes.BAD_REQUEST).json({
      code: INVALID_JSON_CODE,
      message: INVALID_JSON_MESSAGE,
    });
    return;
  }

  if (type === "entity.too.large") {
    res.status(StatusCodes.REQUEST_TOO_LONG).json({
      code: PAYLOAD_TOO_LARGE_CODE,
      message: PAYLOAD_TOO_LARGE_MESSAGE,
    });
    return;
  }

  handleErrors(res, error);
};
