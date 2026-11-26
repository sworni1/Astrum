import { AppError } from "../../../common/helpers/appError";
import { ORDER_ERROR_CODES } from "../../order/constants/order.constants";
import { PAYMENT_ERROR_CODES } from "../constants/payment.constants";

export const orderNotFound = (): AppError =>
  new AppError(
    404,
    ORDER_ERROR_CODES.notFound,
    "Order not found for this customer.",
  );

export const notPayable = (): AppError =>
  new AppError(
    409,
    PAYMENT_ERROR_CODES.notPayable,
    "Only an online card order can be paid from this screen.",
  );

export const alreadyPaid = (): AppError =>
  new AppError(
    409,
    PAYMENT_ERROR_CODES.alreadyPaid,
    "This order is already paid.",
  );

export const windowExpired = (): AppError =>
  new AppError(
    409,
    PAYMENT_ERROR_CODES.windowExpired,
    "The payment window of this order has closed.",
  );

export const providerUnavailable = (): AppError =>
  new AppError(
    502,
    PAYMENT_ERROR_CODES.providerUnavailable,
    "The payment provider is not reachable right now.",
  );

export class InvalidSignatureError extends Error {
  constructor() {
    super("The signature of this callback is not valid.");
    this.name = "InvalidSignatureError";
  }
}

export class IdempotencyKeyReusedError extends Error {
  constructor(key: string) {
    super(
      `The provider refused the idempotency key ${key} for another payload.`,
    );
    this.name = "IdempotencyKeyReusedError";
  }
}
