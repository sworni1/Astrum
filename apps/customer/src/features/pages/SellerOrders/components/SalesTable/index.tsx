"use client";

import { useTranslations } from "next-intl";
import type { SellerLineRow } from "@/common/types/order.types";
import { SALES_COLUMNS } from "@/features/pages/SellerOrders/lib/columns";
import { HEAD_CELL, TABLE_CARD } from "@/features/pages/SellerOrders/lib/styles";
import SalesRow from "@/features/pages/SellerOrders/components/SalesRow";

type Props = {
  items: readonly SellerLineRow[];
};

/**
 * One flat table, one row per order line, six mockup columns. Below `sm` the
 * head hides and every row stacks into a card that names its own cells
 * (spec 0026, AC-9, AC-12).
 */
const SalesTable = ({ items }: Props) => {
  const t = useTranslations("seller");

  return (
    <div className={TABLE_CARD}>
      <table aria-label={t("title")} className="w-full">
        <thead className="hidden sm:table-header-group">
          <tr>
            {SALES_COLUMNS.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={`${HEAD_CELL} ${column.align === "right" ? "text-right" : "text-left"}`}
              >
                {t(column.headKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((line) => (
            <SalesRow key={line.id} line={line} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SalesTable;
