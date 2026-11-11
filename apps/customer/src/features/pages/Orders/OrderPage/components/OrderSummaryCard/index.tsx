import { useTranslations } from "next-intl";
import { formatMoney } from "@/common/helpers/money";
import type { Order } from "@/common/types/order.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CARD_CLASS } from "@/features/pages/Orders/OrderPage/lib/styles";

type Props = {
  order: Order;
};

/** The three amounts the order is made of, every one through `formatMoney`. */
const OrderSummaryCard = ({ order }: Props) => {
  const t = useTranslations("orders");

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-3 lg:pb-4">
        <CardTitle className="text-lg font-medium">{t("summary")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 lg:space-y-4 pt-0">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">{t("subtotal")}</span>
          <span className="font-medium">
            {formatMoney(order.totalPrice, order.currency)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">{t("shipping")}</span>
          <span className="font-medium">
            {formatMoney(order.deliveryPrice, order.currency)}
          </span>
        </div>
        <Separator className="my-4" />
        <div>
          <div className="flex justify-between items-center">
            <span className="font-medium text-lg lg:text-base">
              {t("total")}
            </span>
            <span className="font-semibold text-xl lg:text-lg">
              {formatMoney(order.grandTotal, order.currency)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderSummaryCard;
