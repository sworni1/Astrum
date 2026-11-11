"use client";

import useSWRInfinite from "swr/infinite";
import { SWR_INFINITE_CONFIG } from "@/common/constants/swr";
import type { GetRecommendationsType } from "@/common/types/product.types";
import { useFetcher } from "@/hooks/useFetcher";
import { getKeyRecommendations } from "./getKeyRecommendations";

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
