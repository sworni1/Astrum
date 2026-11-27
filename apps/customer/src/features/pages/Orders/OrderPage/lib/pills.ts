import { OrderItemStatus, PaymentStatus } from "@/common/types/order.types";
import type { PillTone } from "@/features/pages/Orders/OrderPage/lib/status";

export const PILL_CLASS =
  "inline-flex items-center rounded-full border px-2.5 py-[3px] text-[12.5px] font-medium whitespace-nowrap";

export const PILL_TONE_CLASSES: Record<PillTone, string> = {
  success: "bg-success/10 border-success/20 text-success",
  destructive:
    "bg-destructive-line/20 border-destructive-line/40 text-destructive-soft",
  neutral: "bg-surface-raised border-border text-muted-foreground",
};

const LINE_TONES: Partial<Record<OrderItemStatus, PillTone>> = {
  [OrderItemStatus.CANCELLED]: "destructive",
  [OrderItemStatus.RETURNED]: "destructive",
  [OrderItemStatus.OUT_OF_STOCK]: "neutral",
};

export const lineTone = (status: OrderItemStatus): PillTone | null =>
  LINE_TONES[status] ?? null;

export const PAYMENT_TONES: Record<PaymentStatus, PillTone> = {
  [PaymentStatus.PAID]: "success",
  [PaymentStatus.PENDING]: "neutral",
  [PaymentStatus.FAILED]: "destructive",
  [PaymentStatus.REFUNDED]: "destructive",
  [PaymentStatus.CANCELLED]: "destructive",
};

export const paymentTone = (status: PaymentStatus): PillTone =>
  PAYMENT_TONES[status] ?? "neutral";
