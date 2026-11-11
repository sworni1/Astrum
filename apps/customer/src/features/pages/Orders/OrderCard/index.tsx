import Image from 'next/image';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { formatMoney } from '@/common/helpers/money';
import type { OrderListItem } from '@/common/types/order.types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getStatusVariant, ORDER_STATUS_KEYS } from './lib/status';

type Props = {
  order: OrderListItem;
};

const OrderCard = ({ order }: Props) => {
  const t = useTranslations('orders');
  const format = useFormatter();
  const remainingItemsCount = Math.max(0, order.orderItemsCount - 1);

  return (
    <Link href={`/orders/${order.id}`}>
      <Card className='w-full rounded-lg hover:shadow-md transition-shadow'>
        <CardContent className='p-4'>
          <div className='flex items-start justify-between mb-4'>
            <div>
              <h2 className='text-lg font-bold'>
                {t('number', { number: order.id.slice(-8) })}
              </h2>
              <p className='text-muted-foreground text-sm'>
                {format.dateTime(new Date(order.createdAt), {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              </p>
            </div>
            <div className='text-right'>
              <p className='text-sm text-muted-foreground'>{t('totalPaid')}</p>
              <p className='font-bold text-lg'>
                {formatMoney(order.grandTotal, order.currency)}
              </p>
            </div>
          </div>

          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
            <div className='flex-1'>
              <div className='flex items-center gap-2 mb-2'>
                <p className='text-sm'>{order.shippingMethodName}</p>
                <Badge
                  className={`text-white px-2 py-0.5 rounded-md text-xs font-medium ${getStatusVariant(order.status)}`}
                >
                  {t(`status.${ORDER_STATUS_KEYS[order.status]}`)}
                </Badge>
              </div>

              <p className='text-sm text-muted-foreground mb-3'>
                {t('deliveryDate', {
                  date: format.dateTime(new Date(order.deliveryDate), {
                    dateStyle: 'long',
                  }),
                })}
              </p>
            </div>

            <div className='flex-shrink-0 mt-4 md:mt-0'>
              {order.previewImage ? (
                <div className='relative'>
                  <Image
                    src={order.previewImage}
                    alt={t('productImage')}
                    width={80}
                    height={80}
                    className='rounded-md object-cover'
                  />
                  {remainingItemsCount > 0 && (
                    <div className='absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center'>
                      +{remainingItemsCount}
                    </div>
                  )}
                </div>
              ) : (
                <div className='w-20 h-20 bg-muted rounded-md flex items-center justify-center'>
                  <span className='text-muted-foreground text-xs'>
                    {t('itemsCount', { count: order.orderItemsCount })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default OrderCard;
