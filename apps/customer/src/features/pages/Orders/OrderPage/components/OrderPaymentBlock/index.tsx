import { CreditCard } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { type Order, PaymentStatus } from "@/common/types/order.types";
import PaymentActions from "@/features/pages/Orders/OrderPage/components/PaymentActions";
import Pill from "@/features/pages/Orders/OrderPage/components/Pill";
import {
  PAYMENT_KEYS,
  paymentStatusKey,
} from "@/features/pages/Orders/OrderPage/lib/payment";
import { paymentTone } from "@/features/pages/Orders/OrderPage/lib/pills";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";
import type { PaymentReturnBranch } from "@/hooks/order/useSyncOrderPayment";

type Props = {
  order: Order;
  paymentBranch: PaymentReturnBranch;
};

/**
 * How the order pays: the method, the payment status pill and one second line,
 * the paid instant or the deadline still ahead. The pay control keeps its place
 * and its four window states (spec 0027, AC-4).
 */
const OrderPaymentBlock = ({ order, paymentBranch }: Props) => {
  const t = useTranslations("orders");
  const format = useFormatter();
  const statusKey = paymentStatusKey(order.paymentStatus);

  const secondLine = (): string | null => {
    if (order.paymentStatus === PaymentStatus.PAID && order.paidAt !== null) {
      return format.dateTime(new Date(order.paidAt), {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: browserTimeZone(),
      });
    }

    if (order.paymentExpiresAt !== null) {
      return t("payment.payBefore", {
        time: format.dateTime(new Date(order.paymentExpiresAt), {
          timeStyle: "short",
          timeZone: browserTimeZone(),
        }),
      });
    }

    return null;
  };

  const second = secondLine();

  return (
    <div
      className="rounded-stat border border-border bg-background p-5"
      data-testid="order-payment-block"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-secondary">
          <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="flex-1 font-medium">{t("paymentMethod")}</div>
        <Pill
          tone={paymentTone(order.paymentStatus)}
          testId="order-payment-pill"
        >
          {statusKey ? t(`paymentStatus.${statusKey}`) : order.paymentStatus}
        </Pill>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <p>{t(`payment.${PAYMENT_KEYS[order.paymentMethod]}`)}</p>
        {second ? <p className="text-[13px] text-muted-foreground">{second}</p> : null}
      </div>
      <div className="mt-3">
        <PaymentActions order={order} branch={paymentBranch} />
      </div>
    </div>
  );
};

export default OrderPaymentBlock;
