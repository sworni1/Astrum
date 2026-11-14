"use client";

import { MapPin } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { itemStatusKey } from "@/common/helpers/itemStatus";
import {
  PaymentMethod,
  PaymentStatus,
  type SellerOrderGroup,
} from "@/common/types/order.types";
import { Badge } from "@/components/ui/badge";
import { paymentStatusKey } from "@/features/pages/Orders/OrderPage/lib/payment";
import {
  browserTimeZone,
  countLinesByStatus,
} from "@/features/pages/SellerOrders/lib/format";

type Props = { order: SellerOrderGroup };

/**
 * The facts of one order, as the band above its lines. The order number sits
 * under its own column, every other fact spans the remaining four, and the
 * placed date is not here because the date column carries it (AC-2, AC-3).
 */
const SellerOrderBand = ({ order }: Props) => {
  const t = useTranslations("seller");
  const tStatus = useTranslations("orders.itemStatus");
  const tPayment = useTranslations("orders.paymentStatus");
  const format = useFormatter();
  const counts = countLinesByStatus(order.orderItems);
  const paymentKey = paymentStatusKey(order.paymentStatus);
  // A payment status alone cannot tell an online order from cash, so both are
  // printed, and only while the parcel is still unpaid (AC-2).
  const unpaidOnline =
    order.paymentMethod === PaymentMethod.ONLINE_CARD &&
    order.paymentStatus !== PaymentStatus.PAID;
  // The panel prints a point when the order holds one, never because a shipping
  // method claims to be a pickup (AC-2).
  const hasPoint = order.pickupPointId !== null;
  const hasFacts = unpaidOnline || counts.length > 0 || hasPoint || order.handedOverAt !== null;

  return (
    <tr className="block border-b bg-muted/40 sm:table-row">
      <td className="block px-3 py-2 sm:table-cell sm:whitespace-nowrap">
        {/* The value names itself, so no column label beside it (AC-2, AC-8). */}
        <span className="text-sm font-semibold" title={order.id}>
          {t("orderNumber", { number: order.id.slice(-8) })}
        </span>
      </td>
      <td colSpan={4} className="block px-3 pb-2 sm:table-cell sm:px-3 sm:py-2">
        {hasFacts && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {unpaidOnline && (
              <Badge variant="outline" className="font-normal">
                {t("paymentLabel", {
                  status: paymentKey
                    ? tPayment(paymentKey)
                    : order.paymentStatus,
                })}
              </Badge>
            )}
            {counts.map(({ status, count }) => {
              const key = itemStatusKey(status);

              return (
                <Badge
                  key={status}
                  variant="outline"
                  className="font-normal"
                >
                  {t("statusCount", {
                    count,
                    status: key ? tStatus(key) : status,
                  })}
                </Badge>
              );
            })}
            {hasPoint && (
              <span className="flex items-center gap-1">
                <MapPin
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="font-medium">{order.pickupPointName}</span>
                <span className="text-muted-foreground">
                  {order.pickupPointAddress}
                </span>
              </span>
            )}
            {order.handedOverAt && (
              <span className="text-muted-foreground">
                {t("handedOverAt", {
                  date: format.dateTime(new Date(order.handedOverAt), {
                    dateStyle: "medium",
                    timeZone: browserTimeZone(),
                  }),
                })}
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
};

export default SellerOrderBand;
