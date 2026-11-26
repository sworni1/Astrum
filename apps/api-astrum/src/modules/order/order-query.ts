import type { Prisma } from "@astrum/db/client";
import { AppError } from "../../common/helpers/appError";
import {
  ORDER_ERROR_CODES,
  ORDER_LIST_STATUS_FILTERS,
  ORDER_LIST_STATUSES,
  ORDER_SEARCH_MAX_LENGTH,
  type OrderListStatus,
} from "./constants/order.constants";
import { CANCELED_LINE_STATUSES } from "./constants/seller-order.constants";
import type { OrderListQuery } from "./types/order.types";
import type { SellerOrderQuery } from "./types/seller-order.types";

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

const readStatusFilter = (
  raw: unknown,
): Exclude<OrderListStatus, "ALL"> | undefined => {
  if (raw === undefined || raw === "") {
    return undefined;
  }

  if (Array.isArray(raw) || typeof raw !== "string") {
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

const readSearchQuery = (raw: unknown): string | undefined => {
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

export const parseOrderListQuery = (raw: {
  status?: unknown;
  q?: unknown;
}): OrderListQuery => {
  const status = readStatusFilter(raw.status);
  const q = readSearchQuery(raw.q);

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

export const parseSellerOrderQuery = (raw: {
  status?: unknown;
  q?: unknown;
}): SellerOrderQuery => {
  const status = readStatusFilter(raw.status);
  const q = readSearchQuery(raw.q);

  return {
    ...(status === undefined ? {} : { status }),
    ...(q === undefined ? {} : { q }),
  };
};

export const sellerOrderWhere = (
  userId: string,
  query: SellerOrderQuery,
): Prisma.OrderItemWhereInput => {
  const clauses: Prisma.OrderItemWhereInput[] = [];

  if (query.status === "DELIVERED") {
    clauses.push({ status: { in: ["DELIVERED", "ISSUED"] } });
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
