import type { GetRecommendationsType } from "../types/product.types";

export const getKeyRecommendations = (
  pageIndex: number,
  previousPageData: GetRecommendationsType,
) => {
  if (previousPageData && !previousPageData) return null;

  if (pageIndex === 0) return `/products/recommendations`;

  return `/products/recommendations?cursor=${previousPageData.nextCursor}`;
};
