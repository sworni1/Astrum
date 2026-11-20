"use client";

import type { CourierOrder } from "@/hooks/staff/courierOrder.types";
import type {
  CourierOrderActionName,
  PendingCourierOrderAction,
} from "@/hooks/staff/useCourierOrderAction";
import { ACTIONS_BY_SCOPE } from "@/features/pages/CourierWorkspace/lib/actions";
import ActionDialog from "./ActionDialog";

type Props = {
  order: CourierOrder;
  scope: "mine" | "available";
  pending: PendingCourierOrderAction | null;
  onRun: (order: CourierOrder, action: CourierOrderActionName) => void;
  onClosed: () => void;
};

const OrderActions = ({ order, scope, pending, onRun, onClosed }: Props) => {
  const busyAction = pending?.orderId === order.id ? pending.action : null;

  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS_BY_SCOPE[scope].map((action) => (
        <ActionDialog
          key={action}
          order={order}
          action={action}
          busy={busyAction === action}
          onRun={onRun}
          onClosed={onClosed}
        />
      ))}
    </div>
  );
};

export default OrderActions;
