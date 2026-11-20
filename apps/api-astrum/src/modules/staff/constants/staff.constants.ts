export const STAFF_ERROR_CODES = {
  validation: "VALIDATION",
  notPointWorker: "NOT_POINT_WORKER",
  notCourier: "NOT_COURIER",
  roleUnavailable: "STAFF_ROLE_UNAVAILABLE",
  unknownPickupPoint: "UNKNOWN_PICKUP_POINT",
  pickupPointInactive: "PICKUP_POINT_INACTIVE",
  orderNotDelivered: "ORDER_NOT_DELIVERED",
  alreadyHandedOver: "ALREADY_HANDED_OVER",
  alreadyClaimed: "ALREADY_CLAIMED",
  nothingToCancel: "NOTHING_TO_CANCEL",
} as const;
