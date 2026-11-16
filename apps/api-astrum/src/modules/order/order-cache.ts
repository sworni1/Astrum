import { prisma } from "../../../lib/prisma";
import { invalidateProducts } from "../../cache/cache";
import { logger } from "../../common/helpers/logger";
import { describeError } from "../../events/describe-error";

/**
 * A stock write already knows its products, so it names them directly. Runs
 * after the commit, never inside the transaction (spec 0022, invariant 4).
 */
export const invalidateStockOfProducts = async (
  productIds: readonly string[],
): Promise<void> => {
  await invalidateProducts(productIds);
};

/**
 * A payment path holds an order id only, so its lines are read after the commit.
 * A cache failure is one warning, never a failed write: the answer lives until
 * its lifetime ends either way (AC-8).
 */
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
