import type { Payment } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { logger } from "../../common/helpers/logger";
import { ORDER_ERROR_CODES } from "../order/order.constants";
import { closeOrder, lockOrder } from "../order/order-status.helpers";
import { type OrderWithLines, applyExpiredEvent } from "./payment.apply";
import { newestOpenAttempt, reusableAttempt } from "./payment.attempts";
import { PAYMENT_ERROR_CODES, PAYMENT_WINDOW_MINUTES } from "./payment.constants";
import { storefrontUrl } from "./payment.config";
import { applySession, inTransaction } from "./payment.dispatch";
import type { PaymentGateway } from "./payment.gateway";
import { IdempotencyKeyReusedError } from "./payment.gateway";
import { paymentGateway } from "./payment.gateway.registry";
import { toMinorUnits } from "./payment.money";

export type StartPaymentResult = {
  url: string;
  expiresAt: Date;
  created: boolean;
};

export type SyncPaymentResult = {
  paymentStatus: string;
  status: string;
  paymentExpiresAt: Date | null;
};

const addMinutes = (from: Date, minutes: number): Date =>
  new Date(from.getTime() + minutes * 60_000);

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "P2002";

const orderNotFound = () =>
  new AppError(
    404,
    ORDER_ERROR_CODES.notFound,
    "Order not found for this customer.",
  );

const notPayable = () =>
  new AppError(
    409,
    PAYMENT_ERROR_CODES.notPayable,
    "Only an online card order can be paid from this screen.",
  );

const alreadyPaid = () =>
  new AppError(
    409,
    PAYMENT_ERROR_CODES.alreadyPaid,
    "This order is already paid.",
  );

const windowExpired = () =>
  new AppError(
    409,
    PAYMENT_ERROR_CODES.windowExpired,
    "The payment window of this order has closed.",
  );

const providerUnavailable = () =>
  new AppError(
    502,
    PAYMENT_ERROR_CODES.providerUnavailable,
    "The payment provider is not reachable right now.",
  );

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The customer facing half of the provider: the pay route that opens a session
 * and the sync route the return screen calls (AC-4, AC-10).
 */
export class PaymentService {
  constructor(
    private readonly resolveGateway: () => PaymentGateway | null = paymentGateway,
  ) {}

  async startPayment(
    orderId: string,
    userId: string,
  ): Promise<StartPaymentResult> {
    const order = await this.loadOwnOrder(orderId, userId);

    if (order.paymentMethod !== "ONLINE_CARD") {
      throw notPayable();
    }

    if (order.paymentStatus === "PAID") {
      throw alreadyPaid();
    }

    const now = new Date();

    if (
      order.paymentExpiresAt === null ||
      order.paymentExpiresAt.getTime() <= now.getTime()
    ) {
      await this.closeExpiredWindow(order.id);
      throw windowExpired();
    }

    const reusable = await reusableAttempt(order.id, now);

    if (reusable !== null && reusable.checkoutUrl !== null) {
      return {
        url: reusable.checkoutUrl,
        expiresAt: reusable.expiresAt,
        created: false,
      };
    }

    return await this.openSession(this.gatewayOrRefuse(), order, now);
  }

  async syncPayment(
    orderId: string,
    userId: string,
  ): Promise<SyncPaymentResult> {
    const order = await this.loadOwnOrder(orderId, userId);

    if (order.paymentMethod !== "ONLINE_CARD") {
      throw notPayable();
    }

    const attempt = await newestOpenAttempt(order.id);

    if (attempt === null || attempt.providerSessionId === null) {
      return this.currentStatus(order);
    }

    const session = await this.retrieve(
      this.gatewayOrRefuse(),
      attempt.providerSessionId,
      order.id,
    );

    await applySession(session, {
      orderId: order.id,
      attemptId: attempt.id,
    });

    return await this.currentStatus(order);
  }

