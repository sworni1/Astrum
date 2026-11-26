import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { describeError } from "../common/helpers/describeError";
import { logger } from "../common/helpers/logger";
import type {
  AuthenticatedRequest,
  JwtData,
} from "../common/types/jwt.payload";
import type { OwnerRequest } from "../common/types/owner";
import {
  loggedSid,
  sessionKey,
  sessionOwner,
} from "../session/helpers/session.helpers";
import type { SessionStore } from "../session/types/session.types";
import {
  SESSION_REFUSAL_CODES,
  SESSION_REFUSAL_MESSAGES,
} from "./constants/session.constants";
import { refuse, routeOf } from "./helpers/http.helpers";
import { authCookie, verifySessionToken } from "./helpers/token.helpers";

export const createOptionalAuth =
  (store: SessionStore) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = authCookie(req);

    if (!token) {
      next();
      return;
    }

    const route = routeOf(req);

    let decoded: JwtData;

    try {
      decoded = verifySessionToken(token);
    } catch (error) {
      logger.warn({
        event: "session.optional.refused",
        ...route,
        reason: describeError(error),
      });
      next();
      return;
    }

    const sid = decoded.sid;

    if (!sid) {
      logger.warn({
        event: "session.optional.refused",
        ...route,
        reason: "no_sid",
      });
      next();
      return;
    }

    let raw: string | null;

    try {
      raw = await store.get(sessionKey(sid));
    } catch (error) {
      logger.error({
        event: "session.store.error",
        ...route,
        reason: describeError(error),
      });
      next();
      return;
    }

    if (raw === null) {
      logger.warn({
        event: "session.optional.refused",
        ...route,
        reason: "no_record",
        sid: loggedSid(sid),
      });
      next();
      return;
    }

    const owner = sessionOwner(raw);

    if (!owner || owner !== decoded.userId) {
      logger.warn({
        event: "session.optional.refused",
        ...route,
        reason: "identity_mismatch",
        sid: loggedSid(sid),
      });
      next();
      return;
    }

    const authenticated = req as AuthenticatedRequest & OwnerRequest;
    authenticated.userId = decoded.userId;
    authenticated.sid = sid;
    authenticated.owner = { kind: "user", userId: decoded.userId };

    next();
  };

export const requireSession = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { userId } = req as Partial<AuthenticatedRequest>;

  if (!userId) {
    refuse(
      res,
      StatusCodes.UNAUTHORIZED,
      SESSION_REFUSAL_CODES.missing,
      SESSION_REFUSAL_MESSAGES.missing,
    );
    return;
  }

  next();
};
