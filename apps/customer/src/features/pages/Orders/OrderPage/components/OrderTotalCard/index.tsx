import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/common/helpers/money";
import {
  type Order,
  OrderStatus,
  PaymentStatus,
} from "@/common/types/order.types";
import { Separator } from "@/components/ui/separator";
import OrderReceivingCard from "@/features/pages/Orders/OrderPage/components/OrderReceivingCard";

type Props = {
  order: Order;
};

/**
 * The right column of the mockup: the paid total with its honest label, the one
 * note under it, the goods and delivery breakdown, and the receiving block below
 * a separator. No discount row and no savings line, because no order row can back
 * one (spec 0027, AC-5, AC-10).
 */
const OrderTotalCard = ({ order }: Props) => {
  const t = useTranslations("orders");
  const locale = useLocale();
  const paid = order.paymentStatus === PaymentStatus.PAID;

  return (
    <aside
      className="rounded-xl border border-border bg-card lg:sticky lg:top-24"
      data-testid="order-right-column"
    >
      <div className="p-7">
        <div className="text-sm text-muted-foreground">
          {paid ? t("totalPaid") : t("total")}
        </div>
        <div
          className="mt-1 text-[40px] font-bold tracking-[-0.02em] tabular-nums"
          data-testid="order-total"
        >
          {formatMoney(order.grandTotal, order.currency, locale)}
        </div>
        <div className="mt-1 text-[13px] text-muted-foreground">
          {t("totalNote")}
        </div>
      </div>
      <Separator />
      <div className="space-y-3 p-7">
        <div className="flex items-center justify-between text-[15px]">
          <span className="text-muted-foreground">{t("goods")}</span>
          <span className="tabular-nums">
            {formatMoney(order.totalPrice, order.currency, locale)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[15px]">
          <span className="text-muted-foreground">{t("delivery")}</span>
          <span className="tabular-nums">
            {formatMoney(order.deliveryPrice, order.currency, locale)}
          </span>
        </div>
      </div>
      {order.status !== OrderStatus.CANCELED && (
        <>
          <Separator />
          <OrderReceivingCard order={order} />
        </>
      )}
    </aside>
  );
};

export default OrderTotalCard;
