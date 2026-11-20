import type { Prisma } from "@astrum/db/client";
import type { OrderItemStatus } from "@astrum/db/enums";
import { AppError } from "../../common/helpers/appError";
import {
  ORDER_ERROR_CODES,
  ORDER_LIST_STATUSES,
  ORDER_LIST_STATUS_FILTERS,
  ORDER_SEARCH_MAX_LENGTH,
  type OrderListStatus,
} from "./constants/order.constants";

export type SellerOrderQuery = {
  status?: Exclude<OrderListStatus, "ALL">;
  q?: string;
};

export const CANCELED_LINE_STATUSES: readonly OrderItemStatus[] = [
  "CANCELLED",
  "OUT_OF_STOCK",
];

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
