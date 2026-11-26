export type DistributionRow = {
  star: number;
  count: number;
  share: number;
};

export const ratingShare = (count: number, total: number): number =>
  total > 0 ? Math.round((count * 100) / total) : 0;

export const distributionRows = (
  distribution: Record<string, number>,
  total: number,
): DistributionRow[] =>
  [5, 4, 3, 2, 1].map((star) => {
    const count = distribution[String(star)] ?? 0;

    return { star, count, share: ratingShare(count, total) };
  });

export const formatAverageRating = (average: number): string =>
  average.toFixed(1);
