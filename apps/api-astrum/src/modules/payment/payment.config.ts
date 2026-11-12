import { logger } from "../../common/helpers/logger";

export const STRIPE_SECRET_KEY_VARIABLE = "STRIPE_SECRET_KEY";
export const STRIPE_WEBHOOK_SECRET_VARIABLE = "STRIPE_WEBHOOK_SECRET";

export type ProviderConfig = {
  secretKey: string | null;
  webhookSecret: string | null;
  missing: string[];
  configured: boolean;
};

const readVariable = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === "" ? null : trimmed;
};

/**
 * Both secrets come from the environment and nowhere else (AC-1, security
 * model). One value read at module load, no throw, so an unconfigured gateway
 * still boots.
 */
export const readProviderConfig = (env: NodeJS.ProcessEnv): ProviderConfig => {
  const secretKey = readVariable(env[STRIPE_SECRET_KEY_VARIABLE]);
  const webhookSecret = readVariable(env[STRIPE_WEBHOOK_SECRET_VARIABLE]);
  const missing = [
    ...(secretKey === null ? [STRIPE_SECRET_KEY_VARIABLE] : []),
    ...(webhookSecret === null ? [STRIPE_WEBHOOK_SECRET_VARIABLE] : []),
  ];

  return {
    secretKey,
    webhookSecret,
    missing,
    configured: missing.length === 0,
  };
};

export const paymentProviderConfig = readProviderConfig(process.env);

if (!paymentProviderConfig.configured) {
  logger.warn({
    event: "payment.provider.unconfigured",
    missing: paymentProviderConfig.missing,
  });
}

/** The storefront origin the provider sends the customer back to (AC-14). */
export const storefrontUrl = (
  process.env.STOREFRONT_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");
