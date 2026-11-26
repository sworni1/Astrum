export const AUTH_COOKIE_NAME = "__auth";

export const SESSION_REFUSAL_CODES = {
  missing: "SESSION_MISSING",
  tokenInvalid: "TOKEN_INVALID",
  revoked: "SESSION_REVOKED",
  storeUnavailable: "SESSION_STORE_UNAVAILABLE",
} as const;

export const SESSION_REFUSAL_MESSAGES = {
  missing: "The session cookie is missing",
  tokenInvalid: "Invalid or expired token",
  revoked: "The session is no longer valid",
  storeUnavailable: "The session store is unavailable",
} as const;
