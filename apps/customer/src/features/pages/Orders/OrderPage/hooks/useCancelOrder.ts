import { useTranslations } from "next-intl";
import { showToast } from "@/common/helpers/showToast";
import { OrderStatus } from "@/common/types/order.types";
import { cancelRefusal } from "@/features/pages/Orders/OrderPage/lib/cancelRefusal";
import { useUpdateOrderStatus } from "@/hooks/order/useUpdateOrderStatus";

type UseCancelOrderReturn = {
  cancel: () => Promise<void>;
  isCancelling: boolean;
};

export const useCancelOrder = (orderId: string): UseCancelOrderReturn => {
  const t = useTranslations("orders");
  const {
    updateOrderStatusTrigger,
    updateOrderStatusIsMutating,
    revalidateOrder,
  } = useUpdateOrderStatus(orderId);

  const cancel = async (): Promise<void> => {
    if (updateOrderStatusIsMutating) {
      return;
    }

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
      } else if (refusal.key === "cancelUnconfirmed") {
        showToast({ title: t("cancelUnconfirmed"), type: "error" });
      } else {
        showToast({ title: t("cancelFailed"), type: "error" });
      }

      await revalidateOrder();
    }
  };

  return { cancel, isCancelling: updateOrderStatusIsMutating };
};
