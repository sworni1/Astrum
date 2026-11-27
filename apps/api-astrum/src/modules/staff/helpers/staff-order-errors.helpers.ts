import { AppError } from "../../../common/helpers/appError";
import { ORDER_ERROR_CODES } from "../../order/constants/order.constants";
import { STAFF_ERROR_CODES } from "../constants/staff.constants";

export const invalidPagination = (): AppError =>
  new AppError(422, STAFF_ERROR_CODES.validation, "Invalid pagination.");

export const orderNotFound = (): AppError =>
  new AppError(404, ORDER_ERROR_CODES.notFound, "Order not found.");

export const pointOrderNotFound = (): AppError =>
  new AppError(
    404,
    ORDER_ERROR_CODES.notFound,
    "Order not found at this pickup point.",
  );

export const alreadyHandedOver = (): AppError =>
  new AppError(
    409,
    STAFF_ERROR_CODES.alreadyHandedOver,
    "This order was already handed over.",
  );

export const alreadyClaimed = (): AppError =>
  new AppError(
    409,
    STAFF_ERROR_CODES.alreadyClaimed,
    "Another courier took this parcel.",
  );

export const orderNotDelivered = (): AppError =>
  new AppError(
    409,
    STAFF_ERROR_CODES.orderNotDelivered,
    "This order is not delivered yet.",
  );

export const nothingToCancel = (): AppError =>
  new AppError(
    409,
    STAFF_ERROR_CODES.nothingToCancel,
    "No line of this order can be cancelled.",
  );

export const pickupPointInactive = (): AppError =>
  new AppError(
    409,
    STAFF_ERROR_CODES.pickupPointInactive,
    "This pickup point is switched off.",
  );
