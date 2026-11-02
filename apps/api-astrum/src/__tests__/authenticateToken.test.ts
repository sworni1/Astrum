import type { Request, Response, NextFunction } from "express";
import { StatusCodes, ReasonPhrases } from "http-status-codes";

const verifyMock = jest.fn();

jest.mock("jsonwebtoken", () => ({
  verify: (...args: unknown[]) => verifyMock(...args),
}));

// Устанавливаем JWT_SECRET ДО require, чтобы модуль прочитал актуальное значение.
// Но модуль читает process.env.JWT_SECRET ВНУТРИ функции (lazily), поэтому
// достаточно установить переменную до вызова middleware.
process.env.JWT_SECRET = "test-secret";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const authenticateToken = require("../middlewares/authenticateToken")
  .default as (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

const createMockReq = (cookies: unknown): Request =>
  ({ cookies } as unknown as Request);

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

describe("authenticateToken middleware", () => {
  beforeEach(() => {
    verifyMock.mockReset();
  });

  it("отвечает 401, если cookies нет или отсутствует __auth", () => {
    const res = createMockRes();
    const next = jest.fn();

    authenticateToken(createMockReq(undefined), res, next);
    authenticateToken(createMockReq({}), res, next);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({
      message: ReasonPhrases.UNAUTHORIZED,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("отвечает 401, если верификация токена бросает ошибку", () => {
    verifyMock.mockImplementationOnce(() => {
      throw new Error("invalid signature");
    });

    const res = createMockRes();
    const next = jest.fn();

    authenticateToken(createMockReq({ __auth: "broken-token" }), res, next);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid or expired token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("пропускает запрос дальше и подставляет userId в req при валидном токене", () => {
    verifyMock.mockReturnValueOnce({ userId: "user-123" });

    const res = createMockRes();
    const next = jest.fn();
    const req = createMockReq({ __auth: "good-token" });

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as unknown as { userId: string }).userId).toBe("user-123");
    expect(res.status).not.toHaveBeenCalled();
  });
});