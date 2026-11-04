import type {
  Currency,
  Order,
  OrderItem,
  ShippingMethod,
} from "../../../generated/prisma/client";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { logger } from "../../common/helpers/logger";
import type { CreateOrderDto, OrderItemDto } from "./dto/create-order.dto";
import { MAX_LINE_QUANTITY, ORDER_ERROR_CODES } from "./order.constants";

type OrderLine = { productId: string; quantity: number };

type PricedLine = {
  productId: string;
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

/** What a create and a detail read answer with, in the shape the storefront reads. */
export type OrderDetail = Omit<Order, "shippingMethod"> & {
  shippingMethod: { name: string; price: number };
  orderItems: OrderItem[];
};

const TRANSACTION_OPTIONS = {
  maxWait: 5000,
  timeout: 10000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

const PRODUCT_SELECT = {
  id: true,
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

const toOrderDetail = (
  order: Order & { OrderItem: OrderItem[]; shippingMethod: ShippingMethod },
): OrderDetail => {
  const { OrderItem: orderItems, ...rest } = order;

  return {
    ...rest,
    shippingMethod: {
      name: order.shippingMethod.name,
      price: order.shippingMethod.price,
    },
    orderItems,
  };
};

export class OrderService {
  async createOrder(userId: string, dto: CreateOrderDto): Promise<OrderDetail> {
    const lines = mergeOrderLines(dto.orderItems);
    const productIds = lines.map((line) => line.productId);

    try {
      const order = await prisma.$transaction(
        (tx) => this.buildOrder(tx, userId, dto, lines),
        TRANSACTION_OPTIONS,
      );

      logger.info({
        event: "order.created",
        orderId: order.id,
        userId,
        lineCount: order.orderItems.length,
        total: order.totalPrice.toFixed(2),
        currency: order.currency,
      });

      return order;
    } catch (error) {
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

  async getOrderById(orderId: string, userId: string): Promise<OrderDetail> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { OrderItem: true, shippingMethod: true },
    });

    if (!order) {
      throw new AppError(
        404,
        ORDER_ERROR_CODES.notFound,
        "Order not found for this customer.",
      );
    }

    return toOrderDetail(order);
  }

  async getOrdersByUserId(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  private async buildOrder(
    tx: Prisma.TransactionClient,
    userId: string,
    dto: CreateOrderDto,
    lines: OrderLine[],
  ): Promise<OrderDetail> {
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
    await this.assertInCart(tx, userId, lines);

    const priced = this.priceLines(products, lines);
    const currency = this.resolveCurrency(priced);

    if (!shippingMethod) {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.unknownShippingMethod,
        "The selected delivery method does not exist.",
      );
    }

    await this.takeStock(tx, lines);

    const totalPrice = priced.reduce(
      (total, line) => total.add(line.unitPrice.mul(line.quantity)),
      new Prisma.Decimal(0),
    );

    const created = await tx.order.create({
      data: {
        userId,
        totalPrice,
        currency,
        paymentMethod: dto.paymentMethod,
        paymentDetails: dto.paymentDetails,
        deliveryAddress: dto.deliveryAddress,
        deliveryDate: new Date(dto.deliveryDate),
        shippingMethodId: dto.shippingMethodId,
        OrderItem: {
          create: priced.map((line) => ({
            productId: line.productId,
            name: line.name,
            previewImage: line.previewImage,
            quantity: line.quantity,
            price: line.unitPrice,
            currency: line.currency,
            userId,
          })),
        },
      },
      include: { OrderItem: true, shippingMethod: true },
    });

    return toOrderDetail(created);
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
  ): Promise<void> {
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
      return;
    }

    throw new AppError(
      409,
      ORDER_ERROR_CODES.cartMismatch,
      "Your cart holds fewer units than this order asks for. Refresh the cart and try again.",
      { items: refused },
    );
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
