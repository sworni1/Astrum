import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import type { SessionStore } from "../../session/sessionStore";

const verifyMock = jest.fn();

jest.mock("jsonwebtoken", () => ({
  verify: (...args: unknown[]) => verifyMock(...args),
}));

process.env.JWT_SECRET = "test-secret";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createAuthenticateToken } =
  require("../authenticateToken") as {
    createAuthenticateToken: (
      store: SessionStore,
    ) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
  };

const createStore = (): SessionStore & {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  ping: jest.Mock;
} => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  ping: jest.fn(),
});

const createMockReq = (cookies: unknown): Request =>
  ({
    cookies,
    method: "GET",
    baseUrl: "/api/users",
    path: "/me",
  }) as unknown as Request;

const createMockRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
};

const recordOf = (userId: string): string =>
  JSON.stringify({
    userId,
    createdAt: "2026-11-04T10:00:00.000Z",
    userAgent: null,
  });

describe("authenticateToken middleware", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    verifyMock.mockReset();
  });

  const run = async (req: Request, res: Response, next: NextFunction) => {
    await createAuthenticateToken(store)(req, res, next);
  };

  it("AC-2: отвечает 401 SESSION_MISSING без cookie и не читает хранилище", async () => {
    const res = createMockRes();
    const next = jest.fn();

    await run(createMockReq(undefined), res, next);
    await run(createMockReq({}), res, next);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({
      code: "SESSION_MISSING",
      message: expect.any(String),
    });
    expect(store.get).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("AC-2: отвечает 401 TOKEN_INVALID, когда подпись не сходится", async () => {
    verifyMock.mockImplementationOnce(() => {
      throw new Error("invalid signature");
    });

    const res = createMockRes();
    const next = jest.fn();

    await run(createMockReq({ __auth: "broken-token" }), res, next);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({
      code: "TOKEN_INVALID",
      message: expect.any(String),
    });
    expect(store.get).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("AC-10: токен без sid отказывается как SESSION_REVOKED, хранилище не читается", async () => {
    verifyMock.mockReturnValueOnce({ userId: "user-123" });

    const res = createMockRes();
    const next = jest.fn();

    await run(createMockReq({ __auth: "old-token" }), res, next);

    expect(res.json).toHaveBeenCalledWith({
      code: "SESSION_REVOKED",
      message: expect.any(String),
    });
    expect(store.get).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("AC-2: отсутствующая запись сессии отказывается как SESSION_REVOKED", async () => {
    verifyMock.mockReturnValueOnce({ userId: "user-123", sid: "sid-abc" });
    store.get.mockResolvedValueOnce(null);

    const res = createMockRes();
    const next = jest.fn();

    await run(createMockReq({ __auth: "good-token" }), res, next);

    expect(store.get).toHaveBeenCalledWith("session:sid-abc");
    expect(res.json).toHaveBeenCalledWith({
      code: "SESSION_REVOKED",
      message: expect.any(String),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("AC-2: живая сессия пропускает запрос и отдаёт userId и sid", async () => {
    verifyMock.mockReturnValueOnce({ userId: "user-123", sid: "sid-abc" });
    store.get.mockResolvedValueOnce(recordOf("user-123"));

    const res = createMockRes();
    const next = jest.fn();
    const req = createMockReq({ __auth: "good-token" });

    await run(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as unknown as { userId: string }).userId).toBe("user-123");
    expect((req as unknown as { sid: string }).sid).toBe("sid-abc");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("AC-3: чужой userId в записи отказывается, запись остаётся на месте", async () => {
    verifyMock.mockReturnValueOnce({ userId: "user-123", sid: "sid-abc" });
    store.get.mockResolvedValueOnce(recordOf("user-999"));

    const res = createMockRes();
    const next = jest.fn();

    await run(createMockReq({ __auth: "good-token" }), res, next);

    expect(res.json).toHaveBeenCalledWith({
      code: "SESSION_REVOKED",
      message: expect.any(String),
    });
    expect(store.del).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("AC-7: сбой хранилища отказывается как SESSION_STORE_UNAVAILABLE, не 5xx", async () => {
    verifyMock.mockReturnValueOnce({ userId: "user-123", sid: "sid-abc" });
    store.get.mockRejectedValueOnce(new Error("connection refused"));

    const res = createMockRes();
    const next = jest.fn();

    await run(createMockReq({ __auth: "good-token" }), res, next);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({
      code: "SESSION_STORE_UNAVAILABLE",
      message: expect.any(String),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("AC-7: нечитаемая запись считается отозванной сессией", async () => {
    verifyMock.mockReturnValueOnce({ userId: "user-123", sid: "sid-abc" });
    store.get.mockResolvedValueOnce("not json");

    const res = createMockRes();
    const next = jest.fn();

    await run(createMockReq({ __auth: "good-token" }), res, next);

    expect(res.json).toHaveBeenCalledWith({
      code: "SESSION_REVOKED",
      message: expect.any(String),
    });
    expect(next).not.toHaveBeenCalled();
  });
});
