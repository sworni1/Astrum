import {
  createStripeGateway,
  type PaymentGateway,
} from "./payment.gateway";
import { paymentProviderConfig } from "./payment.config";

let override: PaymentGateway | null = null;

let created: PaymentGateway | null = null;

/** Tests replace the provider here; the app never does (Feature design). */
export const setPaymentGateway = (replacement: PaymentGateway | null): void => {
  override = replacement;
};

/**
 * The provider, or `null` while its secrets are missing: the routes answer their
 * own coded refusal instead of throwing at boot (AC-1).
 */
export const paymentGateway = (): PaymentGateway | null => {
  if (override !== null) {
    return override;
  }

  const { configured, secretKey, webhookSecret } = paymentProviderConfig;

  if (!configured || secretKey === null || webhookSecret === null) {
    return null;
  }

  created ??= createStripeGateway(secretKey, webhookSecret);

  return created;
};
