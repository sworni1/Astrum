export const EVENTS_EXCHANGE = "astrum.events";

export const CONFIRMATION_ROUTING_KEY = "account.confirmation.requested";

export const PUBLISH_TIMEOUT_MS = 2_000;

export const EVENTS_EXCHANGE_TYPE = "direct";

export const EVENTS_EXCHANGE_OPTIONS = { durable: true };

export const PERSISTENT_JSON_PUBLISH_OPTIONS = {
  persistent: true,
  contentType: "application/json",
};
