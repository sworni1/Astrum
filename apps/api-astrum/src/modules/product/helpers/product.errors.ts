import { AppError } from "../../../common/helpers/appError";
import { PRODUCT_ERROR_CODES } from "../constants/product.constants";

export const sellerNotAssigned = (): AppError =>
  new AppError(
    403,
    PRODUCT_ERROR_CODES.sellerNotAssigned,
    "No business is assigned to this seller.",
  );

export const productNotFound = (): AppError =>
  new AppError(404, PRODUCT_ERROR_CODES.notFound, "Product not found");
