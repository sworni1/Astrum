import { PaymentStatus } from "@/common/types/order.types";

export const showsPaymentSentence = (paymentStatus: PaymentStatus): boolean =>
  paymentStatus === PaymentStatus.PENDING;
