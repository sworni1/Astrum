"use client";

import { Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { itemStatusKey } from "@/common/helpers/itemStatus";
import { formatMoney } from "@/common/helpers/money";
import type { SellerOrderLine as Line } from "@/common/types/order.types";
import { Badge } from "@/components/ui/badge";
import { lineSubtotal } from "@/features/pages/SellerOrders/lib/format";
import { SELLER_GRID_CLASS } from "@/features/pages/SellerOrders/lib/grid";
import { LineActions } from "./LineActions";

type Props = {
  line: Line;
  paid: boolean;
  actionsDisabled: boolean;
  onUpdated: (line: Line) => Promise<void>;
  onRefused: () => Promise<void>;
};

const SellerOrderLineRow = ({
  line,
  paid,
  actionsDisabled,
  onUpdated,
  onRefused,
}: Props) => {
  const t = useTranslations("seller");
  const tStatus = useTranslations("orders.itemStatus");
  const statusKey = itemStatusKey(line.status);

  return (
    <li
      className={`${SELLER_GRID_CLASS} items-start border-b px-3 py-2 last:border-b-0`}
    >
      <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
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
        <div className="min-w-0">
          <span className="sr-only">{t("columns.product")}: </span>
          <Link
            href={`/products/${line.productId}`}
            className="line-clamp-2 text-sm font-medium hover:underline"
          >
            {line.name || t("productFallback", { id: line.productId })}
          </Link>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2 sm:block sm:text-right">
        <span className="text-xs text-muted-foreground sm:sr-only">
          {t("columns.quantity")}
        </span>
        <span className="text-sm tabular-nums">{line.quantity}</span>
      </div>

      <div className="flex items-baseline justify-between gap-2 sm:block sm:text-right">
        <span className="text-xs text-muted-foreground sm:sr-only">
          {t("columns.unitPrice")}
        </span>
        <span className="text-sm tabular-nums">
          {formatMoney(line.price, line.currency)}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2 sm:block sm:text-right">
        <span className="text-xs text-muted-foreground sm:sr-only">
          {t("columns.subtotal")}
        </span>
        <span className="text-sm font-medium tabular-nums">
          {formatMoney(lineSubtotal(line), line.currency)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <span className="text-xs text-muted-foreground sm:sr-only">
          {t("columns.status")}
        </span>
        <Badge variant="secondary">
          {statusKey ? tStatus(statusKey) : line.status}
        </Badge>
      </div>

      <LineActions
        line={line}
        paid={paid}
        actionsDisabled={actionsDisabled}
        onUpdated={onUpdated}
        onRefused={onRefused}
      />
    </li>
  );
};

export default SellerOrderLineRow;
