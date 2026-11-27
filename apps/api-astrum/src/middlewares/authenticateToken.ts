import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { describeError } from "../common/helpers/describeError";
import { logger } from "../common/helpers/logger";
import type {
  AuthenticatedRequest,
  JwtData,
} from "../common/types/jwt.payload";
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

export const createAuthenticateToken =
  (store: SessionStore) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = authCookie(req);

    if (!token) {
      refuse(
        res,
        StatusCodes.UNAUTHORIZED,
        SESSION_REFUSAL_CODES.missing,
        SESSION_REFUSAL_MESSAGES.missing,
      );
      return;
    }

    let decoded: JwtData;

    try {
      decoded = verifySessionToken(token);
    } catch {
      refuse(
        res,
        StatusCodes.UNAUTHORIZED,
        SESSION_REFUSAL_CODES.tokenInvalid,
        SESSION_REFUSAL_MESSAGES.tokenInvalid,
      );
      return;
    }

    const route = routeOf(req);
    const sid = decoded.sid;

    if (!sid) {
      logger.warn({ event: "session.missing", reason: "no_sid", ...route });
      refuse(
        res,
        StatusCodes.UNAUTHORIZED,
        SESSION_REFUSAL_CODES.revoked,
        SESSION_REFUSAL_MESSAGES.revoked,
      );
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
      refuse(
        res,
        StatusCodes.UNAUTHORIZED,
        SESSION_REFUSAL_CODES.storeUnavailable,
        SESSION_REFUSAL_MESSAGES.storeUnavailable,
      );
      return;
    }

    if (raw === null) {
      logger.warn({ event: "session.missing", ...route, sid: loggedSid(sid) });
      refuse(
        res,
        StatusCodes.UNAUTHORIZED,
        SESSION_REFUSAL_CODES.revoked,
        SESSION_REFUSAL_MESSAGES.revoked,
      );
      return;
    }

    const owner = sessionOwner(raw);

    if (!owner) {
      logger.warn({ event: "session.record.invalid", sid: loggedSid(sid) });
      refuse(
        res,
        StatusCodes.UNAUTHORIZED,
        SESSION_REFUSAL_CODES.revoked,
        SESSION_REFUSAL_MESSAGES.revoked,
      );
      return;
    }

    if (owner !== decoded.userId) {
      logger.warn({
        event: "session.identity.mismatch",
        ...route,
        sid: loggedSid(sid),
      });
      refuse(
        res,
        StatusCodes.UNAUTHORIZED,
        SESSION_REFUSAL_CODES.revoked,
        SESSION_REFUSAL_MESSAGES.revoked,
      );
      return;
    }

    const authenticated = req as AuthenticatedRequest;
    authenticated.userId = decoded.userId;
    authenticated.sid = sid;

    next();
  };
