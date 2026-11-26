import { useTranslations } from "next-intl";
import type { OrderStatus } from "@/common/types/order.types";
import {
  DELIVERY_PROGRESS,
  deliverySteps,
} from "@/features/pages/Orders/OrderPage/lib/status";

type Props = {
  status: OrderStatus;
};

const DeliveryProgress = ({ status }: Props) => {
  const t = useTranslations("orders");
  const steps = deliverySteps(status);

  return (
    <div className="mt-4">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-border"
        data-testid="order-progress"
      >
        <div
          className="h-full rounded-full bg-foreground motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${DELIVERY_PROGRESS[status] ?? 0}%` }}
        />
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-0.5 text-center text-[11px] leading-tight sm:text-xs">
        {steps.map((step) => (
          <span
            key={step.key}
            data-testid="order-progress-step"
            className={
              step.active ? "text-foreground" : "text-muted-foreground"
            }
          >
            {t(`status.${step.key}`)}
          </span>
        ))}
      </div>
    </div>
  );
};

export default DeliveryProgress;
