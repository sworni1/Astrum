export const GUEST_COOKIE_NAME = "__guest";

/** Only a token of this type is a guest identity (spec 0028, AC-5). */
export const GUEST_TOKEN_TYPE = "guest";

export const GUEST_COOKIE_MAX_AGE_DAYS = 30;

/** A guest row nobody came back for dies after this many days (AC-16). */
export const GUEST_RETENTION_DAYS = 30;

export const GUEST_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const GUEST_SWEEP_LOCK_KEY = 728450311;
