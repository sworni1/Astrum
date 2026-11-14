/** The same names the auth service publishes with and the worker consumes. */
export const EVENTS_EXCHANGE = "astrum.events";

export const CONFIRMATION_ROUTING_KEY = "account.confirmation.requested";

/** An email change never waits more than this long on the broker. */
export const PUBLISH_TIMEOUT_MS = 2_000;
