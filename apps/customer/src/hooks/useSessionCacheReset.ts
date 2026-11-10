"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";

/**
 * Empties the SWR store at a session boundary. `unload` deletes every entry
 * together with the request markers and the previous data kept by
 * `keepPreviousData`, so the first page of the next session fetches its own
 * payload instead of deduping against the request of the account that left.
 *
 * `revalidate` stays off by default: a refetch fired before the new cookie
 * lands would fill the store again from the account that is leaving. The sign
 * in and register paths pass `true`, because the cookie already carries the new
 * identity at that point.
 */
export const useSessionCacheReset = () => {
  const { unload } = useSWRConfig();

  return useCallback(
    ({ revalidate = false }: { revalidate?: boolean } = {}) =>
      unload({ revalidate }),
    [unload],
  );
};
