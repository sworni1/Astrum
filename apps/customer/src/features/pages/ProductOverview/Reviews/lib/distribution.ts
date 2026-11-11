export type DistributionRow = {
  star: number;
  count: number;
  share: number;
};

/**
 * The integer share of the total. Five shares are not forced to add up to 100,
 * because rounding does not divide evenly (AC-3).
 */
export const ratingShare = (count: number, total: number): number =>
  total > 0 ? Math.round((count * 100) / total) : 0;

/** Five rows, five stars to one, whatever the answer carried (AC-3). */
export const distributionRows = (
  distribution: Record<string, number>,
  total: number,
): DistributionRow[] =>
  [5, 4, 3, 2, 1].map((star) => {
    const count = distribution[String(star)] ?? 0;

    return { star, count, share: ratingShare(count, total) };
  });

/** The average prints with one decimal, never as a running float (AC-3, AC-5). */
export const formatAverageRating = (average: number): string => average.toFixed(1);
