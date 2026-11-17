import {
  OrderItemStatus,
  PaymentStatus,
} from "@/common/types/order.types";
import type { PillTone } from "@/features/pages/Orders/OrderPage/lib/status";

/** The one pill element this screen draws (spec 0027, AC-8). */
export const PILL_CLASS =
  "inline-flex items-center rounded-full border px-2.5 py-[3px] text-[12.5px] font-medium whitespace-nowrap";

/** The three token sets; no pill ever reads a Tailwind palette class (AC-8). */
export const PILL_TONE_CLASSES: Record<PillTone, string> = {
  success: "bg-success/10 border-success/20 text-success",
  destructive:
    "bg-destructive-line/20 border-destructive-line/40 text-destructive-soft",
  neutral: "bg-surface-raised border-border text-muted-foreground",
};

/** The line states that print a pill; every other line prints none (AC-3). */
const LINE_TONES: Partial<Record<OrderItemStatus, PillTone>> = {
  [OrderItemStatus.CANCELLED]: "destructive",
  [OrderItemStatus.RETURNED]: "destructive",
  [OrderItemStatus.OUT_OF_STOCK]: "neutral",
};

/** The tone of a line status, or null when that line prints no pill. */
export const lineTone = (status: OrderItemStatus): PillTone | null =>
  LINE_TONES[status] ?? null;

/** The payment states, on the same three sets as the order status (AC-8). */
export const PAYMENT_TONES: Record<PaymentStatus, PillTone> = {
  [PaymentStatus.PAID]: "success",
  [PaymentStatus.PENDING]: "neutral",
  [PaymentStatus.FAILED]: "destructive",
  [PaymentStatus.REFUNDED]: "destructive",
  [PaymentStatus.CANCELLED]: "destructive",
};

/** A payment status outside the enum reads neutral, never blank (AC-8). */
export const paymentTone = (status: PaymentStatus): PillTone =>
  PAYMENT_TONES[status] ?? "neutral";
