"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { STAT_LABEL, STAT_TILE, STAT_VALUE } from "@/features/general/lib/screenStyles";

type Props = {
  label: string;
  value?: string;
};

const StatTile = ({ label, value }: Props) => (
  <div className={STAT_TILE}>
    <span className={STAT_LABEL}>{label}</span>
    {value === undefined ? (
      <Skeleton className="mt-1.5 h-7 w-24" />
    ) : (
      <span className={STAT_VALUE}>{value}</span>
    )}
  </div>
);

export default StatTile;
