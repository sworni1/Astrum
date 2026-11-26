export const USER_AGENT_MAX_LENGTH = 512;
export const SESSION_ID_BYTES = 32;
export const JWT_EXPIRES_IN = "1d";
export const JWT_SECRET_KEY = "JWT_SECRET";
export const SESSION_STORE_UNAVAILABLE_CODE = "SESSION_STORE_UNAVAILABLE";
export const UNIQUE_VIOLATION_CODE = "P2002";
export const TOKEN_HASH_ALGORITHM = "sha256";

export const EMAIL_TAKEN = "The user already exists";
export const SESSION_UNAVAILABLE =
  "The session store is unavailable, so no session was started. Try again in a moment.";
export const ACCOUNT_CREATED_SESSION_UNAVAILABLE =
  "The account was created, but the session store is unavailable, so no session was started. Sign in once the store answers again.";

export const RESEND_EMAIL_LIMIT = 3;
export const RESEND_EMAIL_WINDOW_SECONDS = 900;
export const RESEND_IP_LIMIT = 10;
export const RESEND_IP_WINDOW_SECONDS = 3600;
export const RESEND_EMAIL_KEY_PREFIX = "rl:confirm:email:";
export const RESEND_IP_KEY_PREFIX = "rl:confirm:ip:";
export const RESEND_EMAIL_LIMIT_MESSAGE = `${RESEND_EMAIL_LIMIT} requests per ${RESEND_EMAIL_WINDOW_SECONDS / 60} minutes per address`;
export const RESEND_IP_LIMIT_MESSAGE = `${RESEND_IP_LIMIT} requests per hour per IP`;

export const CONFIRM_REDIRECT_PATH = "/auth/confirm-email";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 25;
export const PASSWORD_MIN_LENGTH_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
export const PASSWORD_MAX_LENGTH_MESSAGE = `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters`;

export const NICKNAME_MAX_LENGTH = 25;
export const NICKNAME_MAX_LENGTH_MESSAGE = `Nickname cannot exceed ${NICKNAME_MAX_LENGTH} characters`;

export const MIN_AGE_YEARS = 14;
export const FUTURE_BIRTH_DATE_MESSAGE =
  "Date of birth cannot be in the future";
