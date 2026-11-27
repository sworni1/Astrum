import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { createRateLimit } from "../rateLimit";

const createMockRes = (): jest.Mocked<Response> =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  }) as unknown as jest.Mocked<Response>;

const createMockReq = (ip: string): Request =>
  ({ ip }) as unknown as Request;

describe("createRateLimit", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("passes requests under the limit", () => {
    const limit = createRateLimit(2, 60_000);
    const res = createMockRes();
    const next = jest.fn() as NextFunction;

    limit(createMockReq("1.1.1.1"), res, next);
    limit(createMockReq("1.1.1.1"), res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("answers 429 with Retry-After once the window is full", () => {
    const limit = createRateLimit(1, 60_000);
    const res = createMockRes();
    const next = jest.fn() as NextFunction;

    limit(createMockReq("1.1.1.1"), res, next);
    limit(createMockReq("1.1.1.1"), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(StatusCodes.TOO_MANY_REQUESTS);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(res.json).toHaveBeenCalledWith({
      code: "RATE_LIMITED",
      message: expect.any(String),
    });
  });

  it("counts each address on its own", () => {
    const limit = createRateLimit(1, 60_000);
    const res = createMockRes();
    const next = jest.fn() as NextFunction;

    limit(createMockReq("1.1.1.1"), res, next);
    limit(createMockReq("2.2.2.2"), res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("stays off when RATE_LIMIT_ENABLED is false", () => {
    process.env.RATE_LIMIT_ENABLED = "false";
    const limit = createRateLimit(1, 60_000);
    const res = createMockRes();
    const next = jest.fn() as NextFunction;

    limit(createMockReq("1.1.1.1"), res, next);
    limit(createMockReq("1.1.1.1"), res, next);

    expect(next).toHaveBeenCalledTimes(2);
    delete process.env.RATE_LIMIT_ENABLED;
  });
});
