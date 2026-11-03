import type { Response } from "express";
import { ReasonPhrases, StatusCodes } from "http-status-codes";

export const handleErrors = (res: Response, err: unknown): void => {
  if (err instanceof Error) {
    res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
  } else {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
  }
};
