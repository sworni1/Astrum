"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { deleteSession } from "../common/helpers/session";

export const useLogOut = () => {
  const router = useRouter();

  const logOut = useCallback(async () => {
    await deleteSession();
    router.push("/auth/signin");
  }, [router]);

  return useMemo(
    () => ({
      logOut,
    }),
    [logOut],
  );
};
