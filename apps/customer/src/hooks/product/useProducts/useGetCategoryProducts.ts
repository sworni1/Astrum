"use client";

import useSWRInfinite from "swr/infinite";
import { useFetcher } from "../../useFetcher";
import { GetRecommendationsType } from "../../../common/types/product.types";
import { getKeyProductsByCategory } from "../../../common/helpers/getKeyProductsByCategory";
import { SWR_INFINITE_CONFIG } from "../../../common/constants/swr";

export const useGetCategoryProducts = (
  category: string,
  search_query?: string,
) => {
  const { getData } = useFetcher();

  const {
    data: previewProductsByCategory,
    isLoading: previewProductsByCategoryLoading,
    isValidating: previewProductsByCategoryIsValidating,
    error: previewProductsByCategoryError,
    size,
    setSize,
  } = useSWRInfinite<GetRecommendationsType>(
    getKeyProductsByCategory(category, search_query),
    getData,
    SWR_INFINITE_CONFIG,
  );

  return {
    previewProductsByCategory,
    previewProductsByCategoryLoading,
    previewProductsByCategoryIsValidating,
    previewProductsByCategoryError,
    size,
    setSize,
  };
};
