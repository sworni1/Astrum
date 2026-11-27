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
import type { CourierOrder } from "@/hooks/staff/courierOrder.types";
import type { CourierOrderActionName } from "@/hooks/staff/useCourierOrderAction";

type Props = {
  order: CourierOrder;
  action: CourierOrderActionName;
  busy: boolean;
  onRun: (order: CourierOrder, action: CourierOrderActionName) => void;

  onClosed: () => void;
};

const ActionDialog = ({ order, action, busy, onRun, onClosed }: Props) => {
  const t = useTranslations("staff.courier.queue");
  const keepRef = useRef<HTMLButtonElement>(null);
  const paid =
    action === "cancel" && order.paymentStatus === PaymentStatus.PAID;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          aria-busy={busy}
          aria-disabled={busy}
          className="aria-disabled:opacity-50"
        >
          {busy ? t(`${action}Busy`) : t(`${action}Label`)}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keepRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(`${action}Title`, { number: order.id.slice(-8) })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(`${action}Text`)}
            {paid ? ` ${t("cancelPaidText")}` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={keepRef}>{t("keep")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onRun(order, action)}>
            {t(`${action}Confirm`)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ActionDialog;
