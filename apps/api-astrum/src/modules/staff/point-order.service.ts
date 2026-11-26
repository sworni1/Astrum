import { prisma } from "../../../lib/prisma";
import { logger } from "../../common/helpers/logger";
import { parsePagination } from "../../common/helpers/pagination";
import { invalidateStockOfProducts } from "../order/order-cache";
import { ORDER_TRANSACTION_OPTIONS } from "../order/order-status";
import { expireSessionForCancel } from "../payment/payment.cancel";
import { POINT_ORDER_SELECT } from "./constants/point-order.constants";
import { toPointOrderJson } from "./helpers/point-order.helpers";
import { logWriteRefusal } from "./helpers/staff-order.helpers";
import {
  invalidPagination,
  pointOrderNotFound,
} from "./helpers/staff-order-errors.helpers";
import { cancelPointOrder } from "./point-order.cancel";
import { handOverPointOrder } from "./point-order.handover";
import type { PointOrderJson } from "./types/staff-order.types";

export type PointOrdersPage = {
  orders: PointOrderJson[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export class PointOrderService {
  async listPointOrders(
    pickupPointId: string,
    pageInput?: unknown,
    limitInput?: unknown,
  ): Promise<PointOrdersPage> {
    const { page, limit } = parsePagination(
      pageInput,
      limitInput,
      invalidPagination,
    );
    const where = { pickupPointId, status: "DELIVERED" as const };
    const total = await prisma.order.count({ where });
    const orders = await prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: POINT_ORDER_SELECT,
    });

    return {
      orders: orders.map(toPointOrderJson),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async handOver(
    orderId: string,
    userId: string,
    pickupPointId: string,
  ): Promise<{ order: PointOrderJson }> {
    try {
      const { order, issuedLineCount } = await prisma.$transaction(
        (tx) => handOverPointOrder(tx, orderId, pickupPointId),
        ORDER_TRANSACTION_OPTIONS,
      );

      logger.info({
        event: "staff.point.handed_over",
        userId,
        pointId: pickupPointId,
        orderId,
        issuedLineCount,
        resultCode: "OK",
      });

      return { order };
    } catch (error) {
      logWriteRefusal(
        "staff.point.handover_refused",
        { userId, pointId: pickupPointId, orderId },
        error,
      );
      throw error;
    }
  }

  async cancelOrder(
    orderId: string,
    userId: string,
    pickupPointId: string,
  ): Promise<{ order: PointOrderJson }> {
    try {
      await this.assertOwnOrder(orderId, pickupPointId);
      await expireSessionForCancel(orderId);

      const { order, cancelledLineCount, cancelledProductIds } =
        await prisma.$transaction(
          (tx) => cancelPointOrder(tx, orderId, userId, pickupPointId),
          ORDER_TRANSACTION_OPTIONS,
        );

      await invalidateStockOfProducts(cancelledProductIds);

      logger.info({
        event: "staff.point.cancelled",
        userId,
        pointId: pickupPointId,
        orderId,
        cancelledLineCount,
        resultCode: "OK",
      });

      return { order };
    } catch (error) {
      logWriteRefusal(
        "staff.point.cancel_refused",
        { userId, pointId: pickupPointId, orderId },
        error,
      );
      throw error;
    }
  }

  private async assertOwnOrder(
    orderId: string,
    pickupPointId: string,
  ): Promise<void> {
    const owned = await prisma.order.findFirst({
      where: { id: orderId, pickupPointId },
      select: { id: true },
    });

    if (owned === null) {
      throw pointOrderNotFound();
    }
  }
}
