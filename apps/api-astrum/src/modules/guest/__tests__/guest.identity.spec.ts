jest.mock("../../../common/helpers/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import type { Request, Response } from "express";
import { sign } from "jsonwebtoken";
import { logger } from "../../../common/helpers/logger";
import {
  GUEST_COOKIE_MAX_AGE_DAYS,
  GUEST_COOKIE_NAME,
} from "../constants/guest.constants";
import {
  clearGuestCookie,
  ownerForRead,
  ownerForWrite,
  readGuestId,
  setGuestCookie,
} from "../guest.identity";

const SECRET = "guest-spec-secret";

const request = (cookies: Record<string, string> = {}): Request =>
  ({ cookies, baseUrl: "/api/cart", path: "/", method: "POST" }) as Request;

const token = (payload: object, secret = SECRET, options = {}): string =>
  sign(payload, secret, options);

const response = (): { res: Response; cookie: jest.Mock; clear: jest.Mock } => {
  const cookie = jest.fn();
  const clear = jest.fn();

  return {
    res: { cookie, clearCookie: clear } as unknown as Response,
    cookie,
    clear,
  };
};

describe("guest identity", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  beforeEach(() => jest.clearAllMocks());

  it("reads the guest id out of its own token", () => {
    const value = token({ guestId: "guest-1", typ: "guest" });

    expect(readGuestId(request({ __guest: value }))).toBe("guest-1");
  });

  it("treats a modified, foreign and expired token as no cookie (AC-3)", () => {
    const valid = token({ guestId: "guest-1", typ: "guest" });
    const [head, payload, signature] = valid.split(".");
    const modified = `${head}.${payload}.${signature.slice(0, -1)}A`;
    const foreign = token({ guestId: "guest-1", typ: "guest" }, "another-secret");
    const expired = token(
      { guestId: "guest-1", typ: "guest", exp: Math.floor(Date.now() / 1000) - 60 },
      SECRET,
    );

    for (const value of [modified, foreign, expired]) {
      expect(readGuestId(request({ __guest: value }))).toBeNull();
    }

    expect(logger.warn).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "guest.token.refused",
        path: "/api/cart/",
      }),
    );
  });

  it("refuses an account token used as a guest token (AC-5)", () => {
    const authShaped = token({ userId: "user-1", sid: "sid-1" });

    expect(readGuestId(request({ __guest: authShaped }))).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "wrong_type" }),
    );
  });

  it("mints one identity on the first write and never renews it (AC-2)", () => {
    const first = response();
    const owner = ownerForWrite(request(), first.res);

    expect(owner).toEqual({ kind: "guest", guestId: expect.any(String) });
    expect(first.cookie).toHaveBeenCalledWith(
      GUEST_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: GUEST_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
      }),
    );

    const guestId = owner.kind === "guest" ? owner.guestId : "";
    const live = token({ guestId, typ: "guest" });
    const second = response();

    expect(ownerForWrite(request({ __guest: live }), second.res)).toEqual({
      kind: "guest",
      guestId,
    });

    expect(second.cookie).not.toHaveBeenCalled();
  });

  it("prefers the session over a stale guest cookie (AC-12)", () => {
    const live = token({ guestId: "guest-1", typ: "guest" });
    const req = request({ __guest: live });
    (req as unknown as { owner?: unknown }).owner = {
      kind: "user",
      userId: "user-1",
    };

    expect(ownerForRead(req)).toEqual({ kind: "user", userId: "user-1" });
  });

  it("answers no owner for a request with nothing to read (AC-6)", () => {
    expect(ownerForRead(request())).toBeNull();
  });

  it("sets and clears the cookie with the same attributes", () => {
    const { res, cookie, clear } = response();

    setGuestCookie(res, "guest-1");
    clearGuestCookie(res);

    const attributes = expect.objectContaining({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    expect(cookie).toHaveBeenCalledWith(
      GUEST_COOKIE_NAME,
      expect.any(String),
      attributes,
    );
    expect(clear).toHaveBeenCalledWith(GUEST_COOKIE_NAME, attributes);
  });
});
