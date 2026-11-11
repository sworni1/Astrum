import type {
  Currency,
  Order,
  OrderItem,
  ShippingMethod,
} from "../../../generated/prisma/client";
import { Prisma } from "../../../generated/prisma/client";
import type {
  OrderItemStatus,
  OrderStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { logger } from "../../common/helpers/logger";
import type { CreateOrderDto, OrderItemDto } from "./dto/create-order.dto";
import { type Idempotency, idempotencyOf } from "./idempotency";
import {
  MAX_LINE_QUANTITY,
  ORDER_ERROR_CODES,
  REPLAY_ATTEMPTS,
  REPLAY_RETRY_DELAY_MS,
} from "./order.constants";
import {
  lockOrder,
  ORDER_TRANSACTION_OPTIONS,
  recomputeOrderStatus,
  returnOrderStock,
} from "./order-status.helpers";

type OrderLine = { productId: string; quantity: number };

type PricedLine = {
  productId: string;
  businessId: string;
  name: string;
  previewImage: string;
  quantity: number;
  currency: Currency;
  unitPrice: Prisma.Decimal;
};

type RefusalItem = {
  productId: string;
  requested: number;
  available: number;
};

type CartRow = { productId: string; quantity: number };

/** What a create and a detail read answer with, in the shape the storefront reads. */
export type OrderDetail = Order & { orderItems: OrderItem[] };

export type OrderSummary = Order & {
  orderItemsCount: number;
  previewImage: string | null;
};

/** A create answers with the order and whether it came from a replay (spec 0003). */
export type CreateOrderResult = { order: OrderDetail; replay: boolean };

const STOCK_RETURN_STATUSES: readonly OrderItemStatus[] = [
  "PENDING",
  "CONFIRMED",
];

const CUSTOMER_CANCELLATION_BLOCKERS: readonly OrderItemStatus[] = [
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
  "BACKORDERED",
  "REPLACED",
];

const ORDER_DETAIL_INCLUDE = { OrderItem: true } as const;

const ORDER_LIST_INCLUDE = {
  _count: { select: { OrderItem: true } },
  OrderItem: {
    select: { previewImage: true },
    orderBy: { id: "asc" },
    take: 1,
  },
} as const;

const orderNotFound = () =>
  new AppError(
    404,
    ORDER_ERROR_CODES.notFound,
    "Order not found for this customer.",
  );

const idempotencyReused = () =>
  new AppError(
    409,
    ORDER_ERROR_CODES.idempotencyReused,
    "This idempotency key was already used for a different order. Submit again with a new key.",
  );

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const PRODUCT_SELECT = {
  id: true,
  businessId: true,
  name: true,
  previewImage: true,
  price: true,
  currency: true,
  quantity: true,
  isOutOfStock: true,
  isDeleted: true,
  visibility: true,
  status: true,
} as const;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

/** Raised inside the transaction so the stock check can re-read after the rollback. */
class StockShortfall extends Error {
  constructor(readonly items: Array<{ productId: string; requested: number }>) {
    super(ORDER_ERROR_CODES.outOfStock);
    this.name = "StockShortfall";
  }
}

const roundMoney = (value: number): Prisma.Decimal =>
  new Prisma.Decimal(value).toDecimalPlaces(2);

const availableUnits = (product: ProductRow): number =>
  product.isOutOfStock ? 0 : Math.max(0, product.quantity);

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const quotedNames = (products: Map<string, ProductRow>, items: RefusalItem[]) =>
  items
    .map((item) => `"${products.get(item.productId)?.name ?? item.productId}"`)
    .join(", ");

/**
 * Repeated products are merged after validation, so two lines of the same
 * product can never take the stock twice in one order (AC-7).
 */
export const mergeOrderLines = (items: OrderItemDto[]): OrderLine[] => {
  const merged = new Map<string, number>();

  for (const item of items) {
    merged.set(
      item.productId,
      (merged.get(item.productId) ?? 0) + item.quantity,
    );
  }

  const lines = [...merged].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  if (lines.length === 0) {
    throw new AppError(
      422,
      ORDER_ERROR_CODES.validation,
      "An order needs at least one line.",
    );
  }

  const overflow = lines.filter((line) => line.quantity > MAX_LINE_QUANTITY);

  if (overflow.length > 0) {
    throw new AppError(
      422,
      ORDER_ERROR_CODES.validation,
      `A line cannot hold more than ${MAX_LINE_QUANTITY} units.`,
      { items: overflow },
    );
  }

  return lines;
};

/**
 * The answer carries the snapshot columns the order row holds: the delivery
 * method is named and priced at creation, so no relation is read here (AC-7).
 */
const toOrderDetail = (
  order: Order & { OrderItem: OrderItem[] },
): OrderDetail => {
  const { OrderItem: orderItems, ...rest } = order;

  return { ...rest, orderItems };
};

export class OrderService {
  async createOrder(
    userId: string,
    dto: CreateOrderDto,
    idempotencyKey?: string,
  ): Promise<CreateOrderResult> {
    const lines = mergeOrderLines(dto.orderItems);
    const productIds = lines.map((line) => line.productId);
    const idempotency =
      idempotencyKey === undefined
        ? undefined
        : idempotencyOf(idempotencyKey, dto, lines);

    try {
      const result = await prisma.$transaction(
        (tx) => this.buildOrder(tx, userId, dto, lines, idempotency),
        ORDER_TRANSACTION_OPTIONS,
      );

      this.logCreated(result, userId, idempotency);

      return result;
    } catch (error) {
      // A keyed failure is resolved against the key first, because the loser of a
      // race is refused before it ever reaches the unique index (AC-6).
      if (idempotency) {
        const existing = await this.findOrderByKey(userId, idempotency.key);

        if (existing) {
          const replayed = this.replayAnswer(existing, idempotency);
          this.logCreated(replayed, userId, idempotency);

          return replayed;
        }
      }

      if (error instanceof StockShortfall) {
        throw await this.outOfStockError(error.items);
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
  }

  private logCreated(
    result: CreateOrderResult,
    userId: string,
    idempotency?: Idempotency,
  ): void {
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
  }

  /**
   * The winner commits before its index violation is visible, so a bounded
   * re-read on the plain client is what turns a keyed refusal into an answer
   * about the order that already exists (AC-6).
   */
  private async findOrderByKey(
    userId: string,
    key: string,
  ): Promise<OrderDetail | null> {
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
  }

  /** Every path that finds the key compares the fingerprint (AC-2, AC-3). */
  private replayAnswer(
    order: OrderDetail,
    idempotency: Idempotency,
  ): CreateOrderResult {
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
  }

  async getOrderById(orderId: string, userId: string): Promise<OrderDetail> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      throw orderNotFound();
    }

    return toOrderDetail(order);
  }

  async getOrdersByUserId(userId: string): Promise<OrderSummary[]> {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: ORDER_LIST_INCLUDE,
    });

    return orders.map(({ _count, OrderItem, ...order }) => ({
      ...order,
      orderItemsCount: _count.OrderItem,
      previewImage: OrderItem[0]?.previewImage ?? null,
    }));
  }

  async updateOrderStatus(
    orderId: string,
    userId: string,
    status: OrderStatus,
  ): Promise<OrderDetail> {
    if (status !== "CANCELED") {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.invalidTransition,
        `Changing an order to ${status} is not supported yet.`,
        { to: status },
      );
    }

    const order = await prisma.$transaction(
      (tx) => this.cancelOrder(tx, orderId, userId),
      ORDER_TRANSACTION_OPTIONS,
    );

    logger.info({
      event: "order.cancelled",
      orderId,
      userId,
      restoredLines: order.orderItems.length,
    });

    return order;
  }

  /** Owner check, transition check, status write and stock return in one transaction. */
  private async cancelOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    userId: string,
  ): Promise<OrderDetail> {
    await lockOrder(tx, orderId);

    const current = await tx.order.findFirst({
      where: { id: orderId, userId },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!current) {
      throw orderNotFound();
    }

    // A second cancel writes nothing, so the stock cannot be returned twice (AC-5).
    if (current.status === "CANCELED") {
      return toOrderDetail(current);
    }

    const blockedLine = current.OrderItem.find((item) =>
      CUSTOMER_CANCELLATION_BLOCKERS.includes(item.status),
    );

    if (blockedLine) {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.invalidTransition,
        `An order with a ${blockedLine.status} line can no longer be cancelled.`,
        { from: blockedLine.status, to: "CANCELED" },
      );
    }

    await tx.orderItem.updateMany({
      where: {
        orderId: current.id,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      data: { status: "CANCELLED" },
    });

    await returnOrderStock(
      tx,
      current.OrderItem.filter((item) =>
        STOCK_RETURN_STATUSES.includes(item.status),
      ),
    );
    await recomputeOrderStatus(
      tx,
      current.id,
      current.paymentStatus === "PENDING" ? "CANCELLED" : undefined,
    );

    return toOrderDetail(
      await tx.order.findFirstOrThrow({
        where: { id: current.id },
        include: ORDER_DETAIL_INCLUDE,
      }),
    );
  }

  /**
   * An increment cannot fail, so a product removed from the catalogue keeps a
   * zero count instead of breaking the cancel (AC-2).
   */
  private async buildOrder(
    tx: Prisma.TransactionClient,
    userId: string,
    dto: CreateOrderDto,
    lines: OrderLine[],
    idempotency?: Idempotency,
  ): Promise<CreateOrderResult> {
    // Fast path: an order already under this key answers before anything is read
    // or written again (AC-2, AC-3).
    if (idempotency) {
      const existing = await tx.order.findFirst({
        where: { userId, idempotencyKey: idempotency.key },
        include: ORDER_DETAIL_INCLUDE,
      });

      if (existing) {
        return this.replayAnswer(toOrderDetail(existing), idempotency);
      }
    }

    const products = await this.loadProducts(
      tx,
      lines.map((line) => line.productId),
    );
    const shippingMethod = await tx.shippingMethod.findUnique({
      where: { id: dto.shippingMethodId },
    });

    // Fixed precedence: visibility and stock, then cart, then currency,
    // then the delivery method (the first failing check decides the code).
    this.assertAvailable(products, lines);
    const cartRows = await this.assertInCart(tx, userId, lines);

    const priced = this.priceLines(products, lines);
    const currency = this.resolveCurrency(priced);
    const delivery = this.assertShippingMethod(shippingMethod, currency);
    const pickup = await this.resolvePickupPoint(
      tx,
      delivery.method,
      dto.pickupPointId,
    );

    await this.takeStock(tx, lines);

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
        paymentDetails: dto.paymentDetails,
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
          })),
        },
      },
      include: { OrderItem: true },
    });

    await this.clearCart(tx, created.id, userId, lines, cartRows);

    return { order: toOrderDetail(created), replay: false };
  }

  private async loadProducts(
    tx: Prisma.TransactionClient,
    productIds: string[],
  ): Promise<Map<string, ProductRow>> {
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: PRODUCT_SELECT,
    });

    return new Map(products.map((product) => [product.id, product]));
  }

  private assertAvailable(
    products: Map<string, ProductRow>,
    lines: OrderLine[],
  ): void {
    const refused: RefusalItem[] = [];

    for (const line of lines) {
      const product = products.get(line.productId);
      const visible =
        product !== undefined &&
        !product.isDeleted &&
        product.visibility === "Public" &&
        product.status === "Published";
      const available = product && visible ? availableUnits(product) : 0;

      if (!visible || available < line.quantity) {
        refused.push({
          productId: line.productId,
          requested: line.quantity,
          available,
        });
      }
    }

    if (refused.length === 0) {
      return;
    }

    const message =
      refused.length === 1
        ? `Only ${refused[0].available} of ${quotedNames(products, refused)} left, you asked for ${refused[0].requested}.`
        : `Not enough stock for ${quotedNames(products, refused)}.`;

    throw new AppError(409, ORDER_ERROR_CODES.outOfStock, message, {
      items: refused,
    });
  }

  private async assertInCart(
    tx: Prisma.TransactionClient,
    userId: string,
    lines: OrderLine[],
  ): Promise<CartRow[]> {
    const cartRows = await tx.cartItem.findMany({
      where: { userId, productId: { in: lines.map((line) => line.productId) } },
      select: { productId: true, quantity: true },
    });
    const held = new Map(cartRows.map((row) => [row.productId, row.quantity]));

    const refused = lines
      .filter((line) => (held.get(line.productId) ?? 0) < line.quantity)
      .map((line) => ({
        productId: line.productId,
        requested: line.quantity,
        available: held.get(line.productId) ?? 0,
      }));

    if (refused.length === 0) {
      return cartRows;
    }

    throw new AppError(
      409,
      ORDER_ERROR_CODES.cartMismatch,
      "Your cart holds fewer units than this order asks for. Refresh the cart and try again.",
      { items: refused },
    );
  }

  /**
   * The ordered lines leave the cart in the same commit that took the stock: a
   * row at or below the ordered quantity is deleted, a larger row is decreased by
   * exactly the ordered quantity, and a row another request already removed is
   * logged instead of written (AC-5, AC-8).
   */
  private async clearCart(
    tx: Prisma.TransactionClient,
    orderId: string,
    userId: string,
    lines: OrderLine[],
    cartRows: CartRow[],
  ): Promise<void> {
    const before = new Map(
      cartRows.map((row) => [row.productId, row.quantity]),
    );

    for (const line of lines) {
      const { count } = await tx.cartItem.deleteMany({
        where: {
          userId,
          productId: line.productId,
          quantity: { lte: line.quantity },
        },
      });

      if (count > 0) {
        continue;
      }

      const { count: decreased } = await tx.cartItem.updateMany({
        where: {
          userId,
          productId: line.productId,
          quantity: { gte: line.quantity },
        },
        data: { quantity: { decrement: line.quantity } },
      });

      if (decreased === 0) {
        logger.warn({
          event: "cart.clear.skipped",
          orderId,
          userId,
          productId: line.productId,
          quantityBefore: before.get(line.productId) ?? null,
        });
      }
    }
  }

  private priceLines(
    products: Map<string, ProductRow>,
    lines: OrderLine[],
  ): PricedLine[] {
    return lines.map((line) => {
      const product = products.get(line.productId);

      if (!product) {
        throw new AppError(
          409,
          ORDER_ERROR_CODES.outOfStock,
          "A product in this order is no longer available.",
        );
      }

      return {
        productId: product.id,
        businessId: product.businessId,
        name: product.name,
        previewImage: product.previewImage,
        quantity: line.quantity,
        currency: product.currency,
        unitPrice: roundMoney(product.price),
      };
    });
  }

  private resolveCurrency(priced: PricedLine[]): Currency {
    const currency = priced[0]?.currency;

    if (!currency) {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.outOfStock,
        "A product in this order is no longer available.",
      );
    }

    const mixed = priced.filter((line) => line.currency !== currency);

    if (mixed.length > 0) {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.mixedCurrency,
        "Products in this order use different currencies.",
        { productIds: mixed.map((line) => line.productId) },
      );
    }

    return currency;
  }

  /**
   * The method is read inside the transaction, so the price the order records
   * is the price the row carries at that moment. An unknown id, a switched off
   * row and a currency mismatch each answer their own code, in this order, and
   * none of them writes anything (AC-5).
   */
  private assertShippingMethod(
    method: ShippingMethod | null,
    currency: Currency,
  ): { method: ShippingMethod; name: string; price: Prisma.Decimal } {
    if (!method) {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.unknownShippingMethod,
        "The selected delivery method does not exist.",
      );
    }

    if (!method.isActive) {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.shippingMethodInactive,
        "The selected delivery method is no longer offered.",
      );
    }

    if (method.currency !== currency) {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.shippingCurrencyMismatch,
        "The selected delivery method is priced in another currency.",
      );
    }

    return {
      method,
      name: method.name,
      price: new Prisma.Decimal(method.price).toDecimalPlaces(2),
    };
  }

  /**
   * The point is read inside the transaction, after the method checks, in the
   * order the spec fixes: a courier method that names a point, then a pickup
   * method without one, then an unknown id, then a switched off row. A pickup
   * order keeps the name and the address as a snapshot, so a rename or a
   * closure never rewrites history (AC-7).
   */
  private async resolvePickupPoint(
    tx: Prisma.TransactionClient,
    method: ShippingMethod,
    requestedPointId: string | undefined,
  ): Promise<{ id: string; name: string; address: string } | null> {
    if (!method.isPickup) {
      if (requestedPointId === undefined) {
        return null;
      }

      throw new AppError(
        409,
        ORDER_ERROR_CODES.pickupPointNotAllowed,
        "The selected delivery method does not hand over at a pickup point.",
      );
    }

    if (requestedPointId === undefined) {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.pickupPointRequired,
        "The selected delivery method needs a pickup point.",
      );
    }

    const point = await tx.pickupPoint.findUnique({
      where: { id: requestedPointId },
      select: { id: true, name: true, address: true, isActive: true },
    });

    if (!point) {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.unknownPickupPoint,
        "The selected pickup point does not exist.",
      );
    }

    if (!point.isActive) {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.pickupPointInactive,
        "The selected pickup point is closed.",
      );
    }

    return { id: point.id, name: point.name, address: point.address };
  }

  /** Conditional update per line: zero rows touched means the stock is short. */
  private async takeStock(
    tx: Prisma.TransactionClient,
    lines: OrderLine[],
  ): Promise<void> {
    const short: Array<{ productId: string; requested: number }> = [];

    for (const line of lines) {
      const { count } = await tx.product.updateMany({
        where: {
          id: line.productId,
          quantity: { gte: line.quantity },
          isOutOfStock: false,
        },
        data: { quantity: { decrement: line.quantity } },
      });

      if (count === 0) {
        short.push({ productId: line.productId, requested: line.quantity });
        continue;
      }

      await tx.product.updateMany({
        where: { id: line.productId, quantity: 0 },
        data: { isOutOfStock: true },
      });
    }

    if (short.length > 0) {
      throw new StockShortfall(short);
    }
  }

  /** Availability is re-read after the rollback, so it is never the pre race value. */
  private async outOfStockError(
    short: Array<{ productId: string; requested: number }>,
  ): Promise<AppError> {
    const products = await prisma.product.findMany({
      where: { id: { in: short.map((item) => item.productId) } },
      select: PRODUCT_SELECT,
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    const items: RefusalItem[] = [];

    for (const item of short) {
      const product = byId.get(item.productId);

      items.push({
        productId: item.productId,
        requested: item.requested,
        available: product ? availableUnits(product) : 0,
      });
    }

    const message =
      items.length === 1
        ? `Only ${items[0].available} of ${quotedNames(byId, items)} left, you asked for ${items[0].requested}.`
        : `Not enough stock for ${quotedNames(byId, items)}.`;

    return new AppError(409, ORDER_ERROR_CODES.outOfStock, message, { items });
  }
}
