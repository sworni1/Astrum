import { showToast } from "@/common/helpers/showToast";
import { sellerErrorCode, sellerRefusalBody } from "@/hooks/seller/sellerError";

export type Translate = (
  key: string,
  values?: Record<string, string>,
) => string;

export type RefusalToast = {
  key: string;
  values?: Record<string, string>;
  retry: boolean;
};

/**
 * The gateway answers English prose, so the panel shows its own text keyed by
 * the machine readable code. Only an unreadable account state and a server
 * fault are worth a retry: the rest needs a person to act.
 */
export const refusalToastFor = (error: unknown): RefusalToast => {
  const code = sellerErrorCode(error);

  if (code === "INVALID_STATUS_TRANSITION") {
    const { from, to } = sellerRefusalBody(error);

    if (typeof from === "string" && typeof to === "string") {
      return { key: "invalidTransition", values: { from, to }, retry: false };
    }
  }

  if (code === "ORDER_ITEM_NOT_FOUND") {
    return { key: "orderItemNotFound", retry: false };
  }

  if (code === "NOTHING_TO_HAND_OVER") {
    return { key: "nothingToHandOver", retry: false };
  }

  if (code === "ORDER_NOT_FOUND") {
    return { key: "orderNotFound", retry: false };
  }

  if (code === "VALIDATION") {
    return { key: "validation", retry: false };
  }

  if (code === "EMAIL_NOT_CONFIRMED") {
    return { key: "emailNotConfirmed", retry: false };
  }

  if (code === "ACCOUNT_STATUS_UNAVAILABLE") {
    return { key: "accountStatusUnavailable", retry: true };
  }

  return { key: "generic", retry: true };
};

export const showRefusalToast = (
  error: unknown,
  t: Translate,
  onRetry: () => void,
): void => {
  const { key, values, retry } = refusalToastFor(error);

  showToast({
    title: t(`toasts.${key}`, values),
    type: "error",
    ...(retry
      ? { action: { label: t("toasts.retry"), onClick: onRetry } }
      : {}),
  });
};

/**
 * The handover answers with its own wording for a fault: a `500` or a client
 * timeout reads `handoverFailed`, while every coded refusal keeps its text
 * (spec 0013, AC-13).
 */
export const showHandoverToast = (
  error: unknown,
  t: Translate,
  onRetry: () => void,
): void => {
  const { key, values, retry } = refusalToastFor(error);
  const toastKey = key === "generic" ? "handoverFailed" : key;

  showToast({
    title: t(`toasts.${toastKey}`, values),
    type: "error",
    ...(retry
      ? { action: { label: t("toasts.retry"), onClick: onRetry } }
      : {}),
  });
};