  private async loadOwnOrder(
    orderId: string,
    userId: string,
  ): Promise<OrderWithLines> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { OrderItem: true },
    });

    if (order === null) {
      throw orderNotFound();
    }

    return order;
  }

  private gatewayOrRefuse(): PaymentGateway {
    const gateway = this.resolveGateway();

    if (gateway === null) {
      throw providerUnavailable();
    }

    return gateway;
  }

  private async retrieve(
    gateway: PaymentGateway,
    sessionId: string,
    orderId: string,
  ) {
    try {
      return await gateway.retrieveSession(sessionId);
    } catch (error) {
      logger.error({
        event: "payment.sync.failed",
        orderId,
        sessionId,
        reason: describe(error),
      });

      throw providerUnavailable();
    }
  }

  /**
   * One session per attempt: the attempt id is the idempotency key, so the loser
   * of two concurrent presses gets the same session back from the provider and
   * both requests answer one URL (AC-4). A key the provider refuses because its
   * payload changed is retired once and the session opens under a fresh one, so a
   * past deploy cannot freeze an order behind a dead key.
   */
  private async openSession(
    gateway: PaymentGateway,
    order: OrderWithLines,
    now: Date,
  ): Promise<StartPaymentResult> {
    const expiresAt = addMinutes(now, PAYMENT_WINDOW_MINUTES);
    let attempt = await this.claimAttempt(order, expiresAt);

    for (let round = 0; ; round += 1) {
      try {
        const session = await gateway.createSession({
          attemptId: attempt.id,
          orderId: order.id,
          amountMinor: toMinorUnits(order.grandTotal),
          currency: order.currency,
          productName: `Astrum order ${order.id}`,
          expiresAt,
          successUrl: `${storefrontUrl}/orders/${order.id}?payment=return`,
          cancelUrl: `${storefrontUrl}/orders/${order.id}?payment=cancelled`,
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
        if (error instanceof IdempotencyKeyReusedError && round === 0) {
          logger.warn({
            event: "payment.attempt.retired",
            orderId: order.id,
            attemptId: attempt.id,
            reason: describe(error),
          });

          attempt = await this.retireAndClaim(order, expiresAt, attempt.id);

          continue;
        }

        logger.error({
          event: "payment.session.failed",
          orderId: order.id,
          attemptId: attempt.id,
          reason: describe(error),
        });

        throw providerUnavailable();
      }
    }
  }

  /**
   * Retires the attempt whose key the provider refuses and hands back a fresh
   * row, so the next create call carries a key nobody has used yet.
   */
  private async retireAndClaim(
    order: OrderWithLines,
    expiresAt: Date,
    attemptId: string,
  ): Promise<Payment> {
    await prisma.payment.updateMany({
      where: { id: attemptId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });

    return this.claimAttempt(order, expiresAt);
  }

  /** The attempt row plus the deadline, refreshed together (AC-4). */
  private async claimAttempt(
    order: OrderWithLines,
    expiresAt: Date,
  ): Promise<Payment> {
    const pending = await prisma.payment.findFirst({
      where: { orderId: order.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    const attempt = pending ?? (await this.createAttempt(order, expiresAt));

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
  }

  private async createAttempt(
    order: OrderWithLines,
    expiresAt: Date,
  ): Promise<Payment> {
    try {
      return await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "STRIPE",
          amount: order.grandTotal,
          currency: order.currency,
          status: "PENDING",
          expiresAt,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const raced = await prisma.payment.findFirst({
        where: { orderId: order.id, status: "PENDING" },
      });

      if (raced === null) {
        throw error;
      }

      return raced;
    }
  }

  /** The window closed before the sweep noticed: close it in this request (AC-4). */
  private async closeExpiredWindow(orderId: string): Promise<void> {
    const attempt = await newestOpenAttempt(orderId);

    if (attempt !== null) {
      await inTransaction((tx) =>
        applyExpiredEvent(tx, orderId, attempt.id),
      );

      return;
    }

    await inTransaction(async (tx) => {
      await lockOrder(tx, orderId);

      const order = await tx.order.findFirstOrThrow({
        where: { id: orderId },
        include: { OrderItem: true },
      });

      if (order.status !== "PENDING") {
        return;
      }

      await closeOrder(tx, order);
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: "CANCELLED" },
      });
    });
  }

  private async currentStatus(order: OrderWithLines): Promise<SyncPaymentResult> {
    const fresh = await prisma.order.findFirstOrThrow({
      where: { id: order.id },
      select: {
        paymentStatus: true,
        status: true,
        paymentExpiresAt: true,
      },
    });

    return fresh;
  }
}

export const paymentService = new PaymentService();
