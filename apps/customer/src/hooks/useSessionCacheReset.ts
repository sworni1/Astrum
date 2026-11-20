"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";

export const useSessionCacheReset = () => {
  const { unload } = useSWRConfig();

  return useCallback(
    ({ revalidate = false }: { revalidate?: boolean } = {}) =>
      unload({ revalidate }),
    [unload],
  );
};
