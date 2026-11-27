import { useLocale, useTranslations } from "next-intl";
import { itemStatusKey } from "@/common/helpers/itemStatus";
import { formatMoney } from "@/common/helpers/money";
import type { Order, OrderItem } from "@/common/types/order.types";
import OrderItemImage from "@/features/pages/Orders/OrderPage/components/OrderItemImage";
import Pill from "@/features/pages/Orders/OrderPage/components/Pill";
import { lineTone } from "@/features/pages/Orders/OrderPage/lib/pills";

type Props = {
  item: OrderItem;
  currency: Order["currency"];
};

const OrderLine = ({ item, currency }: Props) => {
  const t = useTranslations("orders");
  const locale = useLocale();
  const tone = lineTone(item.status);

  return (
    <div
      className="flex items-center justify-between gap-4 border-b border-border py-3.5 last:border-b-0"
      data-testid="order-line"
    >
      <div className="flex min-w-0 items-center gap-4">
        <OrderItemImage src={item.previewImage} alt={t("productImage")} />
        <div className="min-w-0">
          <div className="text-[12.5px] text-muted-foreground">
            {item.brandName}
          </div>
          <div className="font-medium">
            {item.name || t("productFallback", { id: item.productId })}
          </div>
          <div className="text-[13.5px] text-muted-foreground">
            {item.kind
              ? t("lineMeta", { kind: item.kind, count: item.quantity })
              : t("quantity", { count: item.quantity })}
          </div>
          {tone ? (
            <div className="mt-1.5">
              <Pill tone={tone} testId="order-line-status">
                {t(`itemStatus.${itemStatusKey(item.status) ?? "pending"}`)}
              </Pill>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex-none text-right">
        <div
          className="text-base font-semibold tabular-nums"
          data-testid="order-line-amount"
        >
          {formatMoney(item.subtotal, currency, locale)}
        </div>
        <span
          className="mt-1.5 inline-block rounded-full border border-border px-2.5 py-[2px] text-xs text-muted-foreground tabular-nums"
          data-testid="order-line-unit"
        >
          {item.quantity} × {formatMoney(item.price, currency, locale)}
        </span>
      </div>
    </div>
  );
};

export default OrderLine;
