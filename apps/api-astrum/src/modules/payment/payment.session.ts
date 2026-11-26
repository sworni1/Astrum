import type { Payment } from "@astrum/db/client";
import { PaymentAttemptStatus } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../common/helpers/logger";
import { hasUniqueViolationCode } from "../../common/helpers/prismaErrors";
import { addMinutes } from "../../common/helpers/time";
import { describeError } from "../../events/describe-error";
import type { OrderWithLines } from "../order/order-status";
import {
  PAYMENT_CANCEL_QUERY,
  PAYMENT_PRODUCT_NAME_PREFIX,
  PAYMENT_PROVIDER,
  PAYMENT_RETURN_QUERY,
  PAYMENT_SESSION_RETRY_LIMIT,
  PAYMENT_WINDOW_MINUTES,
} from "./constants/payment.constants";
import {
  IdempotencyKeyReusedError,
  providerUnavailable,
} from "./helpers/payment.errors";
import { toMinorUnits } from "./helpers/payment.helpers";
import { storefrontUrl } from "./payment.config";
import { inTransaction } from "./payment.dispatch";
import type { PaymentGateway } from "./payment.gateway";
import type { StartPaymentResult } from "./types/payment.types";

export const openSession = async (
  gateway: PaymentGateway,
  order: OrderWithLines,
  now: Date,
): Promise<StartPaymentResult> => {
  const expiresAt = addMinutes(now, PAYMENT_WINDOW_MINUTES);
  let attempt = await claimAttempt(order, expiresAt);

  for (let round = 0; ; round += 1) {
    try {
      const session = await gateway.createSession({
        attemptId: attempt.id,
        orderId: order.id,
        amountMinor: toMinorUnits(order.grandTotal),
        currency: order.currency,
        productName: `${PAYMENT_PRODUCT_NAME_PREFIX} ${order.id}`,
        expiresAt,
        successUrl: `${storefrontUrl}/orders/${order.id}${PAYMENT_RETURN_QUERY}`,
        cancelUrl: `${storefrontUrl}/orders/${order.id}${PAYMENT_CANCEL_QUERY}`,
      });

      await prisma.payment.update({
        where: { id: attempt.id },
        data: {
          providerSessionId: session.sessionId,
          checkoutUrl: session.url,
        },
      });

      return { url: session.url, expiresAt, created: true };
    } catch (error) {
      if (
        error instanceof IdempotencyKeyReusedError &&
        round < PAYMENT_SESSION_RETRY_LIMIT
      ) {
        logger.warn({
          event: "payment.attempt.retired",
          orderId: order.id,
          attemptId: attempt.id,
          reason: describeError(error),
        });

        attempt = await retireAndClaim(order, expiresAt, attempt.id);

        continue;
      }

      logger.error({
        event: "payment.session.failed",
        orderId: order.id,
        attemptId: attempt.id,
        reason: describeError(error),
      });

      throw providerUnavailable();
    }
  }
};

const retireAndClaim = async (
  order: OrderWithLines,
  expiresAt: Date,
  attemptId: string,
): Promise<Payment> => {
  await prisma.payment.updateMany({
    where: { id: attemptId, status: PaymentAttemptStatus.PENDING },
    data: { status: PaymentAttemptStatus.CANCELLED },
  });

  return claimAttempt(order, expiresAt);
};

const claimAttempt = async (
  order: OrderWithLines,
  expiresAt: Date,
): Promise<Payment> => {
  const pending = await prisma.payment.findFirst({
    where: { orderId: order.id, status: PaymentAttemptStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });
  const attempt = pending ?? (await createAttempt(order, expiresAt));

  await inTransaction(async (tx) => {
    await tx.payment.update({
      where: { id: attempt.id },
      data: { expiresAt },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { paymentExpiresAt: expiresAt },
    });
  });

  return { ...attempt, expiresAt };
};

const createAttempt = async (
  order: OrderWithLines,
  expiresAt: Date,
): Promise<Payment> => {
  try {
    return await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: PAYMENT_PROVIDER,
        amount: order.grandTotal,
        currency: order.currency,
        status: PaymentAttemptStatus.PENDING,
        expiresAt,
      },
    });
  } catch (error) {
    if (!hasUniqueViolationCode(error)) {
      throw error;
    }

    const raced = await prisma.payment.findFirst({
      where: { orderId: order.id, status: PaymentAttemptStatus.PENDING },
    });

    if (raced === null) {
      throw error;
    }

    return raced;
  }
};
