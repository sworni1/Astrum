import { useTranslations } from "next-intl";
import type { OrderStatus } from "@/common/types/order.types";
import { deliverySteps } from "@/features/pages/Orders/OrderPage/lib/status";

type Props = {
  status: OrderStatus;
};

/**
 * The delivery rail, drawn once for both breakpoints: the disc and the label
 * change size with the screen, the step list does not change at all.
 */
const DeliveryProgress = ({ status }: Props) => {
  const t = useTranslations("orders");
  const steps = deliverySteps(status);

  return (
    <div className="relative mb-6 lg:mb-8">
      <div className="hidden lg:block absolute top-5 left-5 right-5 h-0.5 bg-gray-500" />
      <div className="hidden lg:block absolute top-5 left-5 w-1/3 h-0.5 bg-green-500" />
      <div className="relative flex items-center justify-between">
        {steps.map((step) => {
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex flex-col items-center">
              <div
                className={`w-12 h-12 lg:w-10 lg:h-10 rounded-full mb-2 lg:mb-3 flex items-center text-white justify-center ${
                  step.active ? "bg-green-500" : "bg-gray-600"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={`text-xs lg:text-sm text-center ${
                  step.active
                    ? "font-medium"
                    : "font-medium lg:font-normal text-muted-foreground"
                }`}
              >
                {t(`status.${step.key}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DeliveryProgress;
