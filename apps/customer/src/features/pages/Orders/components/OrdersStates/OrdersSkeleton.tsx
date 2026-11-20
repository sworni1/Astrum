"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { STAT_GRID, STAT_TILE } from "@/features/general/lib/screenStyles";

const OrdersSkeleton = () => (
  <div className={STAT_GRID} aria-hidden>
    {[0, 1, 2].map((tile) => (
      <div key={tile} className={STAT_TILE}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1.5 h-7 w-32" />
      </div>
    ))}
  </div>
);

export default OrdersSkeleton;
