"use client";

import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { formatMoney, toCurrency } from "@/common/helpers/money";
import type { OrderListRow } from "@/common/types/order.types";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";
import {
  GROUP_CARD,
  GROUP_FIELD,
  GROUP_FIELDS,
  GROUP_FIELD_VALUE,
  GROUP_HEADER,
} from "@/features/pages/Orders/lib/styles";
import OrderLineRow from "@/features/pages/Orders/components/OrderLineRow";

const NUMBER_LENGTH = 8;

type Props = {
  order: OrderListRow;
};

/**
 * One order as one link: the header carries the number, the date and the total,
 * the lines follow under it, and nothing on the card sends a request
 * (spec 0025, AC-10).
 */
const OrderGroup = ({ order }: Props) => {
  const t = useTranslations("orders");
  const locale = useLocale();
  const format = useFormatter();
  const number = order.id.slice(-NUMBER_LENGTH);

  return (
    <Link
      href={`/orders/${order.id}`}
      className={GROUP_CARD}
      aria-label={t("number", { number })}
    >
      <div className={GROUP_HEADER}>
        <div className={GROUP_FIELDS}>
          <div className={GROUP_FIELD}>
            <span>{t("fields.number")}</span>
            <span className={GROUP_FIELD_VALUE}>{number}</span>
          </div>
          <div className={GROUP_FIELD}>
            <span>{t("fields.date")}</span>
            <span className={GROUP_FIELD_VALUE}>
              {format.dateTime(new Date(order.createdAt), {
                dateStyle: "long",
                timeZone: browserTimeZone(),
              })}
            </span>
          </div>
          <div className={GROUP_FIELD}>
            <span>{t("fields.amount")}</span>
            <span className={GROUP_FIELD_VALUE}>
              {formatMoney(order.grandTotal, toCurrency(order.currency), locale)}
            </span>
          </div>
        </div>
      </div>

      {order.orderItems.map((line) => (
        <OrderLineRow key={line.id} line={line} />
      ))}
    </Link>
  );
};

export default OrderGroup;
