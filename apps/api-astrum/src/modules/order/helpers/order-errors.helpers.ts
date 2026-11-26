import { StatusCodes } from "http-status-codes";
import { AppError } from "../../../common/helpers/appError";
import { ORDER_ERROR_CODES } from "../constants/order.constants";

export const orderNotFound = () =>
  new AppError(
    404,
    ORDER_ERROR_CODES.notFound,
    "Order not found for this customer.",
  );

export const idempotencyReused = () =>
  new AppError(
    409,
    ORDER_ERROR_CODES.idempotencyReused,
    "This idempotency key was already used for a different order. Submit again with a new key.",
  );

export const sellerNotAssigned = () =>
  new AppError(
    403,
    ORDER_ERROR_CODES.sellerNotAssigned,
    "No business is assigned to this seller.",
  );

export const invalidPagination = () =>
  new AppError(422, ORDER_ERROR_CODES.validation, "Invalid pagination.");

export const sellerPanelReadOnly = () =>
  new AppError(
    StatusCodes.NOT_FOUND,
    ORDER_ERROR_CODES.sellerPanelReadOnly,
    "Seller writes were removed; the panel is read only.",
  );
