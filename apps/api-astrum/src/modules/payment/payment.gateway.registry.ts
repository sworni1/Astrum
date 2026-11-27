import { paymentProviderConfig } from "./payment.config";
import { createStripeGateway, type PaymentGateway } from "./payment.gateway";

let override: PaymentGateway | null = null;

let created: PaymentGateway | null = null;

export const setPaymentGateway = (replacement: PaymentGateway | null): void => {
  override = replacement;
};

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
