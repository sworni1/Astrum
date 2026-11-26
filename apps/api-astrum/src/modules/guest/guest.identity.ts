import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { sign, verify } from "jsonwebtoken";
import { logger } from "../../common/helpers/logger";
import type { Owner, OwnerRequest } from "../../common/types/owner";
import {
  GUEST_COOKIE_MAX_AGE_DAYS,
  GUEST_COOKIE_NAME,
  GUEST_TOKEN_TYPE,
} from "./constants/guest.constants";
import { cookieBase, describeError } from "./helpers/guest.helpers";

type GuestToken = { guestId: string; typ: string };

const route = (req: Request) => ({
  method: req.method,
  path: `${req.baseUrl}${req.path}`,
});

export const readGuestId = (req: Request): string | null => {
  const token = (req.cookies as { __guest?: string } | undefined)?.__guest;

  if (!token) {
    return null;
  }

  let decoded: Partial<GuestToken>;

  try {
    decoded = verify(token, process.env.JWT_SECRET as string) as GuestToken;
  } catch (error) {
    logger.warn({
      event: "guest.token.refused",
      ...route(req),
      reason: describeError(error),
    });

    return null;
  }

  if (decoded.typ !== GUEST_TOKEN_TYPE) {
    logger.warn({
      event: "guest.token.refused",
      ...route(req),
      reason: "wrong_type",
    });

    return null;
  }

  return typeof decoded.guestId === "string" ? decoded.guestId : null;
};

export const setGuestCookie = (res: Response, guestId: string): void => {
  const token = sign(
    { guestId, typ: GUEST_TOKEN_TYPE },
    process.env.JWT_SECRET as string,
    { expiresIn: `${GUEST_COOKIE_MAX_AGE_DAYS}d` },
  );

  res.cookie(GUEST_COOKIE_NAME, token, {
    ...cookieBase,
    maxAge: GUEST_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  });
};

export const clearGuestCookie = (res: Response): void => {
  res.clearCookie(GUEST_COOKIE_NAME, cookieBase);
};

export const ownerForWrite = (req: Request, res: Response): Owner => {
  const resolved = (req as OwnerRequest).owner;

  if (resolved) {
    return resolved;
  }

  const existing = readGuestId(req);

  if (existing) {
    return { kind: "guest", guestId: existing };
  }

  const guestId = randomUUID();

  setGuestCookie(res, guestId);

  return { kind: "guest", guestId };
};

export const ownerForRead = (req: Request): Owner | null => {
  const resolved = (req as OwnerRequest).owner;

  if (resolved) {
    return resolved;
  }

  const guestId = readGuestId(req);

  return guestId ? { kind: "guest", guestId } : null;
};
