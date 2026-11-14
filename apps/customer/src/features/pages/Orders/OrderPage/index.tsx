'use client';

import { OrderStatus } from '@/common/types/order.types';
import { useGetOrderById } from '@/hooks/order/useGetOrderById';
import { useSyncOrderPayment } from '@/hooks/order/useSyncOrderPayment';
import DeliveryStatusCard from './components/DeliveryStatusCard';
import LoadingScreen from './components/LoadingScreen';
import OrderItemsCard from './components/OrderItemsCard';
import OrderNotFound from './components/OrderNotFound';
import OrderOverviewCard from './components/OrderOverviewCard';
import OrderPageHeader from './components/OrderPageHeader';
import OrderSummaryCard from './components/OrderSummaryCard';
import PaymentChecking from './components/PaymentChecking';
import { useCancelOrder } from './hooks/useCancelOrder';
import { useLoadFailureToast } from './hooks/useLoadFailureToast';

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
    <div className='min-h-screen'>
      <div className='p-4 lg:p-6 max-w-7xl mx-auto space-y-4 lg:space-y-6'>
        <OrderPageHeader
          order={order}
          isCancelling={isCancelling}
          onCancel={cancel}
        />

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6'>
          <OrderOverviewCard order={order} paymentBranch={branch} />
          <OrderSummaryCard order={order} />
        </div>

        {order.status !== OrderStatus.CANCELED && (
          <DeliveryStatusCard order={order} />
        )}

        <OrderItemsCard order={order} />
      </div>
    </div>
  );
}
