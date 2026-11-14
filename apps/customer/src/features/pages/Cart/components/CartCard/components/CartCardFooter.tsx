'use client';

import AddToCartWithQuantity from '@/features/general/AddToCartWithQuantity';
import ToggleWishlistItemButton from '@/features/general/ProductCard/actions/ToggleWishlistItemButton';

type Props = {
  id: string;
  isWishlisted: boolean;
  quantity: number;
  quantityInCart: number;
  isOutOfStock: boolean;
};

const CartCardFooter = ({
  id,
  isWishlisted,
  quantity,
  quantityInCart,
  isOutOfStock,
}: Props) => (
  <div className='mt-4 flex items-center justify-between'>
    <ToggleWishlistItemButton productId={id} isWishlisted={isWishlisted} />
    <AddToCartWithQuantity
      isOutOfStock={isOutOfStock}
      productId={id}
      quantity={quantity}
      size='sm'
      quantityInCart={quantityInCart}
      allowAdd={false}
    />
  </div>
);

export default CartCardFooter;
