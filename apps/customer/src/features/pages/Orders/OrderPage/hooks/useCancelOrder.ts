import { useTranslations } from "next-intl";
import { showToast } from "@/common/helpers/showToast";
import { OrderStatus } from "@/common/types/order.types";
import { useUpdateOrderStatus } from "@/hooks/order/useUpdateOrderStatus";
import { cancelRefusal } from "@/features/pages/Orders/OrderPage/lib/cancelRefusal";

type UseCancelOrderReturn = {
  cancel: () => Promise<void>;
  isCancelling: boolean;
};

/** Cancels a pending order and reports the result; the toast is raised here. */
export const useCancelOrder = (orderId: string): UseCancelOrderReturn => {
  const t = useTranslations("orders");
  const { updateOrderStatusTrigger, updateOrderStatusIsMutating } =
    useUpdateOrderStatus(orderId);

  const cancel = async (): Promise<void> => {
    try {
      await updateOrderStatusTrigger({ status: OrderStatus.CANCELED });
      showToast({ title: t("cancelSuccess"), type: "success" });
    } catch (error) {
      const refusal = cancelRefusal(error);

      if (refusal.key === "cancelBlockedByLine") {
        showToast({
          title: t("cancelBlockedByLine", {
            status: t(`itemStatus.${refusal.statusKey}`),
          }),
          type: "error",
        });
        return;
      }

      showToast({ title: t("cancelFailed"), type: "error" });
    }
  };

  return { cancel, isCancelling: updateOrderStatusIsMutating };
};
