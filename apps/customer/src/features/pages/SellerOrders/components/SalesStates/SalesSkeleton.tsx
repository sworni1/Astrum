"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { STAT_GRID, STAT_TILE } from "@/features/general/lib/screenStyles";

const TILES = [0, 1, 2, 3];
const ROWS = [0, 1, 2];

const SalesSkeleton = () => {
  const t = useTranslations("seller");

  return (
    <div className="flex flex-col gap-6" aria-label={t("states.loadingLabel")}>
      <div aria-hidden>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      <div className={STAT_GRID} aria-hidden>
        {TILES.map((tile) => (
          <div key={tile} className={STAT_TILE}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-7 w-32" />
          </div>
        ))}
      </div>

      <div
        className="overflow-hidden rounded-xl border border-border bg-card"
        aria-hidden
      >
        {ROWS.map((row) => (
          <div
            key={row}
            className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0"
          >
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SalesSkeleton;
