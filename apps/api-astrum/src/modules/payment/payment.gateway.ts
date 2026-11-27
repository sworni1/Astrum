import Stripe from "stripe";
import {
  IdempotencyKeyReusedError,
  InvalidSignatureError,
} from "./helpers/payment.errors";
import {
  isIdempotencyRefusal,
  toProviderEvent,
  toProviderSession,
} from "./helpers/payment.gateway.helpers";
import type { ProviderEvent, ProviderSession } from "./types/payment.types";

export type CreateSessionInput = {
  attemptId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  productName: string;
  expiresAt: Date;
  successUrl: string;
  cancelUrl: string;
};

export type CreatedSession = { sessionId: string; url: string };

export interface PaymentGateway {
  createSession(input: CreateSessionInput): Promise<CreatedSession>;
  retrieveSession(sessionId: string): Promise<ProviderSession>;
  expireSession(sessionId: string): Promise<void>;
  constructEvent(payload: Buffer, signature: string): ProviderEvent;
}

export const createStripeGateway = (
  secretKey: string,
  webhookSecret: string,
): PaymentGateway => {
  const client = new Stripe(secretKey);

  return {
    async createSession(input: CreateSessionInput): Promise<CreatedSession> {
      let session: Stripe.Checkout.Session;

      try {
        session = await client.checkout.sessions.create(
          {
            mode: "payment",
            managed_payments: { enabled: false },
            client_reference_id: input.orderId,
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            expires_at: Math.floor(input.expiresAt.getTime() / 1000),
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: input.currency.toLowerCase(),
                  unit_amount: input.amountMinor,
                  product_data: { name: input.productName },
                },
              },
            ],
            metadata: { order_id: input.orderId },
            payment_intent_data: { metadata: { order_id: input.orderId } },
          },
          { idempotencyKey: input.attemptId },
        );
      } catch (error) {
        if (isIdempotencyRefusal(error)) {
          throw new IdempotencyKeyReusedError(input.attemptId);
        }

        throw error;
      }

      if (session.url === null) {
        throw new Error(
          "The provider answered a session with no checkout URL.",
        );
      }

      return { sessionId: session.id, url: session.url };
    },

    async retrieveSession(sessionId: string): Promise<ProviderSession> {
      const session = await client.checkout.sessions.retrieve(sessionId);

      return toProviderSession(session);
    },

    async expireSession(sessionId: string): Promise<void> {
      await client.checkout.sessions.expire(sessionId);
    },

    constructEvent(payload: Buffer, signature: string): ProviderEvent {
      try {
        return toProviderEvent(
          client.webhooks.constructEvent(payload, signature, webhookSecret),
        );
      } catch {
        throw new InvalidSignatureError();
      }
    },
  };
};
