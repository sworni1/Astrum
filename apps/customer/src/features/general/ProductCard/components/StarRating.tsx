import { memo } from 'react';
import { FaStar } from 'react-icons/fa';

/**
 * The rating line of a card: the average of the product's approved reviews with
 * one decimal, the bare zero when nothing has been reviewed yet, then the count.
 * Same numbers the product screen prints (spec 0021, AC-6).
 */
const StarRating = memo(
  ({
    averageRating,
    reviewCount,
  }: {
    averageRating: number;
    reviewCount: number;
  }) => (
    <div className='flex items-center text-sm text-gray-700 gap-1'>
      <div className='flex items-center'>
        <FaStar size={16} color='yellow' />
      </div>
      <p className='text-sm font-medium text-gray-900 dark:text-white'>
        {reviewCount > 0 ? averageRating.toFixed(1) : 0}
      </p>
      <span className='ml-1 text-gray-500'>({reviewCount})</span>
    </div>
  ),
);

StarRating.displayName = 'StarRating';

export default StarRating;
