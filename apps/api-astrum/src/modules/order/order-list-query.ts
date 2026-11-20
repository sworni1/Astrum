import type { Prisma } from "@astrum/db/client";
import type { OrderStatus } from "@astrum/db/enums";
import { AppError } from "../../common/helpers/appError";
import {
  ORDER_ERROR_CODES,
  ORDER_LIST_STATUSES,
  ORDER_SEARCH_MAX_LENGTH,
  type OrderListStatus,
} from "./constants/order.constants";

/** What the list read receives once the wire values are validated (spec 0025, AC-2). */
export type OrderListQuery = { status?: OrderStatus; q?: string };

const STATUS_FILTERS = ORDER_LIST_STATUSES.filter(
  (value): value is Exclude<OrderListStatus, "ALL"> => value !== "ALL",
);

const invalidStatus = (value: unknown): AppError =>
  new AppError(
    400,
    ORDER_ERROR_CODES.invalidStatusFilter,
    `The status filter accepts ${ORDER_LIST_STATUSES.join(", ")}.`,
    { value: typeof value === "string" ? value : null },
  );

const repeatedParameter = (name: string): AppError =>
  new AppError(
    400,
    ORDER_ERROR_CODES.validation,
    `The ${name} parameter must carry a single value.`,
  );

const tooLongQuery = (): AppError =>
  new AppError(
    400,
    ORDER_ERROR_CODES.searchQueryTooLong,
    `The search query cannot be longer than ${ORDER_SEARCH_MAX_LENGTH} characters.`,
  );

/** `ALL`, an absent value and an empty string all mean "no status filter". */
const readStatus = (raw: unknown): OrderStatus | undefined => {
  if (raw === undefined || raw === "") {
    return undefined;
  }

  if (Array.isArray(raw)) {
    throw invalidStatus(raw);
  }

  if (typeof raw !== "string") {
    throw invalidStatus(raw);
  }

  if (raw === "ALL") {
    return undefined;
  }

  const match = STATUS_FILTERS.find((value) => value === raw);

  if (!match) {
    throw invalidStatus(raw);
  }

  return match;
};

/** The query is trimmed once, so a trailing space is neither a filter nor a length. */
const readQuery = (raw: unknown): string | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  if (Array.isArray(raw)) {
    throw repeatedParameter("q");
  }

  if (typeof raw !== "string") {
    throw repeatedParameter("q");
  }

  const trimmed = raw.trim();

  if (trimmed === "") {
    return undefined;
  }

  if (trimmed.length > ORDER_SEARCH_MAX_LENGTH) {
    throw tooLongQuery();
  }

  return trimmed;
};

/**
 * Turns the two raw query values into the filters the read understands. Every
 * refusal is a `400` with its own code, so the storefront can branch on it
 * (spec 0025, AC-2).
 */
export const parseOrderListQuery = (raw: {
  status?: unknown;
  q?: unknown;
}): OrderListQuery => {
  const status = readStatus(raw.status);
  const q = readQuery(raw.q);

  return {
    ...(status === undefined ? {} : { status }),
    ...(q === undefined ? {} : { q }),
  };
};

/**
 * The status filter and the search combine through one `AND` array: two sibling
 * `OR` keys in one object would silently replace each other (spec 0025, AC-3).
 */
export const orderListWhere = (
  userId: string,
  query: OrderListQuery,
): Prisma.OrderWhereInput => {
  const clauses: Prisma.OrderWhereInput[] = [];

  if (query.status === "DELIVERED") {
    // The buyer reads one bucket for an arrived parcel, issued or not (spec
    // 0031, AC-8).
    clauses.push({ status: { in: ["DELIVERED", "ISSUED"] } });
  } else if (query.status !== undefined) {
    clauses.push({ status: query.status });
  }

  if (query.q !== undefined) {
    clauses.push({
      OR: [
        { id: { contains: query.q, mode: "insensitive" } },
        {
          OrderItem: {
            some: { name: { contains: query.q, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  return clauses.length === 0 ? { userId } : { userId, AND: clauses };
};
