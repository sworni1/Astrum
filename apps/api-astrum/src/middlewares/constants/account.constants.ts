export const ACCOUNT_STATUS_ACTIVE = "ACTIVE";

export const ACCOUNT_ERROR_CODES = {
  statusUnavailable: "ACCOUNT_STATUS_UNAVAILABLE",
  emailNotConfirmed: "EMAIL_NOT_CONFIRMED",
} as const;

export const ACCOUNT_MESSAGES = {
  statusUnavailable: "The account status could not be read",
  emailNotConfirmed: "Confirm the email address to continue",
} as const;
