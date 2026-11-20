"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { SellerLineRow } from "@/common/types/order.types";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";

type Props = {
  line: SellerLineRow;
};

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
