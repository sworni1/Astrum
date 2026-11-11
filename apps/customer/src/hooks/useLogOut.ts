"use client";

import { useCallback, useMemo } from "react";
import { endSession } from "@/common/helpers/session";
import { useSessionCacheReset } from "./useSessionCacheReset";

export const useLogOut = () => {
  const resetSessionCache = useSessionCacheReset();

  const logOut = useCallback(async () => {
    resetSessionCache();

    await endSession();
  }, [resetSessionCache]);

  return useMemo(
    () => ({
      logOut,
    }),
    [logOut],
  );
};
