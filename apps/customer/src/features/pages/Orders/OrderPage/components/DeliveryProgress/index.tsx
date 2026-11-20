import { useTranslations } from 'next-intl';
import type { OrderStatus } from '@/common/types/order.types';
import {
  DELIVERY_PROGRESS,
  deliverySteps,
} from '@/features/pages/Orders/OrderPage/lib/status';

type Props = {
  status: OrderStatus;
};

/**
 * The receiving rail: one 6px track, one fill, and the four step labels under
 * it, drawn once for both breakpoints (spec 0027, AC-5; spec 0031, AC-7). Each
 * label owns a quarter of the width, so the longest Russian word wraps inside
 * its own column instead of running into the next one. The pending status has no
 * label here: its fill stays empty. A cancelled order never reaches this
 * component, and a status it does not know fills nothing.
 */
const DeliveryProgress = ({ status }: Props) => {
  const t = useTranslations('orders');
  const steps = deliverySteps(status);

  return (
    <div className='mt-4'>
      <div
        className='h-1.5 w-full overflow-hidden rounded-full bg-border'
        data-testid='order-progress'
      >
        <div
          className='h-full rounded-full bg-foreground motion-safe:transition-[width] motion-safe:duration-300'
          style={{ width: `${DELIVERY_PROGRESS[status] ?? 0}%` }}
        />
      </div>
      <div className='mt-2.5 grid grid-cols-4 gap-0.5 text-center text-[11px] leading-tight sm:text-xs'>
        {steps.map((step) => (
          <span
            key={step.key}
            data-testid='order-progress-step'
            className={
              step.active ? 'text-foreground' : 'text-muted-foreground'
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
