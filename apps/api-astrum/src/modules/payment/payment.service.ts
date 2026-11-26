import { PaymentMethod, PaymentStatus } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../common/helpers/logger";
import { describeError } from "../../events/describe-error";
import type { OrderWithLines } from "../order/order-status";
import {
  ORDER_WITH_LINES_INCLUDE,
  PAYMENT_STATUS_SELECT,
} from "./constants/payment.constants";
import {
  alreadyPaid,
  notPayable,
  orderNotFound,
  providerUnavailable,
  windowExpired,
} from "./helpers/payment.errors";
import { newestOpenAttempt, reusableAttempt } from "./payment.attempts";
import { applySession } from "./payment.dispatch";
import { closeExpiredWindow } from "./payment.expiry";
import type { PaymentGateway } from "./payment.gateway";
import { paymentGateway } from "./payment.gateway.registry";
import { openSession } from "./payment.session";
import type { StartPaymentResult } from "./types/payment.types";

type SyncPaymentResult = {
  paymentStatus: string;
  status: string;
  paymentExpiresAt: Date | null;
};

export class PaymentService {
  constructor(
    private readonly resolveGateway: () => PaymentGateway | null = paymentGateway,
  ) {}

  async startPayment(
    orderId: string,
    userId: string,
  ): Promise<StartPaymentResult> {
    const order = await this.loadOwnOrder(orderId, userId);

    if (order.paymentMethod !== PaymentMethod.ONLINE_CARD) {
      throw notPayable();
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw alreadyPaid();
    }

    const now = new Date();

    if (
      order.paymentExpiresAt === null ||
      order.paymentExpiresAt.getTime() <= now.getTime()
    ) {
      await closeExpiredWindow(order.id);
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

    return await openSession(this.gatewayOrRefuse(), order, now);
  }

  async syncPayment(
    orderId: string,
    userId: string,
  ): Promise<SyncPaymentResult> {
    const order = await this.loadOwnOrder(orderId, userId);

    if (order.paymentMethod !== PaymentMethod.ONLINE_CARD) {
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
      include: ORDER_WITH_LINES_INCLUDE,
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
        reason: describeError(error),
      });

      throw providerUnavailable();
    }
  }

  private async currentStatus(
    order: OrderWithLines,
  ): Promise<SyncPaymentResult> {
    const fresh = await prisma.order.findFirstOrThrow({
      where: { id: order.id },
      select: PAYMENT_STATUS_SELECT,
    });

    return fresh;
  }
}

export const paymentService = new PaymentService();
