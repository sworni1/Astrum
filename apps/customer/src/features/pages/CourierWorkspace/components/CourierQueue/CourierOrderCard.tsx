"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { itemStatusKey } from "@/common/helpers/itemStatus";
import { formatMoney } from "@/common/helpers/money";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";
import type { CourierOrder } from "@/hooks/staff/courierOrder.types";
import type {
  CourierOrderActionName,
  PendingCourierOrderAction,
} from "@/hooks/staff/useCourierOrderAction";
import OrderActions from "./OrderActions";

type Props = {
  order: CourierOrder;
  scope: "mine" | "available";
  pending: PendingCourierOrderAction | null;
  onRun: (order: CourierOrder, action: CourierOrderActionName) => void;
  onClosed: () => void;
};

const CourierOrderCard = ({
  order,
  scope,
  pending,
  onRun,
  onClosed,
}: Props) => {
  const t = useTranslations("staff.courier.queue");
  const locale = useLocale();
  const tOrders = useTranslations("orders");
  const tStatus = useTranslations("orders.itemStatus");
  const format = useFormatter();
  const placedAt = new Date(order.createdAt);
  const deliveryAt = new Date(order.deliveryDate);

  return (
    <article className="rounded-lg border p-4" data-testid="courier-order-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">
          {tOrders("number", { number: order.id.slice(-8) })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {format.dateTime(placedAt, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: browserTimeZone(),
          })}
        </p>
      </header>

      <p className="mt-1 text-sm text-muted-foreground">

        {t("deliveryDate", {
          date: format.dateTime(deliveryAt, {
            dateStyle: "long",
            timeZone: browserTimeZone(),
          }),
        })}
      </p>

      <ul className="mt-3 space-y-1 text-sm">
        {order.orderItems.map((line) => {
          const statusKey = itemStatusKey(line.status);

          return (
            <li
              key={line.id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
            >
              <span className="min-w-0 break-words">
                {line.name} × {line.quantity}
              </span>
              <span className="text-muted-foreground">
                {formatMoney(line.price, line.currency, locale)} ·{" "}
                {statusKey ? tStatus(statusKey) : line.status}
              </span>
            </li>
          );
        })}
      </ul>

      {order.deliveryAddress !== null && (
        <p className="mt-3 text-sm" data-testid="courier-order-address">
          <span className="text-muted-foreground">
            {tOrders("deliveryAddress")}
          </span>
          {": "}
          <strong>{order.deliveryAddress}</strong>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" data-testid="courier-order-total">
          <span className="text-muted-foreground">{t("totalLabel")}</span>{" "}
          <strong>{formatMoney(order.grandTotal, order.currency, locale)}</strong>
        </p>

        <OrderActions
          order={order}
          scope={scope}
          pending={pending}
          onRun={onRun}
          onClosed={onClosed}
        />
      </div>
    </article>
  );
};

export default CourierOrderCard;
