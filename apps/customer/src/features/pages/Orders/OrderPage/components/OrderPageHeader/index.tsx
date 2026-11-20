import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { Order } from "@/common/types/order.types";
import { Button } from "@/components/ui/button";
import CancelOrderDialog from "@/features/pages/Orders/OrderPage/components/CancelOrderDialog";
import CopyOrderNumber from "@/features/pages/Orders/OrderPage/components/CopyOrderNumber";
import OrderStatusBadge from "@/features/pages/Orders/OrderPage/components/OrderStatusBadge";
import { canCancel } from "@/features/pages/Orders/OrderPage/lib/status";
import { ICON_SIZE } from "@/features/pages/Orders/OrderPage/lib/styles";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";

type Props = {
  order: Order;
  isCancelling: boolean;
  onCancel: () => void;
};

const OrderPageHeader = ({ order, isCancelling, onCancel }: Props) => {
  const router = useRouter();
  const t = useTranslations("orders");
  const format = useFormatter();

  return (
    <div className="flex flex-wrap items-start justify-between gap-2.5">
      <div className="flex items-start gap-1">
        <Button
          onClick={() => router.back()}
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={t("backToOrders")}
          data-testid="order-back"
        >
          <ArrowLeft className={ICON_SIZE} aria-hidden />
        </Button>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1
              className="text-2xl font-bold tracking-[-0.02em]"
              data-testid="order-number"
            >
              {t("number", { number: order.id.slice(-8) })}
            </h1>
            <CopyOrderNumber orderId={order.id} />
          </div>
          <p
            className="mt-1.5 text-sm text-muted-foreground"
            data-testid="order-subtitle"
          >
            {t("itemsCount", { count: order.orderItems.length })} ·{" "}
            {format.dateTime(new Date(order.createdAt), {
              dateStyle: "long",
              timeZone: browserTimeZone(),
            })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <OrderStatusBadge status={order.status} testId="order-status-pill" />
        {canCancel(order.status) && (
          <CancelOrderDialog
            order={order}
            isCancelling={isCancelling}
            onConfirm={onCancel}
          />
        )}
      </div>
    </div>
  );
};

export default OrderPageHeader;
