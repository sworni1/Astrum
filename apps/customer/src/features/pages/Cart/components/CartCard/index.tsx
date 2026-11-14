'use client';

import type { ProductCartProps } from '@/common/types/product.types';
import { Card, CardContent } from '@/components/ui/card';
import CartCardActions from './components/CartCardActions';
import CartCardFooter from './components/CartCardFooter';
import CartCardImage from './components/CartCardImage';
import CartCardInfo from './components/CartCardInfo';

const CartCard = ({
  id,
  name,
  quantity,
  quantityInCart,
  isWishlisted,
  price,
  previewImage,
  isSelected = false,
  isOutOfStock,
  onSelectionChange,
}: ProductCartProps) => (
  <Card
    className={`overflow-hidden p-0 transition-all ${isSelected ? 'border border-primary' : ''}`}
  >
    <CardContent className='p-0'>
      <div className='flex h-full flex-col md:flex-row'>
        <CartCardImage id={id} name={name} previewImage={previewImage} />

        <div className='flex-1 p-6 pb-3'>
          <div className='flex justify-between'>
            <CartCardInfo id={id} name={name} price={price} />
            <CartCardActions
              id={id}
              isSelected={isSelected}
              onSelectionChange={onSelectionChange}
            />
          </div>

          <CartCardFooter
            isOutOfStock={isOutOfStock}
            id={id}
            isWishlisted={isWishlisted}
            quantity={quantity}
            quantityInCart={quantityInCart}
          />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default CartCard;
