import type { Prisma } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { ORDER_ERROR_CODES, PRODUCT_SELECT } from "./constants/order.constants";
import type { OrderLine, ProductRow, RefusalItem } from "./types/order.types";

export class StockShortfall extends Error {
  constructor(readonly items: Array<{ productId: string; requested: number }>) {
    super(ORDER_ERROR_CODES.outOfStock);
    this.name = "StockShortfall";
  }
}

export const loadProducts = async (
  tx: Prisma.TransactionClient,
  productIds: string[],
): Promise<Map<string, ProductRow>> => {
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: PRODUCT_SELECT,
  });

  return new Map(products.map((product) => [product.id, product]));
};

const availableUnits = (product: ProductRow): number =>
  product.isOutOfStock ? 0 : Math.max(0, product.quantity);

const quotedNames = (
  products: Map<string, ProductRow>,
  items: RefusalItem[],
): string =>
  items
    .map((item) => `"${products.get(item.productId)?.name ?? item.productId}"`)
    .join(", ");

const stockShortfallMessage = (
  products: Map<string, ProductRow>,
  items: RefusalItem[],
): string =>
  items.length === 1
    ? `Only ${items[0].available} of ${quotedNames(products, items)} left, you asked for ${items[0].requested}.`
    : `Not enough stock for ${quotedNames(products, items)}.`;

export const assertAvailable = (
  products: Map<string, ProductRow>,
  lines: OrderLine[],
): void => {
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

  throw new AppError(
    409,
    ORDER_ERROR_CODES.outOfStock,
    stockShortfallMessage(products, refused),
    { items: refused },
  );
};

export const takeStock = async (
  tx: Prisma.TransactionClient,
  lines: OrderLine[],
): Promise<void> => {
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
};

export const outOfStockError = async (
  short: Array<{ productId: string; requested: number }>,
): Promise<AppError> => {
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

  return new AppError(
    409,
    ORDER_ERROR_CODES.outOfStock,
    stockShortfallMessage(byId, items),
    { items },
  );
};
