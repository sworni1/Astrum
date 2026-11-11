import type { SellerOrderLine } from "@/common/types/order.types";
import { OrderItemStatus } from "@/common/types/order.types";

let cachedTimeZone: string | undefined;

/**
 * The request config pins the formatter to UTC, so the browser zone is passed
 * on every date the panel shows.
 */
export const browserTimeZone = (): string => {
  cachedTimeZone ??= Intl.DateTimeFormat().resolvedOptions().timeZone;

  return cachedTimeZone;
};

/** A float multiply answers 59.97000000000001, so the display rounds it. */
export const lineSubtotal = (line: SellerOrderLine): number =>
  Math.round(line.quantity * line.price * 100) / 100;

export type StatusCount = { status: string; count: number };

/** Counts the lines of one group by status, in the order of the enum. */
export const countLinesByStatus = (
  lines: readonly SellerOrderLine[],
): StatusCount[] => {
  const counts = new Map<string, number>();

  for (const line of lines) {
    counts.set(line.status, (counts.get(line.status) ?? 0) + 1);
  }

  const known = Object.values(OrderItemStatus).filter((status) =>
    counts.has(status),
  );
  const unknown = [...counts.keys()].filter(
    (status) => !known.includes(status as OrderItemStatus),
  );

  return [...known, ...unknown].map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
};
