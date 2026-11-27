import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_CODE,
  RATE_LIMIT_GLOBAL_MAX,
  RATE_LIMIT_MESSAGE,
  RATE_LIMIT_WINDOW_MS,
} from "./constants/rate-limit.constants";

type Bucket = { count: number; resetAt: number };

const isEnabled = (): boolean =>
  process.env.NODE_ENV !== "test" && process.env.RATE_LIMIT_ENABLED !== "false";

export const createRateLimit = (max: number, windowMs: number) => {
  const buckets = new Map<string, Bucket>();
  let lastPrune = Date.now();

  const prune = (now: number): void => {
    if (now - lastPrune < windowMs) {
      return;
    }

    lastPrune = now;

    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isEnabled()) {
      next();
      return;
    }

    const now = Date.now();

    prune(now);

    const key = req.ip ?? "unknown";
    const bucket = buckets.get(key);

    if (bucket === undefined || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= max) {
      res.setHeader(
        "Retry-After",
        String(Math.ceil((bucket.resetAt - now) / 1000)),
      );
      res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        code: RATE_LIMIT_CODE,
        message: RATE_LIMIT_MESSAGE,
      });
      return;
    }

    bucket.count += 1;
    next();
  };
};

export const rateLimitGlobal = createRateLimit(
  RATE_LIMIT_GLOBAL_MAX,
  RATE_LIMIT_WINDOW_MS,
);

export const rateLimitAuth = createRateLimit(
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_WINDOW_MS,
);
