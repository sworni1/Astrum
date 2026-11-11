import type { GetRecommendationsType } from "@/common/types/product.types";

export const getKeyProductsByCategory =
  (category: string, search_query?: string) =>
  (pageIndex: number, previousPageData: GetRecommendationsType) => {
    if (previousPageData && !previousPageData) return null;

    if (pageIndex === 0)
      return `/products/categories/${category}/?search_query=${search_query}`;

    return `/products/categories/${category}/?cursor=${previousPageData.nextCursor}&search_query=${search_query}`;
  };
