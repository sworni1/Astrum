import { useTranslations } from "next-intl";
import type { OrderStatus } from "@/common/types/order.types";
import Pill from "@/features/pages/Orders/OrderPage/components/Pill";
import {
  STATUS_KEYS,
  STATUS_TONES,
} from "@/features/pages/Orders/OrderPage/lib/status";

type Props = {
  status: OrderStatus;
  testId?: string;
};

/**
 * The order status pill: one tone from `STATUS_TONES` and one label from the
 * catalog wherever the screen shows the state (spec 0027, AC-8). The vendored
 * `Badge` is gone from here, because its palette cannot follow the theme tokens.
 */
const OrderStatusBadge = ({ status, testId }: Props) => {
  const t = useTranslations("orders");

  return (
    <Pill tone={STATUS_TONES[status] ?? "neutral"} testId={testId}>
      {t(`status.${STATUS_KEYS[status] ?? "pending"}`)}
    </Pill>
  );
};

export default OrderStatusBadge;
