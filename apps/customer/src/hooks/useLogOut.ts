"use client";

import { useCallback, useMemo } from "react";
import { endSession } from "../common/helpers/session";

export const useLogOut = () => {
  const logOut = useCallback(async () => {
    await endSession();
  }, []);

  return useMemo(
    () => ({
      logOut,
    }),
    [logOut],
  );
};
