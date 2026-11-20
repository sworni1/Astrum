"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { OrderLineRow as OrderLineRowData } from "@/common/types/order.types";
import { OrderItemStatus } from "@/common/types/order.types";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";
import { lineStateOf } from "@/features/pages/Orders/lib/lineState";
import {
  LINE_DOT,
  LINE_MAIN,
  LINE_QUANTITY,
  LINE_ROW,
  LINE_STATE_ROW,
  LINE_TEXT,
  LINE_TITLE,
} from "@/features/pages/Orders/lib/styles";
import LineImageTile from "./LineImageTile";

type Props = {
  line: OrderLineRowData;
};

/**
 * One line of a group: the image tile, the product name, its quantity and the
 * line state with the receipt date when the column carries one (spec 0025,
 * AC-11). An issued line prints no date, because `receiptDate` is the arrival
 * and the issue moment belongs to the receiving block (spec 0031, AC-7).
 */
const OrderLineRow = ({ line }: Props) => {
  const t = useTranslations("orders");
  const format = useFormatter();
  const state = lineStateOf(line.status);
  const receiptDate =
    line.receiptDate === null || line.status === OrderItemStatus.ISSUED
      ? null
      : format.dateTime(new Date(line.receiptDate), {
          dateStyle: "long",
          timeZone: browserTimeZone(),
        });

  return (
    <div className={LINE_ROW}>
      <div className={LINE_MAIN}>
        <LineImageTile src={line.previewImage} alt={line.name} />
        <div className={LINE_TEXT}>
          <span className={LINE_TITLE}>{line.name}</span>
          <span className={LINE_QUANTITY}>
            {t("quantity", { count: line.quantity })}
          </span>
        </div>
      </div>

      <div className={LINE_STATE_ROW}>
        <span className={`${LINE_DOT} ${state.dot}`} aria-hidden />
        <span>
          {t(state.labelKey)}
          {receiptDate === null ? null : (
            <>
              {" "}
              <b className="font-semibold text-foreground">{receiptDate}</b>
            </>
          )}
        </span>
      </div>
    </div>
  );
};

export default OrderLineRow;
