"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { SellerOrderLine as Line } from "@/common/types/order.types";
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
import {
  isConfirmingAction,
  SELLER_ACTION_TARGET,
  type SellerAction,
  sellerLineActions,
} from "@/features/pages/SellerOrders/lib/actionMap";
import {
  showRefusalToast,
  type Translate,
} from "@/features/pages/SellerOrders/lib/refusals";
import { useSellerOrderItemStatus } from "@/hooks/seller/useSellerOrderItemStatus";
import { DIALOG_COPY } from "./lib/dialogCopy";

type Props = {
  line: Line;
  isPickup: boolean;
  actionsDisabled: boolean;
  onUpdated: (line: Line) => Promise<void>;
  onRefused: () => Promise<void>;
};

/**
 * The actions of one line, the one status change in flight and the dialog that
 * guards the two destructive moves. The map only hides buttons; the gateway
 * re checks every move and every refusal is surfaced.
 */
export const LineActions = ({
  line,
  isPickup,
  actionsDisabled,
  onUpdated,
  onRefused,
}: Props) => {
  const t = useTranslations("seller");
  const [pending, setPending] = useState<SellerAction | null>(null);
  const [dialogAction, setDialogAction] = useState<SellerAction | null>(null);
  const { changeStatus } = useSellerOrderItemStatus(line.id, onUpdated);
  const actions = sellerLineActions(line.status, isPickup);

  const send = async (action: SellerAction): Promise<void> => {
    setPending(action);

    try {
      await changeStatus({ status: SELLER_ACTION_TARGET[action] });
    } catch (error) {
      showRefusalToast(
        error,
        t as unknown as Translate,
        () => void send(action),
      );
      await onRefused();
    } finally {
      setPending(null);
    }
  };

  const request = (action: SellerAction): void => {
    if (isConfirmingAction(action)) {
      setDialogAction(action);
      return;
    }

    void send(action);
  };

  const confirm = (): void => {
    const action = dialogAction;
    setDialogAction(null);

    if (action) {
      void send(action);
    }
  };

  const copy =
    dialogAction === "cancel" || dialogAction === "outOfStock"
      ? DIALOG_COPY[dialogAction]
      : null;

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
      <span className="sr-only">{t("columns.actions")}</span>
      {actions.map((action) => (
        <Button
          key={action}
          variant={isConfirmingAction(action) ? "outline" : "default"}
          disabled={actionsDisabled || pending !== null}
          aria-busy={pending === action}
          onClick={() => request(action)}
        >
          {pending === action ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : null}
          {t(`actions.${action}`)}
        </Button>
      ))}

      <Dialog
        open={dialogAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy ? t(copy.title) : ""}</DialogTitle>
            <DialogDescription>
              {copy ? t(copy.text, { product: line.name }) : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("dialog.keep")}</Button>
            </DialogClose>
            <Button onClick={confirm}>{t("dialog.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
