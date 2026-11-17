import type { Prisma } from "../../../generated/prisma/client";
import type { OrderItemStatus } from "../../../generated/prisma/enums";
import { AppError } from "../../common/helpers/appError";
import {
  ORDER_ERROR_CODES,
  ORDER_LIST_STATUSES,
  ORDER_SEARCH_MAX_LENGTH,
  type OrderListStatus,
} from "./constants/order.constants";

/** What the seller list read receives once the wire values are validated (spec 0026, AC-2). */
export type SellerOrderQuery = {
  status?: Exclude<OrderListStatus, "ALL">;
  q?: string;
};

/** An out of stock line is a lost sale the seller reads as canceled. */
export const CANCELED_LINE_STATUSES: readonly OrderItemStatus[] = [
  "CANCELLED",
  "OUT_OF_STOCK",
];

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
const readStatus = (raw: unknown): SellerOrderQuery["status"] => {
  if (raw === undefined || raw === "") {
    return undefined;
  }

  if (Array.isArray(raw) || typeof raw !== "string") {
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

  if (Array.isArray(raw) || typeof raw !== "string") {
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
 * Turns the two raw query values into the filters the seller read understands.
 * Every refusal is a `400` with its own code, so the storefront can branch on it
 * (spec 0026, AC-2).
 */
export const parseSellerOrderQuery = (raw: {
  status?: unknown;
  q?: unknown;
}): SellerOrderQuery => {
  const status = readStatus(raw.status);
  const q = readQuery(raw.q);

  return {
    ...(status === undefined ? {} : { status }),
    ...(q === undefined ? {} : { q }),
  };
};

/**
 * The status filter and the search combine through one `AND` array, never through
 * two sibling `OR` keys in one object, which would silently replace each other
 * (spec 0026, AC-2). Every clause reads the line's own columns, so the search
 * costs no join.
 */
export const sellerOrderWhere = (
  userId: string,
  query: SellerOrderQuery,
): Prisma.OrderItemWhereInput => {
  const clauses: Prisma.OrderItemWhereInput[] = [];

  if (query.status === "DELIVERED") {
    clauses.push({ status: "DELIVERED" });
  }

  if (query.status === "CANCELED") {
    clauses.push({ status: { in: [...CANCELED_LINE_STATUSES] } });
  }

  if (query.q !== undefined) {
    clauses.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { orderId: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }

  const ownership = { business: { is: { ownerUserId: userId } } };

  return clauses.length === 0 ? ownership : { ...ownership, AND: clauses };
};
