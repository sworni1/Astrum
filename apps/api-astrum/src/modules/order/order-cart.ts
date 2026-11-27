import type { Prisma } from "@astrum/db/client";
import { AppError } from "../../common/helpers/appError";
import { logger } from "../../common/helpers/logger";
import { ORDER_ERROR_CODES } from "./constants/order.constants";
import type { CartRow, OrderLine } from "./types/order.types";

export const assertInCart = async (
  tx: Prisma.TransactionClient,
  userId: string,
  lines: OrderLine[],
): Promise<CartRow[]> => {
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
};

export const clearCart = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
  lines: OrderLine[],
  cartRows: CartRow[],
): Promise<void> => {
  const before = new Map(cartRows.map((row) => [row.productId, row.quantity]));

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
};
