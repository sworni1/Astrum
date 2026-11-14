import Link from 'next/link';
import { memo } from 'react';
import { CardDescription } from '@/components/ui/card';

const ProductName = memo(
  ({ name, productId }: { name: string; productId: string }) => (
    <Link href={`/products/${productId}`}>
      <CardDescription
        className='text-lg font-[500] line-clamp-2 mb-[-15px] h-[55px] text-gray-900 dark:text-white'
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {name}
      </CardDescription>
    </Link>
  ),
);
ProductName.displayName = 'ProductName';
export default ProductName;
