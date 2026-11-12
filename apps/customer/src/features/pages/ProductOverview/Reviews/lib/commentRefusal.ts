import axios from "axios";

/**
 * What the thread does with a refusal, keyed by the answer the gateway gave
 * (spec 0014, AC-9). `emailNotConfirmed` raises no toast here: the shared
 * fetcher already raised the confirmation toast with its resend action.
 */
export type CommentRefusal =
  | "invalid"
  | "rateLimited"
  | "generic"
  | "unconfirmed"
  | "emailNotConfirmed";

type RefusalBody = {
  code?: string;
  errors?: unknown[];
};

const bodyOf = (error: unknown): RefusalBody | null => {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const data: unknown = error.response?.data;

  if (typeof data !== "object" || data === null) {
    return null;
  }

  return data as RefusalBody;
};

export const classifyCommentRefusal = (error: unknown): CommentRefusal => {
  if (!axios.isAxiosError(error)) {
    return "unconfirmed";
  }

  const status = error.response?.status;

  // No answer at all: the gateway may have written the row before the answer
  // was lost, so the customer is told the result is unknown.
  if (!status) {
    return "unconfirmed";
  }

  const body = bodyOf(error);

  if (status === 400 && Array.isArray(body?.errors) && body.errors.length > 0) {
    return "invalid";
  }

  if (body?.code === "REVIEW_COMMENT_RATE_LIMITED") {
    return "rateLimited";
  }

  if (body?.code === "EMAIL_NOT_CONFIRMED") {
    return "emailNotConfirmed";
  }

  if (status >= 400 && status < 500) {
    return "generic";
  }

  return "unconfirmed";
};

/** The copy key each refusal raises, under the `reviews` namespace (AC-13). */
export const COMMENT_REFUSAL_KEYS = {
  invalid: "comments.refused.invalid",
  rateLimited: "comments.refused.rateLimited",
  generic: "comments.refused.generic",
  unconfirmed: "comments.refused.unconfirmed",
} as const;
