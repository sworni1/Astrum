import {
  OrderItemStatus,
  type SellerOrderLine,
} from "@/common/types/order.types";

/** The statuses one handover delivers, mirrored from the gateway rule. */
export const HANDOVER_READY_STATUSES: readonly OrderItemStatus[] = [
  OrderItemStatus.CONFIRMED,
  OrderItemStatus.SHIPPED,
];

/** The number the confirmation dialog names and the rule behind the control. */
export const handoverableCount = (lines: readonly SellerOrderLine[]): number =>
  lines.filter((line) => HANDOVER_READY_STATUSES.includes(line.status)).length;
