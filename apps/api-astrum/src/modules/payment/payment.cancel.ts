import { logger } from "../../common/helpers/logger";
import { describeError } from "../../events/describe-error";
import { newestOpenAttempt } from "./payment.attempts";
import { paymentGateway } from "./payment.gateway.registry";

export const expireSessionForCancel = async (
  orderId: string,
): Promise<void> => {
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
      reason: describeError(error),
    });
  }
};
