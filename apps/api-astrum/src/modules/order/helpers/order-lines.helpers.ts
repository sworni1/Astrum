import type { Currency } from "@astrum/db/client";
import { Prisma } from "@astrum/db/client";
import { AppError } from "../../../common/helpers/appError";
import {
  MAX_LINE_QUANTITY,
  ORDER_ERROR_CODES,
} from "../constants/order.constants";
import type { OrderItemDto } from "../dto/create-order.dto";
import type { OrderLine, PricedLine, ProductRow } from "../types/order.types";

const roundMoney = (value: number): Prisma.Decimal =>
  new Prisma.Decimal(value).toDecimalPlaces(2);

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

export const priceLines = (
  products: Map<string, ProductRow>,
  lines: OrderLine[],
): PricedLine[] =>
  lines.map((line) => {
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

export const resolveCurrency = (priced: PricedLine[]): Currency => {
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
};
