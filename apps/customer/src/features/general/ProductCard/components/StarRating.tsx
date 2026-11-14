import { memo } from 'react';
import { FaStar } from 'react-icons/fa';

const StarRating = memo(
  ({ stars, reviewCount }: { stars: number; reviewCount: number }) => (
    <div className='flex items-center text-sm text-gray-700 gap-1'>
      <div className='flex items-center'>
        <FaStar size={16} color='yellow' />
      </div>
      <p className='text-sm font-medium text-gray-900 dark:text-white'>
        {stars}
      </p>
      <span className='ml-1 text-gray-500'>({reviewCount})</span>
    </div>
  ),
);

StarRating.displayName = 'StarRating';

export default StarRating;
