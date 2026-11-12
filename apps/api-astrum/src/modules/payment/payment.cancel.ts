import { logger } from "../../common/helpers/logger";
import { newestOpenAttempt } from "./payment.attempts";
import { paymentGateway } from "./payment.gateway.registry";

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The customer cancel expires the hosted session before its transaction opens,
 * because the network call must never run while the order row is locked. A
 * failure is logged and does not block the cancellation (AC-11).
 */
export const expireSessionForCancel = async (orderId: string): Promise<void> => {
  const gateway = paymentGateway();

  if (gateway === null) {
    return;
  }

  const attempt = await newestOpenAttempt(orderId);

  if (attempt === null || attempt.providerSessionId === null) {
    return;
  }

  try {
    await gateway.expireSession(attempt.providerSessionId);
  } catch (error) {
    logger.warn({
      event: "payment.cancel.expire_failed",
      orderId,
      paymentId: attempt.id,
      reason: describe(error),
    });
  }
};
