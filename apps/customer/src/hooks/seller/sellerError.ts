import { refusalBody, refusalCode } from "@/common/helpers/apiRefusal";

export type SellerErrorKind = "none" | "notSeller" | "disabled" | "failure";

export const sellerRefusalBody = refusalBody;

export const sellerErrorCode = refusalCode;

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
