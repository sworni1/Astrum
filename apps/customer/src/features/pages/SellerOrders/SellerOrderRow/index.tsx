"use client";

import { Package } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { itemStatusKey } from "@/common/helpers/itemStatus";
import { formatMoney } from "@/common/helpers/money";
import type { SellerOrderLine } from "@/common/types/order.types";
import { Badge } from "@/components/ui/badge";
import { browserTimeZone, lineSubtotal } from "@/features/pages/SellerOrders/lib/format";

type Props = {
  line: SellerOrderLine;
  /** The order the line belongs to, because the date column prints its date. */
  createdAt: string;
};

/**
 * One line of the table: the product with its quantity, the line sum, the date
 * the order was placed and the line status. Nothing here writes (AC-4, AC-5).
 */
const SellerOrderRow = ({ line, createdAt }: Props) => {
  const t = useTranslations("seller");
  const tStatus = useTranslations("orders.itemStatus");
  const format = useFormatter();
  const statusKey = itemStatusKey(line.status);

  return (
    <tr className="block border-b last:border-b-0 sm:table-row">
      <td className="hidden sm:table-cell" aria-hidden="true" />

      <td className="flex items-baseline justify-between gap-2 px-3 pt-2 sm:table-cell sm:px-3 sm:py-2">
        <span className="shrink-0 text-xs text-muted-foreground sm:sr-only">
          {t("columns.product")}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/products/${line.productId}`}
            className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
          >
            {line.previewImage ? (
              <Image
                src={line.previewImage}
                alt={line.name}
                fill
                sizes="40px"
                className="object-cover"
                unoptimized={line.previewImage.startsWith("http")}
              />
            ) : (
              <Package className="size-5 text-muted-foreground" />
            )}
          </Link>
          <Link
            href={`/products/${line.productId}`}
            className="line-clamp-2 text-sm font-medium hover:underline"
          >
            {`${line.name || t("productFallback", { id: line.productId })} × ${line.quantity}`}
          </Link>
        </div>
      </td>

      <td className="flex items-baseline justify-between gap-2 px-3 py-1 sm:table-cell sm:px-3 sm:py-2 sm:text-right">
        <span className="text-xs text-muted-foreground sm:sr-only">
          {t("columns.subtotal")}
        </span>
        <span className="text-sm font-medium tabular-nums">
          {formatMoney(lineSubtotal(line), line.currency)}
        </span>
      </td>

      <td className="flex items-baseline justify-between gap-2 px-3 py-1 sm:table-cell sm:px-3 sm:py-2 sm:whitespace-nowrap">
        <span className="text-xs text-muted-foreground sm:sr-only">
          {t("columns.date")}
        </span>
        <span className="text-sm tabular-nums">
          {format.dateTime(new Date(createdAt), {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: browserTimeZone(),
          })}
        </span>
      </td>

      <td className="flex items-baseline justify-between gap-2 px-3 pb-2 pt-1 sm:table-cell sm:px-3 sm:py-2">
        <span className="text-xs text-muted-foreground sm:sr-only">
          {t("columns.status")}
        </span>
        <Badge variant="secondary">
          {statusKey ? tStatus(statusKey) : line.status}
        </Badge>
      </td>
    </tr>
  );
};

export default SellerOrderRow;
