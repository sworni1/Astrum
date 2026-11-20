"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { itemStatusKey } from "@/common/helpers/itemStatus";
import { formatMoney } from "@/common/helpers/money";
import type { SellerLineRow } from "@/common/types/order.types";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";
import { badgeToneOf, BADGE_TONE_CLASS } from "@/features/pages/SellerOrders/lib/status";
import {
  AMOUNT,
  BADGE,
  CELL,
  CELL_LABEL,
  ORDER_NUMBER,
  ROW,
} from "@/features/pages/SellerOrders/lib/styles";
import ProductCell from "./ProductCell";
import ReceiptCell from "./ReceiptCell";

type Props = {
  line: SellerLineRow;
};

const SalesRow = ({ line }: Props) => {
  const t = useTranslations("seller");
  const tStatus = useTranslations("orders.itemStatus");
  const format = useFormatter();
  const locale = useLocale();
  const statusKey = itemStatusKey(line.status);
  const orderNumber = line.orderId.slice(-8);
  const placedAt = format.dateTime(new Date(line.createdAt), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: browserTimeZone(),
  });

  return (
    <tr className={ROW}>
      <td className={CELL}>
        <span className={CELL_LABEL}>{t("columns.orderNumber")}</span>
        <span className={ORDER_NUMBER} aria-label={t("orderNumber", { number: orderNumber })}>
          {orderNumber}
        </span>
      </td>

      <td className={CELL}>
        <span className={CELL_LABEL}>{t("columns.product")}</span>
        <ProductCell line={line} />
      </td>

      <td className={CELL}>
        <span className={CELL_LABEL}>{t("columns.receipt")}</span>
        <ReceiptCell line={line} />
      </td>

      <td className={`${CELL} sm:text-right`}>
        <span className={CELL_LABEL}>{t("columns.subtotal")}</span>
        <span className={AMOUNT}>
          {formatMoney(line.subtotal, line.currency, locale)}
        </span>
      </td>

      <td className={CELL}>
        <span className={CELL_LABEL}>{t("columns.date")}</span>
        <span className="whitespace-nowrap tabular-nums">{placedAt}</span>
      </td>

      <td className={`${CELL} sm:justify-end`}>
        <span className={CELL_LABEL}>{t("columns.status")}</span>
        <span className={`${BADGE} ${BADGE_TONE_CLASS[badgeToneOf(line.status)]}`}>
          {statusKey === undefined ? line.status : tStatus(statusKey)}
        </span>
      </td>
    </tr>
  );
};

export default SalesRow;
