"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { SellerLineRow } from "@/common/types/order.types";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";

type Props = {
  line: SellerLineRow;
};

/**
 * Where the line is received: a pickup point with its handover day, a courier
 * address, or nothing at all. A line with neither prints the "no address" note
 * instead of an empty cell, because a dash reads as data (spec 0026, AC-9).
 */
const ReceiptCell = ({ line }: Props) => {
  const t = useTranslations("seller");
  const format = useFormatter();
  const pointName = line.isPickup
    ? line.pickupPointName || line.pickupPointAddress
    : null;

  if (pointName) {
    const handedOver =
      line.handedOverAt === null
        ? null
        : format.dateTime(new Date(line.handedOverAt), {
            day: "numeric",
            month: "short",
            timeZone: browserTimeZone(),
          });

    return (
      <div className="min-w-0">
        <span>{pointName}</span>
        {handedOver === null ? null : (
          <span className="text-muted-foreground">
            {" · "}
            {t("handedOverAt", { date: handedOver })}
          </span>
        )}
      </div>
    );
  }

  if (line.deliveryAddress) {
    return (
      <div className="min-w-0">
        <span className="text-muted-foreground">{t("receipt.courier")}</span>
        <span>{" · "}{line.deliveryAddress}</span>
      </div>
    );
  }

  return <span className="text-muted-foreground">{t("receipt.noAddress")}</span>;
};

export default ReceiptCell;
