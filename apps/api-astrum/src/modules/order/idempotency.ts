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
} from "./constants/order.constants";

export type Idempotency = { key: string; hash: string };

type LineForFingerprint = { productId: string; quantity: number };

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

const invalidKeyError = (constraint: string) =>
  new AppError(
    422,
    ORDER_ERROR_CODES.validation,
    "The Idempotency-Key header is not valid.",
    {
      errors: [
        { property: IDEMPOTENCY_HEADER, constraints: { matches: constraint } },
      ],
    },
  );

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

export const canonicalOrderBody = (
  dto: CreateOrderDto,
  lines: LineForFingerprint[],
): string =>
  JSON.stringify({
    deliveryAddress: dto.pickupPointId ? null : dto.deliveryAddress,
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
    paymentMethod: dto.paymentMethod,
    shippingMethodId: dto.shippingMethodId,
    ...(dto.pickupPointId ? { pickupPointId: dto.pickupPointId } : {}),
  });

export const hashOrderBody = (body: string): string =>
  createHash("sha256").update(body, "utf8").digest("hex");

export const idempotencyOf = (
  key: string,
  dto: CreateOrderDto,
  lines: LineForFingerprint[],
): Idempotency => ({
  key,
  hash: hashOrderBody(canonicalOrderBody(dto, lines)),
});
