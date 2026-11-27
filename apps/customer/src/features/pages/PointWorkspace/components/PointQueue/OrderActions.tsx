"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { PaymentStatus } from "@/common/types/order.types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { PointOrder } from "@/hooks/staff/pointOrder.types";
import type {
  PendingPointOrderAction,
  PointOrderActionName,
} from "@/hooks/staff/usePointOrderAction";

type Props = {
  order: PointOrder;
  disabled: boolean;
  pending: PendingPointOrderAction | null;
  onRun: (order: PointOrder, action: PointOrderActionName) => void;
};

type DialogProps = {
  order: PointOrder;
  action: PointOrderActionName;
  busy: boolean;
  disabled: boolean;
  onRun: (order: PointOrder, action: PointOrderActionName) => void;
};

const OrderDialog = ({ order, action, busy, disabled, onRun }: DialogProps) => {
  const t = useTranslations("staff");
  const keepRef = useRef<HTMLButtonElement>(null);
  const paid =
    action === "cancel" && order.paymentStatus === PaymentStatus.PAID;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={disabled || busy} aria-busy={busy}>
          {busy
            ? t(`point.queue.${action}Busy`)
            : t(`point.queue.${action}Label`)}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keepRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(`point.queue.${action}Title`, { number: order.id.slice(-8) })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(`point.queue.${action}Text`)}
            {paid ? ` ${t("point.queue.cancelPaidText")}` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={keepRef}>
            {t("point.queue.keep")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => onRun(order, action)}>
            {t(`point.queue.${action}Confirm`)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const OrderActions = ({ order, disabled, pending, onRun }: Props) => {
  const action = pending?.orderId === order.id ? pending.action : null;

  return (
    <div className="flex flex-wrap gap-2">
      <OrderDialog
        order={order}
        action="handover"
        busy={action === "handover"}
        disabled={disabled}
        onRun={onRun}
      />
      <OrderDialog
        order={order}
        action="cancel"
        busy={action === "cancel"}
        disabled={disabled}
        onRun={onRun}
      />
    </div>
  );
};

export default OrderActions;
