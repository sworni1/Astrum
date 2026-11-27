import { refusalCode } from "@/common/helpers/apiRefusal";

export type SellerErrorKind = "none" | "notSeller" | "failure";

export const sellerErrorCode = refusalCode;

export const sellerErrorKind = (error: unknown): SellerErrorKind => {
  if (!error) {
    return "none";
  }

  const code = sellerErrorCode(error);

  if (code === "SELLER_NOT_ASSIGNED") {
    return "notSeller";
  }

  return "failure";
};
