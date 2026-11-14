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
  /** Where the focus lands once the dialog closes: the heading of its section (AC-13). */
  onClosed: () => void;
};

/**
 * One irreversible move with the confirmation in front of it: nothing is sent
 * until the confirm control is pressed, and the keep control takes the initial
 * focus. The trigger keeps `aria-disabled` while a request runs rather than
 * `disabled`, because a disabled trigger unmounts with the dialog and drops focus
 * to the body (spec 0019, AC-12).
 */
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
          // The row the trigger lives on may be gone by now, so the focus goes
          // to the section heading rather than to a node that unmounted.
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
