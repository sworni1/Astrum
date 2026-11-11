import { CreditCard, MapPin } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { formatMoney } from "@/common/helpers/money";
import type { Order } from "@/common/types/order.types";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import OrderStatusBadge from "@/features/pages/Orders/OrderPage/components/OrderStatusBadge";
import {
  PAYMENT_KEYS,
  paymentStatusKey,
} from "@/features/pages/Orders/OrderPage/lib/payment";
import { CARD_CLASS } from "@/features/pages/Orders/OrderPage/lib/styles";

type Props = {
  order: Order;
};

/** Where the parcel goes, what pays for it, and how it ships. */
const OrderOverviewCard = ({ order }: Props) => {
  const t = useTranslations("orders");
  const format = useFormatter();
  const paymentKey = paymentStatusKey(order.paymentStatus);
  const isPickup = order.pickupPointId !== null;

  return (
    <Card className={CARD_CLASS}>
      <CardContent className="p-4 space-y-6">
        <div className="flex items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <span className="text-muted-foreground text-sm">
            {paymentKey
              ? t(`paymentStatus.${paymentKey}`)
              : order.paymentStatus}
          </span>
        </div>

        <Separator className="my-4" />

        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {isPickup ? t("pickupPoint") : t("deliveryAddress")}
          </h3>
          <div className="space-y-1 text-sm">
            {isPickup ? (
              <>
                <p className="font-medium">{order.pickupPointName}</p>
                <p className="text-muted-foreground">
                  {order.pickupPointAddress}
                </p>
                {order.handedOverAt ? (
                  <p className="text-muted-foreground">
                    {t("handedOverAt", {
                      date: format.dateTime(new Date(order.handedOverAt), {
                        dateStyle: "long",
                      }),
                    })}
                  </p>
                ) : null}
              </>
            ) : (
              <p>{order.deliveryAddress}</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">{t("paymentMethod")}</h3>
          <Card className="flex items-center justify-between bg-muted p-3 rounded-lg">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5" />
              <span className="text-muted-foreground">
                {t(`payment.${PAYMENT_KEYS[order.paymentMethod]}`)}
              </span>
            </div>
          </Card>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">{t("shippingMethod")}</h3>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{order.shippingMethodName}</p>
            <p className="text-muted-foreground">
              {t("price", {
                price: formatMoney(order.deliveryPrice, order.currency),
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderOverviewCard;
