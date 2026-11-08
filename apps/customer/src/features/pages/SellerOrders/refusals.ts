import { showToast } from "../../../common";
import { sellerErrorCode, sellerRefusalBody } from "../../../hooks/seller";

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

  if (code === "VALIDATION") {
    return { key: "validation", retry: false };
  }

  if (code === "EMAIL_NOT_CONFIRMED") {
    return { key: "emailNotConfirmed", retry: false };
  }

  if (code === "SELLER_ORDER_WORKFLOW_DISABLED") {
    return { key: "workflowDisabled", retry: false };
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
