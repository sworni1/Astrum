import { OrderStatus, PaymentStatus } from "@astrum/db/enums";
import { invalidateStockOfOrder } from "../order/order-cache";
import { closeOrder, lockOrder } from "../order/order-status";
import { ORDER_WITH_LINES_INCLUDE } from "./constants/payment.constants";
import { applyExpiredEvent } from "./payment.apply";
import { newestOpenAttempt } from "./payment.attempts";
import { inTransaction } from "./payment.dispatch";

export const closeExpiredWindow = async (orderId: string): Promise<void> => {
  const attempt = await newestOpenAttempt(orderId);

  if (attempt !== null) {
    const outcome = await inTransaction((tx) =>
      applyExpiredEvent(tx, orderId, attempt.id),
    );

    if (outcome === "closed") {
      await invalidateStockOfOrder(orderId);
    }

    return;
  }

  const closed = await inTransaction(async (tx) => {
    await lockOrder(tx, orderId);

    const order = await tx.order.findFirstOrThrow({
      where: { id: orderId },
      include: ORDER_WITH_LINES_INCLUDE,
    });

    if (order.status !== OrderStatus.PENDING) {
      return false;
    }

    await closeOrder(tx, order);
    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.CANCELLED },
    });

    return true;
  });

  if (closed) {
    await invalidateStockOfOrder(orderId);
  }
};
