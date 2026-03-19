"use client";

import useSWRInfinite from "swr/infinite";
import { useFetcher } from "../../useFetcher";
import { GetRecommendationsType } from "../../../common/types/product.types";
import { getKeyRecommendations } from "../../../common";
import { SWR_INFINITE_CONFIG } from "../../../common/constants/swr";

export const useGetRecommendations = () => {
  const { getData } = useFetcher();

  const {
    data: previewRecommendations,
    isLoading: previewRecommendationsIsLoading,
    isValidating: previewRecommendationsIsValidating,
    error: previewRecommendationsError,
    size,
    setSize,
    mutate,
  } = useSWRInfinite<GetRecommendationsType>(
    getKeyRecommendations,
    getData,
    SWR_INFINITE_CONFIG,
  );

  return {
    previewRecommendations,
    previewRecommendationsIsLoading,
    previewRecommendationsIsValidating,
    previewRecommendationsError,
    size,
    setSize,
    mutate,
  };
};
