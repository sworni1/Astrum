import axios from "axios";
import type { ReviewValidationError } from "@/common/types/review.types";

export type ReviewRefusal =
  | "notDelivered"
  | "alreadyReviewed"
  | "invalid"
  | "generic"
  | "unconfirmed"
  | "emailNotConfirmed";

type RefusalBody = {
  code?: string;
  errors?: ReviewValidationError[];
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

export const classifyReviewRefusal = (error: unknown): ReviewRefusal => {
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

  if (body?.code === "REVIEW_ONLY_AFTER_DELIVERY") {
    return "notDelivered";
  }

  if (body?.code === "REVIEW_ALREADY_EXISTS") {
    return "alreadyReviewed";
  }

  if (body?.code === "EMAIL_NOT_CONFIRMED") {
    return "emailNotConfirmed";
  }

  if (status >= 400 && status < 500) {
    return "generic";
  }

  return "unconfirmed";
};

export const fieldErrorsOf = (
  error: unknown,
): { property: string; message: string }[] => {
  const errors = bodyOf(error)?.errors;

  if (!Array.isArray(errors)) {
    return [];
  }

  return errors.flatMap((entry) => {
    const message = Object.values(entry.constraints ?? {})[0];

    return entry.property && message
      ? [{ property: entry.property, message }]
      : [];
  });
};
