import axios from "axios";

export type SellerErrorKind = "none" | "notSeller" | "disabled" | "failure";

type RefusalBody = { code?: unknown; from?: unknown; to?: unknown };

export const sellerRefusalBody = (error: unknown): RefusalBody => {
  if (!axios.isAxiosError(error)) {
    return {};
  }

  const data: unknown = error.response?.data;

  if (typeof data !== "object" || data === null) {
    return {};
  }

  return data as RefusalBody;
};

export const sellerErrorCode = (error: unknown): string | undefined => {
  const { code } = sellerRefusalBody(error);

  return typeof code === "string" ? code : undefined;
};

/**
 * The list route answers three refusals the screen renders as a screen of
 * their own, and everything else is a failure with a retry.
 */
export const sellerErrorKind = (error: unknown): SellerErrorKind => {
  if (!error) {
    return "none";
  }

  const code = sellerErrorCode(error);

  if (code === "SELLER_NOT_ASSIGNED") {
    return "notSeller";
  }

  if (code === "SELLER_ORDER_WORKFLOW_DISABLED") {
    return "disabled";
  }

  return "failure";
};
