import type { AppError } from "./appError";

/** The page size a read falls back on when the query names none (spec 0018, AC-3). */
export const DEFAULT_PAGE_SIZE = 20;

/** The ceiling every paged read clamps its limit to, so one call never reads a table. */
export const MAX_PAGE_SIZE = 50;

/**
 * The refusal a caller raises for a bad page or limit. The shared parser keeps no
 * code of its own, so this module never imports an error table from a module
 * folder and every answer belongs to the read that raised it (spec 0018, AC-3).
 */
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

/** One page of a list read: the page, the clamped limit, and the refusal of a bad pair. */
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
