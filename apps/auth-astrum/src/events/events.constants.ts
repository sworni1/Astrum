/** The one event stream of the shop; the worker consumes from the same names. */
export const EVENTS_EXCHANGE = "astrum.events";

export const CONFIRMATION_ROUTING_KEY = "account.confirmation.requested";

/** A signup waits at most this long for the broker, then answers anyway. */
export const PUBLISH_TIMEOUT_MS = 2_000;
