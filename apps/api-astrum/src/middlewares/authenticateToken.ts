import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { verify } from "jsonwebtoken";

import { logger } from "../common/helpers/logger";
import type {
  AuthenticatedRequest,
  JwtData,
} from "../common/types/jwt.payload";
import {
  loggedSid,
  type SessionStore,
  sessionKey,
} from "../session/sessionStore";

type RefusalCode =
  | "SESSION_MISSING"
  | "TOKEN_INVALID"
  | "SESSION_REVOKED"
  | "SESSION_STORE_UNAVAILABLE";

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const refuse = (res: Response, code: RefusalCode, message: string): void => {
  res.status(StatusCodes.UNAUTHORIZED).json({ code, message });
};

const sessionOwner = (raw: string): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }

    const { userId } = parsed as { userId?: unknown };

    return typeof userId === "string" ? userId : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The one guard every protected router inherits: the signature proves the token
 * was issued here, the store proves the session still exists, and the record
 * proves it belongs to the user in the token.
 */
export const createAuthenticateToken =
  (store: SessionStore) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = (req.cookies as { __auth?: string } | undefined)?.__auth;

    if (!token) {
      refuse(res, "SESSION_MISSING", "The session cookie is missing");
      return;
    }

    let decoded: JwtData;

    try {
      decoded = verify(token, process.env.JWT_SECRET as string) as JwtData;
    } catch {
      refuse(res, "TOKEN_INVALID", "Invalid or expired token");
      return;
    }

    const route = { method: req.method, path: `${req.baseUrl}${req.path}` };
    const sid = decoded.sid;

    if (!sid) {
      logger.warn({ event: "session.missing", reason: "no_sid", ...route });
      refuse(res, "SESSION_REVOKED", "The session is no longer valid");
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
        "SESSION_STORE_UNAVAILABLE",
        "The session store is unavailable",
      );
      return;
    }

    if (raw === null) {
      logger.warn({ event: "session.missing", ...route, sid: loggedSid(sid) });
      refuse(res, "SESSION_REVOKED", "The session is no longer valid");
      return;
    }

    const owner = sessionOwner(raw);

    if (!owner) {
      logger.warn({ event: "session.record.invalid", sid: loggedSid(sid) });
      refuse(res, "SESSION_REVOKED", "The session is no longer valid");
      return;
    }

    if (owner !== decoded.userId) {
      logger.warn({
        event: "session.identity.mismatch",
        ...route,
        sid: loggedSid(sid),
      });
      refuse(res, "SESSION_REVOKED", "The session is no longer valid");
      return;
    }

    const authenticated = req as AuthenticatedRequest;
    authenticated.userId = decoded.userId;
    authenticated.sid = sid;

    next();
  };
