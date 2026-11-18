import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { verify } from "jsonwebtoken";

import { logger } from "../common/helpers/logger";
import type {
  AuthenticatedRequest,
  JwtData,
} from "../common/types/jwt.payload";
import type { OwnerRequest } from "../common/types/owner";
import { loggedSid, sessionKey, type SessionStore } from "../session/sessionStore";

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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
 * The same checks `authenticateToken` runs, but a request that fails any of them
 * continues as a visitor instead of being refused: a public catalogue read and
 * the guest cart mount answer everyone, and only the mark part is personal
 * (spec 0028, AC-2).
 */
export const createOptionalAuth =
  (store: SessionStore) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = (req.cookies as { __auth?: string } | undefined)?.__auth;

    if (!token) {
      next();
      return;
    }

    const route = { method: req.method, path: `${req.baseUrl}${req.path}` };

    let decoded: JwtData;

    try {
      decoded = verify(token, process.env.JWT_SECRET as string) as JwtData;
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
      logger.warn({ event: "session.optional.refused", ...route, reason: "no_sid" });
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

/**
 * A mount opened to visitors keeps every write behind the session (AC-6). Named
 * per route on purpose: without it `requireActiveAccount` would read an
 * undefined id and answer `503` instead of `401`.
 */
export const requireSession = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { userId } = req as Partial<AuthenticatedRequest>;

  if (!userId) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      code: "SESSION_MISSING",
      message: "The session cookie is missing",
    });
    return;
  }

  next();
};
