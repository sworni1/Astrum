import { prisma } from "../../../lib/prisma";
import { logger } from "../../common/helpers/logger";
import { parsePagination } from "../../common/helpers/pagination";
import { invalidateStockOfProducts } from "../order/order-cache";
import { ORDER_TRANSACTION_OPTIONS } from "../order/order-status";
import { expireSessionForCancel } from "../payment/payment.cancel";
import { COURIER_ORDER_SELECT } from "./constants/courier-order.constants";
import {
  assertHeldCourierOrder,
  cancelCourierOrder,
} from "./courier-order.cancel";
import { claimCourierOrder, releaseCourierOrder } from "./courier-order.claim";
import { handOverCourierOrder } from "./courier-order.handover";
import { toCourierOrderJson } from "./helpers/courier-order.helpers";
import { logWriteRefusal } from "./helpers/staff-order.helpers";
import { invalidPagination } from "./helpers/staff-order-errors.helpers";
import type { CourierOrderJson, CourierScope } from "./types/staff-order.types";

export type CourierOrdersPage = {
  orders: CourierOrderJson[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export class CourierOrderService {
  async listCourierOrders(
    userId: string,
    scope: CourierScope,
    pageInput?: unknown,
    limitInput?: unknown,
  ): Promise<CourierOrdersPage> {
    const { page, limit } = parsePagination(
      pageInput,
      limitInput,
      invalidPagination,
    );
    const where = {
      status: "DELIVERED" as const,
      shippingMethod: { isPickup: false },
      courierUserId: scope === "mine" ? userId : null,
    };
    const total = await prisma.order.count({ where });
    const orders = await prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: COURIER_ORDER_SELECT,
    });

    return {
      orders: orders.map((order) => toCourierOrderJson(order, userId)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async claim(
    orderId: string,
    userId: string,
  ): Promise<{ order: CourierOrderJson }> {
    const { order, wrote } = await prisma.$transaction(
      (tx) => claimCourierOrder(tx, orderId, userId),
      ORDER_TRANSACTION_OPTIONS,
    );

    if (wrote) {
      logger.info({
        event: "staff.courier.claimed",
        userId,
        orderId,
        resultCode: "OK",
      });
    }

    return { order };
  }

  async release(
    orderId: string,
    userId: string,
  ): Promise<{ order: CourierOrderJson }> {
    const order = await prisma.$transaction(
      (tx) => releaseCourierOrder(tx, orderId, userId),
      ORDER_TRANSACTION_OPTIONS,
    );

    logger.info({
      event: "staff.courier.released",
      userId,
      orderId,
      resultCode: "OK",
    });

    return { order };
  }

  async handOver(
    orderId: string,
    userId: string,
  ): Promise<{ order: CourierOrderJson }> {
    try {
      const { order, issuedLineCount, collected } = await prisma.$transaction(
        (tx) => handOverCourierOrder(tx, orderId, userId),
        ORDER_TRANSACTION_OPTIONS,
      );

      logger.info({
        event: "staff.courier.handed_over",
        userId,
        orderId,
        issuedLineCount,
        resultCode: "OK",
        ...(collected
          ? {
              collectedAmount: collected.amount,
              collectedCurrency: collected.currency,
            }
          : {}),
      });

      return { order };
    } catch (error) {
      logWriteRefusal(
        "staff.courier.handover_refused",
        { userId, orderId },
        error,
      );
      throw error;
    }
  }

  async cancelOrder(
    orderId: string,
    userId: string,
  ): Promise<{ order: CourierOrderJson }> {
    try {
      await assertHeldCourierOrder(orderId, userId);

      const { order, cancelledLineCount, cancelledProductIds } =
        await prisma.$transaction(
          (tx) => cancelCourierOrder(tx, orderId, userId),
          ORDER_TRANSACTION_OPTIONS,
        );

      await expireSessionForCancel(orderId);
      await invalidateStockOfProducts(cancelledProductIds);

      logger.info({
        event: "staff.courier.cancelled",
        userId,
        orderId,
        cancelledLineCount,
        resultCode: "OK",
      });

      return { order };
    } catch (error) {
      logWriteRefusal(
        "staff.courier.cancel_refused",
        { userId, orderId },
        error,
      );
      throw error;
    }
  }
}
