import type { Currency } from "../../../generated/prisma/client";
import { Prisma } from "../../../generated/prisma/client";
import type { OrderItemStatus } from "../../../generated/prisma/enums";
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

/** One line as the read promises it: the six columns plus the order facts it repeats. */
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

/** One group of the status and currency aggregate, as Postgres hands it back. */
type SellerAggregateRow = {
  status: string;
  currency: Currency;
  count: number;
  units: string;
  revenue: string;
};

/**
 * The line flattens its parent order into the row and computes its own subtotal,
 * so the browser never multiplies money (spec 0026, AC-3).
 */
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

/** The counts describe every line of the seller, never the filtered page (AC-4). */
const toCounts = (rows: SellerAggregateRow[]): SellerLineCounts => ({
  all: rows.reduce((total, row) => total + row.count, 0),
  delivered: countOf(rows, ["DELIVERED"]),
  canceled: countOf(rows, CANCELED_LINE_STATUSES),
});

/** Revenue and units come from the delivered lines only, per currency (AC-5). */
const toStats = (rows: SellerAggregateRow[]): SellerSalesStats => {
  const delivered = rows.filter((row) => row.status === "DELIVERED");
  const byCurrency = new Map<Currency, number>();

  for (const row of delivered) {
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
    units: delivered.reduce((total, row) => total + Number(row.units), 0),
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

/**
 * All three reads share one snapshot: `ReadCommitted` gives every statement its
 * own, so a line status change committing between the list and the aggregate
 * could print a tile that contradicts the list (spec 0026, AC-1).
 */
const SELLER_TRANSACTION_OPTIONS = {
  maxWait: 5000,
  timeout: 10000,
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
} as const;

/**
 * The seller read and nothing else: a shop owner watches their own lines and
 * holds no authority over a parcel any more, so this service cannot write (spec
 * 0020). Nothing here touches an order row, which is why the route needs no
 * account gate.
 */
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
