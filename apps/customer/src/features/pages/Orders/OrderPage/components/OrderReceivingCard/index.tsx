import { MapPin } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Order } from "@/common/types/order.types";
import DeliveryProgress from "@/features/pages/Orders/OrderPage/components/DeliveryProgress";
import { receivingMoment } from "@/features/pages/Orders/OrderPage/lib/moments";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";

type Props = {
  order: Order;
};

/**
 * The receiving block: the method with its point, the one date this screen
 * prints about the parcel, and the four step rail under it (spec 0027, AC-5).
 * The date reads the issue moment when it happened, the arrival once the parcel
 * is here, and the promised day before that. A canceled order never reaches this
 * block, because the column drops it (spec 0031, AC-10).
 */
const OrderReceivingCard = ({ order }: Props) => {
  const t = useTranslations("orders");
  const format = useFormatter();
  const isPickup = order.pickupPointId !== null;
  const moment = receivingMoment(order);

  const date = format.dateTime(new Date(moment.stamp), {
    dateStyle: "long",
    timeZone: browserTimeZone(),
  });

  return (
    <div className="p-7" data-testid="order-receiving">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-secondary">
          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <div className="font-medium">{t("receiving")}</div>
          <div className="text-[13px] text-muted-foreground">
            {isPickup
              ? t("receivingLine", {
                  method: order.shippingMethodName,
                  point: order.pickupPointName ?? "",
                })
              : order.shippingMethodName}
          </div>
        </div>
      </div>
      <div className="mt-4 text-base font-semibold" data-testid="order-moment">
        {t(moment.labelKey, { date })}
      </div>
      <DeliveryProgress status={order.status} />
    </div>
  );
};

export default OrderReceivingCard;
