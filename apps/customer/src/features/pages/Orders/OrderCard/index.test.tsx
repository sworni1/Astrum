import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type OrderListItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/common/types/order.types';
import { Currency } from '@/common/types/product.types';
import OrderCard from './index';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span data-image-source={src} data-image-alt={alt} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    key === 'itemsCount' ? `${values?.count} items` : key,
  useFormatter: () => ({ dateTime: () => 'date' }),
}));

const order: OrderListItem = {
  id: 'order-1',
  userId: 'user-1',
  totalPrice: 20,
  paymentMethod: PaymentMethod.CASH,
  paymentStatus: PaymentStatus.PENDING,
  status: OrderStatus.PENDING,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  deliveryAddress: 'Street 1',
  deliveryDate: new Date('2026-11-02T10:00:00.000Z'),
  shippingMethodId: 'shipping-1',
  shippingMethodName: 'Standard',
  deliveryPrice: 5,
  grandTotal: 25,
  currency: Currency.RUB,
  orderItemsCount: 3,
  previewImage: 'https://cdn.test/preview.png',
};

describe('OrderCard', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
  });

  const render = async (item: OrderListItem): Promise<void> => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<OrderCard order={item} />);
    });
  };

  it('renders the list preview and remaining item count', async () => {
    await render(order);

    expect(container.querySelector('[data-image-source]')?.getAttribute(
      'data-image-source',
    )).toBe('https://cdn.test/preview.png');
    expect(container.textContent).toContain('+2');
  });

  it('shows the full item count when the order has no preview image', async () => {
    await render({ ...order, previewImage: null });

    expect(container.querySelector('[data-image-source]')).toBeNull();
    expect(container.textContent).toContain('3 items');
  });
});
