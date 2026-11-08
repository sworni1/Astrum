"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { itemStatusKey } from "../../../../common";
import type {
  SellerOrderGroup as Group,
  SellerOrderLine as Line,
} from "../../../../common/types/order.types";
import { browserTimeZone, countLinesByStatus } from "../format";
import SellerOrderLineRow from "../SellerOrderLine";

type Props = {
  order: Group;
  actionsDisabled: boolean;
  onUpdated: (line: Line) => Promise<void>;
  onRefused: () => Promise<void>;
};

const SellerOrderGroup = ({
  order,
  actionsDisabled,
  onUpdated,
  onRefused,
}: Props) => {
  const t = useTranslations("seller");
  const tStatus = useTranslations("orders.itemStatus");
  const format = useFormatter();
  const counts = countLinesByStatus(order.orderItems);

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
        <h2 className="text-sm font-semibold" title={order.id}>
          {t("orderNumber", { number: order.id.slice(-8) })}
        </h2>
        <span className="text-xs text-muted-foreground">
          {format.dateTime(new Date(order.createdAt), {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: browserTimeZone(),
          })}
        </span>
        <ul className="ml-auto flex flex-wrap gap-1">
          {counts.map(({ status, count }) => {
            const key = itemStatusKey(status);

            return (
              <li key={status}>
                <Badge variant="outline" className="font-normal">
                  {t("statusCount", {
                    count,
                    status: key ? tStatus(key) : status,
                  })}
                </Badge>
              </li>
            );
          })}
        </ul>
      </header>

      <ul>
        {order.orderItems.map((line) => (
          <SellerOrderLineRow
            key={line.id}
            line={line}
            actionsDisabled={actionsDisabled}
            onUpdated={onUpdated}
            onRefused={onRefused}
          />
        ))}
      </ul>
    </section>
  );
};

export default SellerOrderGroup;
