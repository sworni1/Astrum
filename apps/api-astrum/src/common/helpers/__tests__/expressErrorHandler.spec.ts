import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../appError";
import { expressErrorHandler } from "../expressErrorHandler";

const createMockRes = (headersSent = false): jest.Mocked<Response> =>
  ({
    headersSent,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }) as unknown as jest.Mocked<Response>;

const run = (
  error: unknown,
  res: jest.Mocked<Response>,
): { next: NextFunction } => {
  const next = jest.fn() as NextFunction;

  expressErrorHandler(error, {} as Request, res, next);

  return { next };
};

describe("expressErrorHandler", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("answers a JSON 400 for a malformed body", () => {
    const res = createMockRes();

    run({ type: "entity.parse.failed" }, res);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith({
      code: "INVALID_JSON",
      message: expect.any(String),
    });
  });

  it("answers a JSON 413 for an oversized body", () => {
    const res = createMockRes();

    run({ type: "entity.too.large" }, res);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.REQUEST_TOO_LONG);
    expect(res.json).toHaveBeenCalledWith({
      code: "PAYLOAD_TOO_LARGE",
      message: expect.any(String),
    });
  });

  it("keeps the single error shape for an AppError", () => {
    const res = createMockRes();

    run(new AppError(409, "SOME_CODE", "Some message"), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      code: "SOME_CODE",
      message: "Some message",
    });
  });

  it("hands the error on when the response already started", () => {
    const res = createMockRes(true);
    const { next } = run(new Error("late"), res);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalled();
  });
});
