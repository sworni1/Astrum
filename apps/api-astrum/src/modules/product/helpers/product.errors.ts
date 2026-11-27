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

export const invalidCursor = (): AppError =>
  new AppError(
    400,
    PRODUCT_ERROR_CODES.invalidCursor,
    "The cursor does not point at a product of this catalogue.",
  );

export const unknownCategory = (value: string): AppError =>
  new AppError(
    400,
    PRODUCT_ERROR_CODES.unknownCategory,
    `Unknown product category "${value}".`,
    { value },
  );

export const invalidQuery = (name: string): AppError =>
  new AppError(
    400,
    PRODUCT_ERROR_CODES.invalidQuery,
    `The ${name} parameter must carry a single value.`,
    { property: name },
  );
