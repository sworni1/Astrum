import { prisma } from "../../../lib/prisma";
import { parsePagination } from "../../common/helpers/pagination";
import {
  SELLER_LINE_SELECT,
  SELLER_TRANSACTION_OPTIONS,
} from "./constants/seller-order.constants";
import {
  invalidPagination,
  sellerNotAssigned,
} from "./helpers/order-errors.helpers";
import { sellerOrderWhere } from "./order-query";
import {
  toCounts,
  toSellerOrderLineJson,
  toStats,
} from "./seller-order.mapper";
import type {
  SellerAggregateRow,
  SellerOrderQuery,
  SellerSalesPage,
} from "./types/seller-order.types";

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
