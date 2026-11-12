"use client";

import { Loader2, MapPin } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { itemStatusKey } from "@/common/helpers/itemStatus";
import {
  type SellerOrderGroup as Group,
  type SellerOrderLine as Line,
  PaymentMethod,
  PaymentStatus,
} from "@/common/types/order.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { paymentStatusKey } from "@/features/pages/Orders/OrderPage/lib/payment";
import {
  browserTimeZone,
  countLinesByStatus,
} from "@/features/pages/SellerOrders/lib/format";
import { handoverableCount } from "@/features/pages/SellerOrders/lib/handover";
import {
  showHandoverToast,
  type Translate,
} from "@/features/pages/SellerOrders/lib/refusals";
import SellerOrderLineRow from "@/features/pages/SellerOrders/SellerOrderLine";
import { useSellerHandover } from "@/hooks/seller/useSellerHandover";

type Props = {
  order: Group;
  actionsDisabled: boolean;
  onUpdated: (line: Line) => Promise<void>;
  onRefused: () => Promise<void>;
  onHandedOver: (group: Group) => Promise<void>;
  onReload: () => Promise<void>;
};

const SellerOrderGroup = ({
  order,
  actionsDisabled,
  onUpdated,
  onRefused,
  onHandedOver,
  onReload,
}: Props) => {
  const t = useTranslations("seller");
  const tStatus = useTranslations("orders.itemStatus");
  const tPayment = useTranslations("orders.paymentStatus");
  const format = useFormatter();
  const counts = countLinesByStatus(order.orderItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { handOver, isHandingOver } = useSellerHandover(order.id, onHandedOver);
  const isPickup = order.pickupPointId !== null;
  const readyCount = handoverableCount(order.orderItems);
  // A payment status alone cannot tell an online order from cash, so both are
  // printed, and only when the seller could still be shipping goods unpaid (AC-16).
  const unpaidOnline =
    order.paymentMethod === PaymentMethod.ONLINE_CARD &&
    order.paymentStatus !== PaymentStatus.PAID;
  const paymentKey = paymentStatusKey(order.paymentStatus);

  const send = async (): Promise<void> => {
    try {
      await handOver();
      setDialogOpen(false);
    } catch (error) {
      showHandoverToast(error, t as unknown as Translate, () => void send());
      setDialogOpen(false);
      await onReload();
    }
  };

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
        <h2 className="text-sm font-semibold" title={order.id}>
          {t("orderNumber", { number: order.id.slice(-8) })}
        </h2>
        {unpaidOnline && (
          <Badge variant="outline" className="font-normal">
            {t("paymentLabel", {
              status: paymentKey ? tPayment(paymentKey) : order.paymentStatus,
            })}
          </Badge>
        )}
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

      {isPickup && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-xs">
          <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">{order.pickupPointName}</span>
          <span className="text-muted-foreground">
            {order.pickupPointAddress}
          </span>
          {order.handedOverAt ? (
            <span className="text-muted-foreground">
              {t("handedOverAt", {
                date: format.dateTime(new Date(order.handedOverAt), {
                  dateStyle: "medium",
                  timeZone: browserTimeZone(),
                }),
              })}
            </span>
          ) : null}
          {readyCount > 0 && (
            <Button
              className="ml-auto"
              size="sm"
              disabled={actionsDisabled || isHandingOver}
              aria-busy={isHandingOver}
              onClick={() => setDialogOpen(true)}
            >
              {isHandingOver ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : null}
              {isHandingOver ? t("handoverBusy") : t("handover")}
            </Button>
          )}
        </div>
      )}

      <ul>
        {order.orderItems.map((line) => (
          <SellerOrderLineRow
            key={line.id}
            line={line}
            isPickup={isPickup}
            actionsDisabled={actionsDisabled}
            onUpdated={onUpdated}
            onRefused={onRefused}
          />
        ))}
      </ul>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("handoverTitle")}</DialogTitle>
            <DialogDescription>
              {t("handoverText", {
                point: order.pickupPointName ?? "",
                count: readyCount,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isHandingOver}>
                {t("handoverKeep")}
              </Button>
            </DialogClose>
            <Button disabled={isHandingOver} onClick={() => void send()}>
              {t("handoverConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default SellerOrderGroup;
