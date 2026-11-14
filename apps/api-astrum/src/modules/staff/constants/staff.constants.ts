/** Machine readable codes the storefront branches on (spec 0017, AC-14). */
export const STAFF_ERROR_CODES = {
  validation: "VALIDATION",
  notPointWorker: "NOT_POINT_WORKER",
  notCourier: "NOT_COURIER",
  roleUnavailable: "STAFF_ROLE_UNAVAILABLE",
  unknownPickupPoint: "UNKNOWN_PICKUP_POINT",
  pickupPointInactive: "PICKUP_POINT_INACTIVE",
  orderNotShipped: "ORDER_NOT_SHIPPED",
  alreadyHandedOver: "ALREADY_HANDED_OVER",
  alreadyClaimed: "ALREADY_CLAIMED",
  nothingToCancel: "NOTHING_TO_CANCEL",
} as const;
