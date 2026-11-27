import { logger } from "../../common/helpers/logger";
import { DEFAULT_STOREFRONT_URL } from "./constants/payment.constants";
import { readProviderConfig } from "./helpers/payment.config.helpers";

export const paymentProviderConfig = readProviderConfig(process.env);

if (!paymentProviderConfig.configured) {
  logger.warn({
    event: "payment.provider.unconfigured",
    missing: paymentProviderConfig.missing,
  });
}

export const storefrontUrl = (
  process.env.STOREFRONT_URL ?? DEFAULT_STOREFRONT_URL
).replace(/\/+$/, "");
