import Stripe from "stripe";

/** The values a session create carries, so no builder invents one (Feature design). */
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

/** One session as the apply path reads it, already unwrapped from the provider. */
export type ProviderSession = {
  id: string;
  status: string | null;
  paymentStatus: string | null;
  amountTotal: number | null;
  currency: string | null;
  paymentIntentId: string | null;
  orderId: string | null;
};

/** One delivered event, in the shape the event log and the apply path share. */
export type ProviderEvent = {
  id: string;
  type: string;
  sessionId: string | null;
  paymentIntentId: string | null;
  orderId: string | null;
  amount: number | null;
  currency: string | null;
  sessionStatus: string | null;
  paymentStatus: string | null;
  declineCode: string | null;
  errorMessage: string | null;
};

export interface PaymentGateway {
  createSession(input: CreateSessionInput): Promise<CreatedSession>;
  retrieveSession(sessionId: string): Promise<ProviderSession>;
  expireSession(sessionId: string): Promise<void>;
  constructEvent(payload: Buffer, signature: string): ProviderEvent;
}

/** A signature the provider would not vouch for; the route answers 400 (AC-5). */
export class InvalidSignatureError extends Error {
  constructor() {
    super("The signature of this callback is not valid.");
    this.name = "InvalidSignatureError";
  }
}

/**
 * The provider binds an idempotency key to the parameters of its first use, so a
 * key whose payload changed (a new field in the create call) is refused for a
 * day. The caller retires that attempt and opens a fresh one (AC-4).
 */
export class IdempotencyKeyReusedError extends Error {
  constructor(key: string) {
    super(`The provider refused the idempotency key ${key} for another payload.`);
    this.name = "IdempotencyKeyReusedError";
  }
}

const isIdempotencyRefusal = (error: unknown): boolean =>
  error instanceof Stripe.errors.StripeIdempotencyError ||
  (typeof error === "object" &&
    error !== null &&
    (error as { type?: unknown }).type === "StripeIdempotencyError");

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const asText = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" ? value : null;

const readOrderId = (record: Record<string, unknown>): string | null =>
  asText(asRecord(record.metadata).order_id);

const toPaymentIntentId = (value: unknown): string | null => {
  if (typeof value === "string") {
    return asText(value);
  }

  return asText(asRecord(value).id);
};

const toProviderSession = (value: unknown): ProviderSession => {
  const record = asRecord(value);

  return {
    id: String(record.id ?? ""),
    status: asText(record.status),
    paymentStatus: asText(record.payment_status),
    amountTotal: asNumber(record.amount_total),
    currency: asText(record.currency),
    paymentIntentId: toPaymentIntentId(record.payment_intent),
    orderId: readOrderId(record),
  };
};

/**
 * A session event and an intent event are flattened into one record: the log
 * stores exactly these fields and never the customer name or email (AC-5).
 */
const toProviderEvent = (value: unknown): ProviderEvent => {
  const event = asRecord(value);
  const object = asRecord(event.data && asRecord(event.data).object);
  const isSession = String(event.type ?? "").startsWith("checkout.session.");

  return {
    id: String(event.id ?? ""),
    type: String(event.type ?? ""),
    sessionId: isSession ? asText(object.id) : asText(object.checkout_session),
    paymentIntentId: isSession
      ? toPaymentIntentId(object.payment_intent)
      : asText(object.id),
    orderId: readOrderId(object),
    amount: isSession ? asNumber(object.amount_total) : asNumber(object.amount),
    currency: asText(object.currency),
    sessionStatus: isSession ? asText(object.status) : null,
    paymentStatus: isSession ? asText(object.payment_status) : asText(object.status),
    declineCode: asText(
      asRecord(object.last_payment_error).decline_code,
    ) ?? asText(asRecord(object.last_payment_error).code),
    errorMessage: asText(asRecord(object.last_payment_error).message),
  };
};

/**
 * The provider sits behind this one adapter, so the apply path is fed plain
 * records and a test can fake Stripe without a network (Feature design).
 */
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
        throw new Error("The provider answered a session with no checkout URL.");
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
