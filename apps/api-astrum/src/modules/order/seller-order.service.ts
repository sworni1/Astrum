import type { OrderItem } from "../../../generated/prisma/client";
import { Prisma } from "../../../generated/prisma/client";
import type { OrderItemStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { logger } from "../../common/helpers/logger";
import { ORDER_ERROR_CODES } from "./order.constants";
import {
  lockOrder,
  ORDER_TRANSACTION_OPTIONS,
  recomputeOrderStatus,
  returnOrderStock,
} from "./order-status.helpers";

type SellerOrderLine = Pick<
  OrderItem,
  | "id"
  | "productId"
  | "name"
  | "previewImage"
  | "quantity"
  | "price"
  | "currency"
  | "status"
>;

type SellerOrderItemResult = SellerOrderLine & { orderId: string };

const SELLER_ORDER_ITEM_SELECT = {
  id: true,
  orderId: true,
  productId: true,
  name: true,
  previewImage: true,
  quantity: true,
  price: true,
  currency: true,
  status: true,
} as const;

export const ALLOWED_LINE_TRANSITIONS: Record<
  OrderItemStatus,
  readonly OrderItemStatus[]
> = {
  PENDING: ["CONFIRMED", "OUT_OF_STOCK", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  OUT_OF_STOCK: [],
  CANCELLED: [],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  RETURNED: [],
  BACKORDERED: [],
  REPLACED: [],
};

const sellerNotAssigned = () =>
  new AppError(
    403,
    ORDER_ERROR_CODES.sellerNotAssigned,
    "No business is assigned to this seller.",
  );

const orderItemNotFound = () =>
  new AppError(
    404,
    ORDER_ERROR_CODES.orderItemNotFound,
    "Order item not found.",
  );

const invalidPagination = () =>
  new AppError(422, ORDER_ERROR_CODES.validation, "Invalid pagination.");

const parsePaginationValue = (value: unknown, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
    throw invalidPagination();
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw invalidPagination();
  }

  return parsed;
};

const parsePagination = (
  pageInput: unknown,
  limitInput: unknown,
): { page: number; limit: number } => {
  const page = parsePaginationValue(pageInput, 1);
  const limit = Math.min(parsePaginationValue(limitInput, 20), 50);

  if (!Number.isSafeInteger((page - 1) * limit)) {
    throw invalidPagination();
  }

  return { page, limit };
};

export class SellerOrderService {
  async getSellerOrders(
    userId: string,
    pageInput?: unknown,
    limitInput?: unknown,
  ) {
    const { page, limit } = parsePagination(pageInput, limitInput);
    const business = await prisma.business.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });

    if (!business) {
      throw sellerNotAssigned();
    }

    const total = await this.countSellerOrders(userId);
    const orders = await this.findSellerOrders(userId, page, limit);

    return {
      orders: orders.map((order) => ({
        id: order.id,
        createdAt: order.createdAt,
        orderItems: order.OrderItem,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateSellerOrderItemStatus(
    orderItemId: string,
    userId: string,
    targetStatus: OrderItemStatus,
  ): Promise<SellerOrderItemResult> {
    let orderId: string | null = null;

    try {
      const result = await this.runStatusTransaction(
        orderItemId,
        userId,
        targetStatus,
        (foundOrderId) => {
          orderId = foundOrderId;
        },
      );

      logger.info({
        event: "seller.order_item.status_changed",
        userId,
        orderId,
        orderItemId,
        targetStatus,
        resultCode: "OK",
      });

      return result;
    } catch (error) {
      const fields = {
        event: "seller.order_item.status_refused",
        userId,
        orderId,
        orderItemId,
        targetStatus,
        resultCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      };

      if (error instanceof AppError) {
        logger.warn(fields);
      } else {
        logger.error(fields);
      }

      throw error;
    }
  }

  private async runStatusTransaction(
    orderItemId: string,
    userId: string,
    targetStatus: OrderItemStatus,
    setOrderId: (orderId: string) => void,
  ): Promise<SellerOrderItemResult> {
    return prisma.$transaction(async (tx) => {
      const reference = await tx.orderItem.findUnique({
        where: { id: orderItemId },
        select: { orderId: true },
      });

      if (!reference) {
        throw orderItemNotFound();
      }

      setOrderId(reference.orderId);
      return this.transitionOrderItem(
        tx,
        orderItemId,
        reference.orderId,
        userId,
        targetStatus,
      );
    }, ORDER_TRANSACTION_OPTIONS);
  }

  private async countSellerOrders(userId: string): Promise<number> {
    const [result] = await prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(DISTINCT oi."orderId")::int AS total
      FROM "OrderItem" oi
      JOIN "Business" b ON b.id = oi."businessId"
      WHERE b."ownerUserId" = ${userId}
    `;

    return result?.total ?? 0;
  }

  private async findSellerOrders(userId: string, page: number, limit: number) {
    return prisma.order.findMany({
      where: {
        OrderItem: {
          some: { business: { is: { ownerUserId: userId } } },
        },
      },
      select: {
        id: true,
        createdAt: true,
        OrderItem: {
          where: { business: { is: { ownerUserId: userId } } },
          orderBy: { id: "asc" },
          select: {
            id: true,
            productId: true,
            name: true,
            previewImage: true,
            quantity: true,
            price: true,
            currency: true,
            status: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  private async transitionOrderItem(
    tx: Prisma.TransactionClient,
    orderItemId: string,
    orderId: string,
    userId: string,
    targetStatus: OrderItemStatus,
  ): Promise<SellerOrderItemResult> {
    await lockOrder(tx, orderId);
    const current = await tx.orderItem.findFirst({
      where: {
        id: orderItemId,
        business: { is: { ownerUserId: userId } },
      },
      select: SELLER_ORDER_ITEM_SELECT,
    });

    if (!current) {
      throw orderItemNotFound();
    }

    if (current.status === targetStatus) {
      return current;
    }

    if (!ALLOWED_LINE_TRANSITIONS[current.status].includes(targetStatus)) {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.invalidTransition,
        `A line cannot move from ${current.status} to ${targetStatus}.`,
        { from: current.status, to: targetStatus },
      );
    }

    return this.applyOrderItemStatus(tx, current, targetStatus);
  }

  private async applyOrderItemStatus(
    tx: Prisma.TransactionClient,
    current: SellerOrderItemResult,
    targetStatus: OrderItemStatus,
  ): Promise<SellerOrderItemResult> {
    const result = await tx.orderItem.update({
      where: { id: current.id },
      data: { status: targetStatus },
      select: SELLER_ORDER_ITEM_SELECT,
    });

    if (targetStatus === "CANCELLED") {
      await returnOrderStock(tx, [result]);
    }

    await recomputeOrderStatus(tx, current.orderId);
    return result;
  }
}
