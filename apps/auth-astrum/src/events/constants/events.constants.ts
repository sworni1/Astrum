export const EVENTS_EXCHANGE = "astrum.events";

export const CONFIRMATION_ROUTING_KEY = "account.confirmation.requested";

export const PUBLISH_TIMEOUT_MS = 2_000;

export const RABBITMQ_URL_VARIABLE = "RABBITMQ_URL";

export const EXCHANGE_TYPE_DIRECT = "direct";

export const DURABLE_EXCHANGE_OPTIONS = {
  durable: true,
} as const;

export const PERSISTENT_JSON_PUBLISH_OPTIONS = {
  persistent: true,
  contentType: "application/json",
} as const;
