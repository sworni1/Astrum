import { AppError } from "../../../common/helpers/appError";
import { CART_ERROR_CODES } from "../constants/cart.constants";

export const quantityLimit = (): AppError =>
  new AppError(
    409,
    CART_ERROR_CODES.quantityLimit,
    "The requested quantity is above what is in stock.",
  );

export const cartItemNotFound = (): AppError =>
  new AppError(
    404,
    CART_ERROR_CODES.itemNotFound,
    "The cart has no line for this product.",
  );
