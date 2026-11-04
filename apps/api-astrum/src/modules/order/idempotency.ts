import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/helpers/appError";
import { handleErrors } from "../../common/helpers/errorHandler";
import type { CreateOrderDto } from "./dto/create-order.dto";
import {
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_KEY_MIN_LENGTH,
  IDEMPOTENCY_KEY_PATTERN,
  ORDER_ERROR_CODES,
} from "./order.constants";

/** What a create answers with, so a repeat can be told from a new order. */
export type Idempotency = { key: string; hash: string };

type LineForFingerprint = { productId: string; quantity: number };

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

const invalidKeyError = (constraint: string) =>
  new AppError(
    422,
    ORDER_ERROR_CODES.validation,
    "The Idempotency-Key header is not valid.",
    { errors: [{ property: IDEMPOTENCY_HEADER, constraints: { matches: constraint } }] },
  );

/**
 * The header is optional, but a header that is present must be a token a client
 * can send again unchanged (AC-1, AC-4). The key is validated before any cart or
 * stock read, because `validateDto` only ever looks at the body.
 */
export const readIdempotencyKey = (
  headers: Request["headers"],
): string | undefined => {
  const raw = headers[IDEMPOTENCY_HEADER.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (value === undefined) {
    return undefined;
  }

  if (
    value.length < IDEMPOTENCY_KEY_MIN_LENGTH ||
    value.length > IDEMPOTENCY_KEY_MAX_LENGTH
  ) {
    throw invalidKeyError(
      `Idempotency-Key must be ${IDEMPOTENCY_KEY_MIN_LENGTH} to ${IDEMPOTENCY_KEY_MAX_LENGTH} characters long.`,
    );
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw invalidKeyError(
      "Idempotency-Key may only hold letters, digits, underscore and hyphen.",
    );
  }

  return value;
};

/**
 * Express middleware form of the reader, so a malformed key answers through the
 * single error shape instead of reaching the controller (AC-4).
 */
export const attachIdempotencyKey = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    res.locals.idempotencyKey = readIdempotencyKey(req.headers);
    next();
  } catch (error) {
    handleErrors(res, error);
  }
};

/**
 * A stable rendering of the order fields that decide identity: keys in a fixed
 * order, lines sorted by productId, and the delivery date normalised so `+03:00`
 * and `Z` bodies fingerprint alike (AC-2, AC-3).
 */
export const canonicalOrderBody = (
  dto: CreateOrderDto,
  lines: LineForFingerprint[],
): string =>
  JSON.stringify({
    deliveryAddress: dto.deliveryAddress,
    deliveryDate: new Date(dto.deliveryDate).toISOString(),
    items: [...lines]
      .sort((left, right) =>
        left.productId < right.productId
          ? -1
          : left.productId > right.productId
            ? 1
            : 0,
      )
      .map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      })),
    paymentDetails: dto.paymentDetails,
    paymentMethod: dto.paymentMethod,
    shippingMethodId: dto.shippingMethodId,
  });

export const hashOrderBody = (body: string): string =>
  createHash("sha256").update(body, "utf8").digest("hex");

/** The key plus the fingerprint of the body sent with it. */
export const idempotencyOf = (
  key: string,
  dto: CreateOrderDto,
  lines: LineForFingerprint[],
): Idempotency => ({
  key,
  hash: hashOrderBody(canonicalOrderBody(dto, lines)),
});
