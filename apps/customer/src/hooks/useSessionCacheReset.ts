"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";

export const useSessionCacheReset = () => {
  const { mutate } = useSWRConfig();

  return useCallback(
    () => mutate(() => true, undefined, { revalidate: false }),
    [mutate],
  );
};
