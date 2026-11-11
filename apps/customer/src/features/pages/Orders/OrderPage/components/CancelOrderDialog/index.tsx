import { Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import type { Order } from "@/common/types/order.types";
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
import { showsPaymentSentence } from "@/features/pages/Orders/OrderPage/lib/cancelDialogCopy";
import {
  ICON_SIZE,
  OUTLINE_BUTTON_CLASS,
} from "@/features/pages/Orders/OrderPage/lib/styles";
import { cn } from "@/lib/utils";

type Props = {
  order: Order;
  isCancelling: boolean;
  onConfirm: () => void;
};

/**
 * The header's cancel action with the confirmation in front of it: only the
 * sending control sends, and the action stays focusable while the request runs
 * so closing the dialog can hand focus back to it (spec 0011, AC-2, AC-4, AC-10).
 */
const CancelOrderDialog = ({ order, isCancelling, onConfirm }: Props) => {
  const t = useTranslations("orders");
  const keepRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={OUTLINE_BUTTON_CLASS}
          aria-label={t("cancel")}
          aria-busy={isCancelling}
          aria-disabled={isCancelling}
          onClick={(event) => {
            if (isCancelling) {
              event.preventDefault();
            }
          }}
        >
          {isCancelling ? (
            <Loader2 className={cn(ICON_SIZE, "animate-spin")} aria-hidden />
          ) : (
            <>
              <XCircle className={ICON_SIZE} aria-hidden />{" "}
              <span className="ml-1 lg:ml-2">{t("cancel")}</span>
            </>
          )}
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
            {t("number", { number: order.id.slice(-8) })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("cancelDialog.text")}
            {showsPaymentSentence(order.paymentStatus) &&
              ` ${t("cancelDialog.paymentPending")}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={keepRef}>
            {t("cancelDialog.keep")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t("cancelDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CancelOrderDialog;
