import { CONFIRM_REDIRECT_PATH } from "../constants/auth.constants";
import type { ConfirmOutcome } from "../types/auth.types";

export const confirmRedirectUrl = (
  storefrontUrl: string,
  outcome: ConfirmOutcome,
): string => `${storefrontUrl}${CONFIRM_REDIRECT_PATH}?status=${outcome}`;
