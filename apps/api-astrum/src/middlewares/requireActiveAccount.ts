import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../../lib/prisma";
import { logger } from "../common/helpers/logger";
import type { AuthenticatedRequest } from "../common/types/jwt.payload";

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const refuse = (
  res: Response,
  status: number,
  code: string,
  message: string,
) => {
  res.status(status).json({ code, message });
};

/**
 * The authorisation rule of the account state: writes stay closed until the
 * address is confirmed. The answer comes from the `status` column by primary
 * key on every call, so no cache can go stale and a confirmation made in one
 * browser unlocks the account everywhere at once. A read that fails is a 503,
 * never a 403: an outage must not read as "your address is unconfirmed".
 */
export const requireActiveAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const route = { method: req.method, path: `${req.baseUrl}${req.path}` };

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
        "SESSION_REVOKED",
        "The session is no longer valid",
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
      "ACCOUNT_STATUS_UNAVAILABLE",
      "The account status could not be read",
    );
    return;
  }

  if (status !== "ACTIVE") {
    logger.warn({ event: "account.not_confirmed", ...route, userId });
    refuse(
      res,
      StatusCodes.FORBIDDEN,
      "EMAIL_NOT_CONFIRMED",
      "Confirm the email address to continue",
    );
    return;
  }

  next();
};
