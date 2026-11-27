import axios from "axios";

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

export const COMMENT_REFUSAL_KEYS = {
  invalid: "comments.refused.invalid",
  rateLimited: "comments.refused.rateLimited",
  generic: "comments.refused.generic",
  unconfirmed: "comments.refused.unconfirmed",
} as const;
