import { StatusCodes } from "http-status-codes";
import { AppError } from "../../../common/helpers/appError";
import { USER_ERROR_CODES } from "../constants/user.constants";

export const userNotFound = (): AppError =>
  new AppError(
    StatusCodes.NOT_FOUND,
    USER_ERROR_CODES.notFound,
    "User not found",
  );

export const invalidOldPassword = (): AppError =>
  new AppError(
    StatusCodes.UNAUTHORIZED,
    USER_ERROR_CODES.invalidOldPassword,
    "The old password is incorrect",
  );

export const deleteRestricted = (): AppError =>
  new AppError(
    StatusCodes.CONFLICT,
    USER_ERROR_CODES.deleteRestricted,
    "This account still owns records that have to be reassigned first",
  );

export const emailNotConfirmed = (): AppError =>
  new AppError(
    StatusCodes.FORBIDDEN,
    USER_ERROR_CODES.emailNotConfirmed,
    "Confirm the email address to change other profile fields",
  );

export const emailUnchanged = (): AppError =>
  new AppError(
    StatusCodes.BAD_REQUEST,
    USER_ERROR_CODES.emailUnchanged,
    "The address is already on your account",
  );

export const emailTaken = (): AppError =>
  new AppError(
    StatusCodes.CONFLICT,
    USER_ERROR_CODES.emailTaken,
    "The address belongs to another account",
  );
