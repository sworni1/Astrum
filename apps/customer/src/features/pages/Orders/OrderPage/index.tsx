"use client";

import { useGetOrderById } from "@/hooks/order/useGetOrderById";
import { useSyncOrderPayment } from "@/hooks/order/useSyncOrderPayment";
import LoadingScreen from "./components/LoadingScreen";
import OrderNotFound from "./components/OrderNotFound";
import OrderScreen from "./components/OrderScreen";
import PaymentChecking from "./components/PaymentChecking";
import { useCancelOrder } from "./hooks/useCancelOrder";
import { useLoadFailureToast } from "./hooks/useLoadFailureToast";

type Props = {
  orderId: string;
};

export default function OrderPage({ orderId }: Props) {
  const { order, isLoading, error } = useGetOrderById(orderId);
  const { cancel, isCancelling } = useCancelOrder(orderId);
  const { isChecking, branch } = useSyncOrderPayment(orderId);
  useLoadFailureToast(error);

  if (isChecking) {
    return <PaymentChecking />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <OrderNotFound />;
  }

  if (!order) {
    return <LoadingScreen />;
  }

  return (
    <OrderScreen
      order={order}
      isCancelling={isCancelling}
      onCancel={cancel}
      paymentBranch={branch}
    />
  );
}
