import type { CourierOrderActionName } from "@/hooks/staff/useCourierOrderAction";
import type { CourierScope } from "@/hooks/staff/courierOrder.types";

/** The controls a card carries: one on a pool card, three on a claimed one (AC-11). */
export const ACTIONS_BY_SCOPE: Record<
  CourierScope,
  readonly CourierOrderActionName[]
> = {
  available: ["claim"],
  mine: ["handover", "cancel", "release"],
};

/** The success line a section announces once an action landed (AC-13). */
export const SUCCESS_KEY = {
  claim: "successClaim",
  release: "successRelease",
  handover: "successHandover",
  cancel: "successCancel",
} as const satisfies Record<CourierOrderActionName, string>;
