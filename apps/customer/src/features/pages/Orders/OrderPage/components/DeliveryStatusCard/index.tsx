import { useFormatter, useTranslations } from "next-intl";
import type { Order } from "@/common/types/order.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DeliveryProgress from "@/features/pages/Orders/OrderPage/components/DeliveryProgress";
import OrderStatusBadge from "@/features/pages/Orders/OrderPage/components/OrderStatusBadge";
import { CARD_CLASS } from "@/features/pages/Orders/OrderPage/lib/styles";

type Props = {
  order: Order;
};

/** The rail, the status pill and the promised day. */
const DeliveryStatusCard = ({ order }: Props) => {
  const t = useTranslations("orders");
  const format = useFormatter();

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-4 lg:pb-6">
        <CardTitle className="text-lg font-medium">
          {t("deliveryStatus")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <DeliveryProgress status={order.status} />

        <div className="flex items-center gap-3">
          <OrderStatusBadge
            status={order.status}
            className="text-sm font-medium"
          />
          <span className="text-muted-foreground text-sm">
            {t("deliveryDate", {
              date: format.dateTime(new Date(order.deliveryDate), {
                dateStyle: "long",
              }),
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeliveryStatusCard;
