import { StatusCodes } from "http-status-codes";
import { AppError } from "../../../common/helpers/appError";
import { USER_ERROR_CODES } from "../constants/user.constants";

export const userNotFound = (): Error => new Error("User not found");

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
