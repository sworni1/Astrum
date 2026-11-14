"use client";

import { useFormatter, useTranslations } from "next-intl";
import { itemStatusKey } from "@/common/helpers/itemStatus";
import { formatMoney } from "@/common/helpers/money";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";
import type { PointOrder } from "@/hooks/staff/pointOrder.types";
import type {
  PendingPointOrderAction,
  PointOrderActionName,
} from "@/hooks/staff/usePointOrderAction";
import OrderActions from "./OrderActions";

type Props = {
  order: PointOrder;
  actionsDisabled: boolean;
  pending: PendingPointOrderAction | null;
  onRun: (order: PointOrder, action: PointOrderActionName) => void;
};

/**
 * One parcel waiting at the counter: its number, when it was placed, every line
 * still inside, the total, and the two moves. No buyer identity and no count
 * that was not read (spec 0018, AC-10).
 */
const PointOrderCard = ({ order, actionsDisabled, pending, onRun }: Props) => {
  const t = useTranslations("staff");
  const tOrders = useTranslations("orders");
  const tStatus = useTranslations("orders.itemStatus");
  const format = useFormatter();
  const placedAt = new Date(order.createdAt);

  return (
    <article className="rounded-lg border p-4" data-testid="point-order-card">
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
                {formatMoney(line.price, line.currency)} ·{" "}
                {statusKey ? tStatus(statusKey) : line.status}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" data-testid="point-order-total">
          <span className="text-muted-foreground">
            {t("point.queue.totalLabel")}
          </span>{" "}
          <strong>{formatMoney(order.grandTotal, order.currency)}</strong>
        </p>

        <OrderActions
          order={order}
          disabled={actionsDisabled}
          pending={pending}
          onRun={onRun}
        />
      </div>
    </article>
  );
};

export default PointOrderCard;
