import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

const findUniqueMock = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { requireActiveAccount } = require("../middlewares/requireActiveAccount") as {
  requireActiveAccount: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void>;
};

const createMockReq = (): Request =>
  ({
    method: "POST",
    baseUrl: "/api/orders",
    path: "/",
    userId: "user-123",
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

describe("requireActiveAccount", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("AC-9: ACTIVE аккаунт проходит дальше", async () => {
    findUniqueMock.mockResolvedValue({ status: "ACTIVE" });
    const next = jest.fn();

    await requireActiveAccount(createMockReq(), createMockRes(), next);

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: { status: true },
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("AC-9: PENDING аккаунт получает 403 EMAIL_NOT_CONFIRMED, обработчик не вызывается", async () => {
    findUniqueMock.mockResolvedValue({ status: "PENDING" });
    const res = createMockRes();
    const next = jest.fn();

    await requireActiveAccount(createMockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
    expect(res.json).toHaveBeenCalledWith({
      code: "EMAIL_NOT_CONFIRMED",
      message: expect.any(String),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("AC-10: сбой чтения статуса отвечает 503, а не 403", async () => {
    findUniqueMock.mockRejectedValue(new Error("connection refused"));
    const res = createMockRes();
    const next = jest.fn();

    await requireActiveAccount(createMockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.json).toHaveBeenCalledWith({
      code: "ACCOUNT_STATUS_UNAVAILABLE",
      message: expect.any(String),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("AC-10: удалённый пользователь не проходит гейт", async () => {
    findUniqueMock.mockResolvedValue(null);
    const res = createMockRes();
    const next = jest.fn();

    await requireActiveAccount(createMockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(next).not.toHaveBeenCalled();
  });
});
