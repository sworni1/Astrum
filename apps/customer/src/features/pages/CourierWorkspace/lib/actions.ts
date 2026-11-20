import type { CourierOrderActionName } from "@/hooks/staff/useCourierOrderAction";
import type { CourierScope } from "@/hooks/staff/courierOrder.types";

export const ACTIONS_BY_SCOPE: Record<
  CourierScope,
  readonly CourierOrderActionName[]
> = {
  available: ["claim"],
  mine: ["handover", "cancel", "release"],
};

export const SUCCESS_KEY = {
  claim: "successClaim",
  release: "successRelease",
  handover: "successHandover",
  cancel: "successCancel",
} as const satisfies Record<CourierOrderActionName, string>;
