import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../../lib/prisma";
import { describeError } from "../common/helpers/describeError";
import { logger } from "../common/helpers/logger";
import type { AuthenticatedRequest } from "../common/types/jwt.payload";
import {
  ACCOUNT_ERROR_CODES,
  ACCOUNT_MESSAGES,
  ACCOUNT_STATUS_ACTIVE,
} from "./constants/account.constants";
import {
  SESSION_REFUSAL_CODES,
  SESSION_REFUSAL_MESSAGES,
} from "./constants/session.constants";
import { refuse, routeOf } from "./helpers/http.helpers";

export const requireActiveAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const route = routeOf(req);

  let status: string;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    if (!user) {
      logger.warn({ event: "account.status.missing", ...route, userId });
      refuse(
        res,
        StatusCodes.UNAUTHORIZED,
        SESSION_REFUSAL_CODES.revoked,
        SESSION_REFUSAL_MESSAGES.revoked,
      );
      return;
    }

    status = user.status;
  } catch (error) {
    logger.error({
      event: "account.status.unavailable",
      ...route,
      userId,
      reason: describeError(error),
    });
    refuse(
      res,
      StatusCodes.SERVICE_UNAVAILABLE,
      ACCOUNT_ERROR_CODES.statusUnavailable,
      ACCOUNT_MESSAGES.statusUnavailable,
    );
    return;
  }

  if (status !== ACCOUNT_STATUS_ACTIVE) {
    logger.warn({ event: "account.not_confirmed", ...route, userId });
    refuse(
      res,
      StatusCodes.FORBIDDEN,
      ACCOUNT_ERROR_CODES.emailNotConfirmed,
      ACCOUNT_MESSAGES.emailNotConfirmed,
    );
    return;
  }

  next();
};
