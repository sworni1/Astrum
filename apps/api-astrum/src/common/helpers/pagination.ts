import type { AppError } from "./appError";

export const DEFAULT_PAGE_SIZE = 20;

export const MAX_PAGE_SIZE = 50;

export type InvalidPagination = () => AppError;

export const parsePaginationValue = (
  value: unknown,
  fallback: number,
  invalid: InvalidPagination,
): number => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
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
