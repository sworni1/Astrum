import { useTranslations } from "next-intl";
import type { OrderStatus } from "@/common/types/order.types";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_KEYS,
  statusColor,
} from "@/features/pages/Orders/OrderPage/lib/status";
import { cn } from "@/lib/utils";

type Props = {
  status: OrderStatus;
  className?: string;
};

/** The status pill: one color and one label wherever the order screen shows it. */
const OrderStatusBadge = ({ status, className }: Props) => {
  const t = useTranslations("orders");

  return (
    <Badge
      className={cn("text-white px-3 py-1", statusColor(status), className)}
    >
      {t(`status.${STATUS_KEYS[status]}`)}
    </Badge>
  );
};

export default OrderStatusBadge;
