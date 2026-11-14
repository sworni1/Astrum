import Link from 'next/link';
import { memo } from 'react';
import type { ProductCardProps } from '@/common/types/product.types';
import OptimizedImage from '@/components/OptimizedImage';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import AddToCartWithQuantity from '@/features/general/AddToCartWithQuantity';
import ToggleWishlistItemButton from './actions/ToggleWishlistItemButton';
import PriceDisplay from './components/PriceDisplay';
import ProductName from './components/ProductName';
import StarRating from './components/StarRating';

const ProductCard = memo<ProductCardProps>(function ProductCard({
  id,
  name,
  previewImage,
  images,
  quantity,
  price,
  // discount, // TODO: Implement discount display
  stars,
  currency,
  _count,
  isWishlisted,
  quantityInCart,
}) {
  const reviewCount = _count?.impressions ?? 0;

  return (
    <Card className='select-none'>
      <Link href={`/products/${id}`}>
        <CardHeader className='h-auto w-auto'>
          <OptimizedImage
            className='aspect-4/3 w-full rounded-lg object-cover'
            width={300}
            height={300}
            src={previewImage}
            fallbackSrcs={images}
            alt={name}
            priority={false}
            showLoadingSpinner={true}
            containerClassName='aspect-4/3'
            errorVariant='minimal'
          />
        </CardHeader>
      </Link>

      <CardContent>
        <PriceDisplay price={price} currency={currency} />
        <ProductName name={name} productId={id} />
      </CardContent>

      <CardFooter className='flex flex-col justify-between items-center h-[100px]'>
        <div className='flex justify-between items-center w-full'>
          <StarRating stars={stars} reviewCount={reviewCount} />
        </div>

        <div className='flex w-full gap-[10px] items-center'>
          <ToggleWishlistItemButton
            productId={id}
            isWishlisted={isWishlisted}
          />
          <AddToCartWithQuantity
            quantity={quantity}
            size='full'
            quantityInCart={quantityInCart}
            productId={id}
          />
        </div>
      </CardFooter>
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
