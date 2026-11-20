import type { Prisma } from "@astrum/db/client";
import type { OrderStatus } from "@astrum/db/enums";
import { AppError } from "../../common/helpers/appError";
import {
  ORDER_ERROR_CODES,
  ORDER_LIST_STATUSES,
  ORDER_LIST_STATUS_FILTERS,
  ORDER_SEARCH_MAX_LENGTH,
} from "./constants/order.constants";

export type OrderListQuery = { status?: OrderStatus; q?: string };

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

  const match = ORDER_LIST_STATUS_FILTERS.find((value) => value === raw);

  if (!match) {
    throw invalidStatus(raw);
  }

  return match;
};

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

export const orderListWhere = (
  userId: string,
  query: OrderListQuery,
): Prisma.OrderWhereInput => {
  const clauses: Prisma.OrderWhereInput[] = [];

  if (query.status === "DELIVERED") {
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
