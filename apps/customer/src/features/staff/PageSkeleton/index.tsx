"use client";

import { Skeleton } from "@/components/ui/skeleton";

type Props = { label: string };

/** One skeleton while a read is in flight, so no empty heading flashes. */
const PageSkeleton = ({ label }: Props) => (
  <div
    className="mx-auto max-w-screen-xl px-4 py-6 2xl:px-0"
    aria-label={label}
  >
    <Skeleton className="h-7 w-48" />
    <Skeleton className="mt-3 h-4 w-64" />
    <Skeleton className="mt-6 h-8 w-full max-w-sm" />
  </div>
);

export default PageSkeleton;
