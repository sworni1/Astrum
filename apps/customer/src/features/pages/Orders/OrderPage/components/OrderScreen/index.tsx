import type { Order } from "@/common/types/order.types";
import { Separator } from "@/components/ui/separator";
import OrderLine from "@/features/pages/Orders/OrderPage/components/OrderLine";
import OrderPageHeader from "@/features/pages/Orders/OrderPage/components/OrderPageHeader";
import OrderPaymentBlock from "@/features/pages/Orders/OrderPage/components/OrderPaymentBlock";
import OrderPickupBlock from "@/features/pages/Orders/OrderPage/components/OrderPickupBlock";
import OrderTotalCard from "@/features/pages/Orders/OrderPage/components/OrderTotalCard";
import type { PaymentReturnBranch } from "@/hooks/order/useSyncOrderPayment";

type Props = {
  order: Order;
  isCancelling: boolean;
  onCancel: () => void;
  paymentBranch: PaymentReturnBranch;
};

/**
 * The screen the mockup draws: one left card holding the header, the lines, the
 * pickup block and the payment block, and one right column holding the total, its
 * breakdown and the receiving block. Below 1024px the two stack (spec 0027,
 * AC-2 to AC-6).
 */
const OrderScreen = ({ order, isCancelling, onCancel, paymentBranch }: Props) => (
  <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-6 lg:px-10 lg:pt-9">
    <div
      className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]"
      data-testid="order-grid"
    >
      <section className="rounded-xl border border-border bg-card p-7">
        <OrderPageHeader
          order={order}
          isCancelling={isCancelling}
          onCancel={onCancel}
        />
        <div className="mt-5 border-t border-border">
          {order.orderItems.map((item) => (
            <OrderLine key={item.id} item={item} currency={order.currency} />
          ))}
        </div>
        <Separator className="my-5" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <OrderPickupBlock order={order} />
          <OrderPaymentBlock order={order} paymentBranch={paymentBranch} />
        </div>
      </section>

      <OrderTotalCard order={order} />
    </div>
  </div>
);

export default OrderScreen;
