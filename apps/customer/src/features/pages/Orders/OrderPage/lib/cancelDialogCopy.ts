import { PaymentStatus } from "@/common/types/order.types";

/**
 * A pending payment is cancelled together with the order (spec 0002, AC-12), so
 * the dialog says so. A payment already taken gets no sentence: this project has
 * no refund path and no string may promise money back (spec 0011, AC-3).
 */
export const showsPaymentSentence = (paymentStatus: PaymentStatus): boolean =>
  paymentStatus === PaymentStatus.PENDING;
