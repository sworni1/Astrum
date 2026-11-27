import {
  STRIPE_SECRET_KEY_VARIABLE,
  STRIPE_WEBHOOK_SECRET_VARIABLE,
} from "../constants/payment.constants";

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
