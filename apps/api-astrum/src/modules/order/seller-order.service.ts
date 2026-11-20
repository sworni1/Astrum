import type { Currency } from "@astrum/db/client";
import { Prisma } from "@astrum/db/client";
import type { OrderItemStatus } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { toMoney } from "../../common/helpers/money";
import { parsePagination } from "../../common/helpers/pagination";
import { ORDER_ERROR_CODES } from "./constants/order.constants";
import {
  CANCELED_LINE_STATUSES,
  sellerOrderWhere,
  type SellerOrderQuery,
} from "./seller-order-query";

const SELLER_LINE_SELECT = {
  id: true,
  orderId: true,
  productId: true,
  name: true,
  previewImage: true,
  quantity: true,
  price: true,
  currency: true,
  status: true,
  order: {
    select: {
      createdAt: true,
      pickupPointName: true,
      pickupPointAddress: true,
      handedOverAt: true,
      deliveryAddress: true,
      shippingMethod: { select: { isPickup: true } },
    },
  },
} as const;

export type SellerLineSource = Prisma.OrderItemGetPayload<{
  select: typeof SELLER_LINE_SELECT;
}>;

export type SellerLineJson = {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  previewImage: string;
  quantity: number;
  price: number;
  subtotal: number;
  currency: Currency;
  status: OrderItemStatus;
  createdAt: Date;
  isPickup: boolean;
  pickupPointName: string | null;
  pickupPointAddress: string | null;
  handedOverAt: Date | null;
  deliveryAddress: string | null;
};

export type SellerLineCounts = {
  all: number;
  delivered: number;
  canceled: number;
};

export type SellerRevenueRow = { currency: Currency; amount: number };

export type SellerSalesStats = {
  revenue: SellerRevenueRow[];
  units: number;
};

export type SellerSalesPage = {
  items: SellerLineJson[];
  counts: SellerLineCounts;
  stats: SellerSalesStats;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type SellerAggregateRow = {
  status: string;
  currency: Currency;
  count: number;
  units: string;
  revenue: string;
};

export const toSellerOrderLineJson = (row: SellerLineSource): SellerLineJson => ({
  id: row.id,
  orderId: row.orderId,
  productId: row.productId,
  name: row.name,
  previewImage: row.previewImage,
  quantity: row.quantity,
  price: toMoney(row.price),
  subtotal: toMoney(row.price.mul(row.quantity)),
  currency: row.currency,
  status: row.status,
  createdAt: row.order.createdAt,
  isPickup: row.order.shippingMethod.isPickup,
  pickupPointName: row.order.pickupPointName,
  pickupPointAddress: row.order.pickupPointAddress,
  handedOverAt: row.order.handedOverAt,
  deliveryAddress: row.order.deliveryAddress,
});

const countOf = (
  rows: SellerAggregateRow[],
  statuses: readonly string[],
): number =>
  rows
    .filter((row) => statuses.includes(row.status))
    .reduce((total, row) => total + row.count, 0);

const SOLD_LINE_STATUSES = ["DELIVERED", "ISSUED"] as const;

const toCounts = (rows: SellerAggregateRow[]): SellerLineCounts => ({
  all: rows.reduce((total, row) => total + row.count, 0),
  delivered: countOf(rows, SOLD_LINE_STATUSES),
  canceled: countOf(rows, CANCELED_LINE_STATUSES),
});

const toStats = (rows: SellerAggregateRow[]): SellerSalesStats => {
  const sold = rows.filter((row) =>
    SOLD_LINE_STATUSES.some((status) => status === row.status),
  );
  const byCurrency = new Map<Currency, number>();

  for (const row of sold) {
    byCurrency.set(
      row.currency,
      (byCurrency.get(row.currency) ?? 0) + Number(row.revenue),
    );
  }

  const revenue = [...byCurrency]
    .map(([currency, amount]) => ({ currency, amount: toMoney(amount) }))
    .sort((left, right) => left.currency.localeCompare(right.currency));

  return {
    revenue,
    units: sold.reduce((total, row) => total + Number(row.units), 0),
  };
};

const sellerNotAssigned = () =>
  new AppError(
    403,
    ORDER_ERROR_CODES.sellerNotAssigned,
    "No business is assigned to this seller.",
  );

const invalidPagination = () =>
  new AppError(422, ORDER_ERROR_CODES.validation, "Invalid pagination.");

const SELLER_TRANSACTION_OPTIONS = {
  maxWait: 5000,
  timeout: 10000,
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
} as const;

export class SellerOrderService {
  async getSellerOrders(
    userId: string,
    query: SellerOrderQuery = {},
    pageInput?: unknown,
    limitInput?: unknown,
  ): Promise<SellerSalesPage> {
    const { page, limit } = parsePagination(
      pageInput,
      limitInput,
      invalidPagination,
    );
    const business = await prisma.business.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });

    if (!business) {
      throw sellerNotAssigned();
    }

    const where = sellerOrderWhere(userId, query);
    const [total, rows, aggregate] = await prisma.$transaction(
      [
        prisma.orderItem.count({ where }),
        prisma.orderItem.findMany({
          where,
          orderBy: [{ order: { createdAt: "desc" } }, { id: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
          select: SELLER_LINE_SELECT,
        }),
        prisma.$queryRaw<SellerAggregateRow[]>`
          SELECT oi.status::text AS status,
                 oi.currency::text AS currency,
                 COUNT(*)::int AS count,
                 COALESCE(SUM(oi.quantity), 0)::numeric AS units,
                 COALESCE(SUM(oi.quantity * oi.price), 0)::numeric AS revenue
          FROM "OrderItem" oi
          JOIN "Business" b ON b.id = oi."businessId"
          WHERE b."ownerUserId" = ${userId}
          GROUP BY 1, 2
        `,
      ],
      SELLER_TRANSACTION_OPTIONS,
    );

    return {
      items: rows.map(toSellerOrderLineJson),
      counts: toCounts(aggregate),
      stats: toStats(aggregate),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
