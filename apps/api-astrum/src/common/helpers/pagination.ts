import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PAGE_VALUE_PATTERN,
} from "../constants/pagination.constants";
import type { AppError } from "./appError";

export type InvalidPagination = () => AppError;

export const parsePaginationValue = (
  value: unknown,
  fallback: number,
  invalid: InvalidPagination,
): number => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || !PAGE_VALUE_PATTERN.test(value)) {
    throw invalid();
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw invalid();
  }

  return parsed;
};

export const parsePagination = (
  pageInput: unknown,
  limitInput: unknown,
  invalid: InvalidPagination,
): { page: number; limit: number } => {
  const page = parsePaginationValue(pageInput, 1, invalid);
  const limit = Math.min(
    parsePaginationValue(limitInput, DEFAULT_PAGE_SIZE, invalid),
    MAX_PAGE_SIZE,
  );

  if (!Number.isSafeInteger((page - 1) * limit)) {
    throw invalid();
  }

  return { page, limit };
};
