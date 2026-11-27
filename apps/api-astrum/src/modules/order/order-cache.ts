import { prisma } from "../../../lib/prisma";
import { invalidateProducts } from "../../cache/cache";
import { logger } from "../../common/helpers/logger";
import { describeError } from "../../events/describe-error";

export const invalidateStockOfProducts = async (
  productIds: readonly string[],
): Promise<void> => {
  await invalidateProducts(productIds);
};

export const invalidateStockOfOrder = async (
  orderId: string,
): Promise<void> => {
  try {
    const lines = await prisma.orderItem.findMany({
      where: { orderId },
      select: { productId: true },
    });

    await invalidateProducts(lines.map((line) => line.productId));
  } catch (error) {
    logger.warn({
      event: "cache.invalidate.error",
      orderId,
      reason: describeError(error),
    });
  }
};
