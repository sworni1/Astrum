import { refusalCode } from "@/common/helpers/apiRefusal";
import { showToast } from "@/common/helpers/showToast";

export type Translate = (
  key: string,
  values?: Record<string, string>,
) => string;

export type RefusalToast = { key: string; retry: boolean };

const REFUSALS: Record<string, RefusalToast> = {
  ORDER_NOT_FOUND: { key: "orderNotFound", retry: false },
  ORDER_NOT_DELIVERED: { key: "notDelivered", retry: false },
  ALREADY_HANDED_OVER: { key: "alreadyHandedOver", retry: false },
  NOTHING_TO_CANCEL: { key: "nothingToCancel", retry: false },
  PICKUP_POINT_INACTIVE: { key: "pointInactive", retry: false },
  NOT_POINT_WORKER: { key: "notPointWorker", retry: false },
  STAFF_ROLE_UNAVAILABLE: { key: "roleUnavailable", retry: false },
  ACCOUNT_STATUS_UNAVAILABLE: { key: "accountStatusUnavailable", retry: true },
  VALIDATION: { key: "validation", retry: false },
};

export const refusalToastFor = (error: unknown): RefusalToast => {
  const code = refusalCode(error);

  if (code !== undefined && REFUSALS[code] !== undefined) {
    return REFUSALS[code];
  }

  return { key: "generic", retry: true };
};

export const showRefusalToast = (
  error: unknown,
  t: Translate,
  onRetry: () => void,
): void => {
  const { key, retry } = refusalToastFor(error);

  showToast({
    title: t(`point.queue.refusals.${key}`),
    type: "error",
    ...(retry
      ? { action: { label: t("point.queue.refusals.retry"), onClick: onRetry } }
      : {}),
  });
};
