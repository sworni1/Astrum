import { CreditCard } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef } from "react";
import { showToast } from "@/common/helpers/showToast";
import type { Order } from "@/common/types/order.types";
import { Button } from "@/components/ui/button";
import {
  canPay,
  lineRefundOwed,
  paymentUnconfirmed,
  paymentWindowPassed,
  refundOwed,
} from "@/features/pages/Orders/OrderPage/lib/payment";
import { paymentRefusal } from "@/features/pages/Orders/OrderPage/lib/paymentRefusal";
import { ICON_SIZE } from "@/features/pages/Orders/OrderPage/lib/styles";
import { usePayOrder } from "@/hooks/order/usePayOrder";
import type { PaymentReturnBranch } from "@/hooks/order/useSyncOrderPayment";

type Props = {
  order: Order;
  /** The branch the provider sent the customer back on, if any (AC-14). */
  branch: PaymentReturnBranch;
};

/** The pay control, its deadline and the lines the payment state owes the customer. */
const PaymentActions = ({ order, branch }: Props) => {
  const t = useTranslations("orders");
  const format = useFormatter();
  const { startPayment, isStarting, revalidateOrder } = usePayOrder(order.id);
  const inFlight = useRef(false);
  const now = new Date();

  const payable = canPay(order, now);
  const missedWindow = paymentWindowPassed(order, now);
  const unconfirmed = paymentUnconfirmed(order);

  const pay = async (): Promise<void> => {
    // A second press while the first request runs sends nothing (AC-13).
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;

    try {
      const answer = await startPayment();

      window.location.assign(answer.url);
    } catch (error) {
      const refusal = paymentRefusal(error);

      if (refusal.revalidate) {
        await revalidateOrder();
      }

      showToast({ title: t(`payment.${refusal.key}`), type: "error" });
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <div className="space-y-3">
      {branch === "cancelled" && (
        <p className="text-sm text-muted-foreground">
          {t("payment.cancelled")}
        </p>
      )}

      {branch === "return" && unconfirmed && (
        <p className="text-sm text-muted-foreground">
          {t("payment.notConfirmed")}
        </p>
      )}

      {(refundOwed(order) || lineRefundOwed(order)) && (
        <p className="text-sm text-muted-foreground">
          {t("payment.refundOwed")}
        </p>
      )}

      {payable && (
        <div className="space-y-2">
          <Button
            onClick={pay}
            disabled={isStarting}
            size="sm"
            className="w-full"
          >
            <CreditCard className={ICON_SIZE} />
            <span className="ml-2">
              {isStarting ? t("payment.paying") : t("payment.pay")}
            </span>
          </Button>
          {order.paymentExpiresAt !== null && (
            <p className="text-xs text-muted-foreground">
              {t("payment.payBefore", {
                time: format.dateTime(new Date(order.paymentExpiresAt), {
                  timeStyle: "short",
                }),
              })}
            </p>
          )}
        </div>
      )}

      {unconfirmed && missedWindow && (
        <p className="text-sm text-muted-foreground">
          {t("payment.windowExpired")}
        </p>
      )}
    </div>
  );
};

export default PaymentActions;
