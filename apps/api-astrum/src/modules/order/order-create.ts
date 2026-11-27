import { Prisma } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { describeError } from "../../common/helpers/describeError";
import { logger } from "../../common/helpers/logger";
import { addMinutes, sleep } from "../../common/helpers/time";
import { PAYMENT_WINDOW_MINUTES } from "../payment/constants/payment.constants";
import {
  LINE_STATUS_BY_PAYMENT_METHOD,
  ORDER_DETAIL_INCLUDE,
  REPLAY_ATTEMPTS,
  REPLAY_RETRY_DELAY_MS,
} from "./constants/order.constants";
import type { CreateOrderDto } from "./dto/create-order.dto";
import { idempotencyReused } from "./helpers/order-errors.helpers";
import {
  mergeOrderLines,
  priceLines,
  resolveCurrency,
} from "./helpers/order-lines.helpers";
import { type Idempotency, idempotencyOf } from "./idempotency";
import { toOrderDetail } from "./order.mapper";
import { invalidateStockOfProducts } from "./order-cache";
import { assertInCart, clearCart } from "./order-cart";
import { assertShippingMethod, resolvePickupPoint } from "./order-delivery";
import {
  ORDER_TRANSACTION_OPTIONS,
  recomputeOrderStatus,
} from "./order-status";
import {
  assertAvailable,
  loadProducts,
  outOfStockError,
  StockShortfall,
  takeStock,
} from "./order-stock";
import type {
  CreateOrderResult,
  OrderDetail,
  OrderLine,
} from "./types/order.types";

export const createOrder = async (
  userId: string,
  dto: CreateOrderDto,
  idempotencyKey?: string,
): Promise<CreateOrderResult> => {
  const lines = mergeOrderLines(dto.orderItems);
  const productIds = lines.map((line) => line.productId);
  const idempotency =
    idempotencyKey === undefined
      ? undefined
      : idempotencyOf(idempotencyKey, dto, lines);

  try {
    const result = await prisma.$transaction(
      (tx) => buildOrder(tx, userId, dto, lines, idempotency),
      ORDER_TRANSACTION_OPTIONS,
    );

    logCreated(result, userId, idempotency);

    if (!result.replay) {
      await invalidateStockOfProducts(productIds);
    }

    return result;
  } catch (error) {
    if (idempotency) {
      const existing = await findOrderByKey(userId, idempotency.key);

      if (existing) {
        const replayed = replayAnswer(existing, idempotency);
        logCreated(replayed, userId, idempotency);

        return replayed;
      }
    }

    if (error instanceof StockShortfall) {
      throw await outOfStockError(error.items);
    }

    if (error instanceof AppError) {
      logger.warn({
        event: "order.refused",
        userId,
        code: error.code,
        productIds,
      });
    } else {
      logger.error({
        event: "order.failed",
        userId,
        productIds,
        reason: describeError(error),
      });
    }

    throw error;
  }
};

const logCreated = (
  result: CreateOrderResult,
  userId: string,
  idempotency?: Idempotency,
): void => {
  if (result.replay) {
    logger.info({
      event: "order.replayed",
      orderId: result.order.id,
      userId,
      key: idempotency?.key,
    });
    return;
  }

  logger.info({
    event: "order.created",
    orderId: result.order.id,
    userId,
    lineCount: result.order.orderItems.length,
    total: result.order.totalPrice.toFixed(2),
    currency: result.order.currency,
  });
};

const findOrderByKey = async (
  userId: string,
  key: string,
): Promise<OrderDetail | null> => {
  for (let attempt = 0; attempt < REPLAY_ATTEMPTS; attempt += 1) {
    const row = await prisma.order.findFirst({
      where: { userId, idempotencyKey: key },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (row) {
      return toOrderDetail(row);
    }

    if (attempt < REPLAY_ATTEMPTS - 1) {
      await sleep(REPLAY_RETRY_DELAY_MS);
    }
  }

  return null;
};

const replayAnswer = (
  order: OrderDetail,
  idempotency: Idempotency,
): CreateOrderResult => {
  if (order.idempotencyHash === null) {
    logger.error({
      event: "order.replay.miss",
      orderId: order.id,
      key: idempotency.key,
    });

    throw new Error(
      "An order exists under this idempotency key without a fingerprint.",
    );
  }

  if (order.idempotencyHash !== idempotency.hash) {
    throw idempotencyReused();
  }

  return { order, replay: true };
};

const buildOrder = async (
  tx: Prisma.TransactionClient,
  userId: string,
  dto: CreateOrderDto,
  lines: OrderLine[],
  idempotency?: Idempotency,
): Promise<CreateOrderResult> => {
  if (idempotency) {
    const existing = await tx.order.findFirst({
      where: { userId, idempotencyKey: idempotency.key },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (existing) {
      return replayAnswer(toOrderDetail(existing), idempotency);
    }
  }

  const products = await loadProducts(
    tx,
    lines.map((line) => line.productId),
  );
  const shippingMethod = await tx.shippingMethod.findUnique({
    where: { id: dto.shippingMethodId },
  });

  assertAvailable(products, lines);
  const cartRows = await assertInCart(tx, userId, lines);

  const priced = priceLines(products, lines);
  const currency = resolveCurrency(priced);
  const delivery = assertShippingMethod(shippingMethod, currency);
  const pickup = await resolvePickupPoint(
    tx,
    delivery.method,
    dto.pickupPointId,
  );

  await takeStock(tx, lines);

  const now = new Date();
  const totalPrice = priced.reduce(
    (total, line) => total.add(line.unitPrice.mul(line.quantity)),
    new Prisma.Decimal(0),
  );
  const grandTotal = totalPrice.add(delivery.price);

  const created = await tx.order.create({
    data: {
      userId,
      totalPrice,
      currency,
      paymentMethod: dto.paymentMethod,
      paymentExpiresAt:
        dto.paymentMethod === "ONLINE_CARD"
          ? addMinutes(now, PAYMENT_WINDOW_MINUTES)
          : null,
      deliveryAddress: pickup ? null : (dto.deliveryAddress ?? null),
      deliveryDate: new Date(dto.deliveryDate),
      shippingMethodId: dto.shippingMethodId,
      shippingMethodName: delivery.name,
      deliveryPrice: delivery.price,
      grandTotal,
      pickupPointId: pickup?.id ?? null,
      pickupPointName: pickup?.name ?? null,
      pickupPointAddress: pickup?.address ?? null,
      idempotencyKey: idempotency?.key ?? null,
      idempotencyHash: idempotency?.hash ?? null,
      OrderItem: {
        create: priced.map((line) => ({
          productId: line.productId,
          name: line.name,
          previewImage: line.previewImage,
          quantity: line.quantity,
          price: line.unitPrice,
          currency: line.currency,
          businessId: line.businessId,
          userId,
          status: LINE_STATUS_BY_PAYMENT_METHOD[dto.paymentMethod],
        })),
      },
    },
    include: ORDER_DETAIL_INCLUDE,
  });

  const status = await recomputeOrderStatus(tx, created.id);

  await clearCart(tx, created.id, userId, lines, cartRows);

  return { order: toOrderDetail({ ...created, status }), replay: false };
};
