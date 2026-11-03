"use client";

import { useMemo } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import type { UserData } from "../../common";
import { useFetcher } from "../useFetcher";
import { useLogOut } from "../useLogOut";

// Optimized SWR configuration for user data
const USER_SWR_CONFIG = {
  compare: (a: UserData | undefined, b: UserData | undefined) => {
    // Deep comparison for user data
    return JSON.stringify(a) === JSON.stringify(b);
  },
  keepPreviousData: true,
  revalidateIfStale: false, // User data doesn't change often
  revalidateOnFocus: false, // Avoid unnecessary requests
  revalidateOnReconnect: true,
  dedupingInterval: 10000, // Dedupe for 10 seconds
  errorRetryCount: 3,
  errorRetryInterval: 2000,
} as const;

export const useUser = () => {
  const { getData, deleteItem, patchItem } = useFetcher();
  const { logOut } = useLogOut();

  const {
    data: profileData,
    isLoading: profileIsLoading,
    error: profileIsError,
    mutate: mutateProfile,
  } = useSWR<UserData>("/users/me", getData, USER_SWR_CONFIG);

  const {
    trigger: updateAccountTrigger,
    error: updateAccountError,
    isMutating: isUpdatingAccount,
  } = useSWRMutation("/users/me", patchItem);

  const {
    trigger: updatePasswordTrigger,
    error: updatePasswordError,
    isMutating: isUpdatingPassword,
  } = useSWRMutation("/users/me/password", patchItem);

  const { trigger: deleteAccountTrigger, isMutating: isDeletingAccount } =
    useSWRMutation("/users/me", deleteItem, {
      onSuccess: () => logOut(),
      onError: () => logOut(),
    });

  // Memoize derived state
  const derivedState = useMemo(
    () => ({
      isUserLoaded: !!profileData && !profileIsLoading,
      hasUserError: !!profileIsError,
      isAnyMutationLoading:
        isUpdatingAccount || isUpdatingPassword || isDeletingAccount,
    }),
    [
      profileData,
      profileIsLoading,
      profileIsError,
      isUpdatingAccount,
      isUpdatingPassword,
      isDeletingAccount,
    ],
  );

  return useMemo(
    () => ({
      profileData,
      profileIsLoading,
      profileIsError,
      updateAccountTrigger,
      updateAccountError,
      updatePasswordError,
      updatePasswordTrigger,
      deleteAccountTrigger,
      mutateProfile,
      isUpdatingAccount,
      isUpdatingPassword,
      isDeletingAccount,
      ...derivedState,
    }),
    [
      profileData,
      profileIsLoading,
      profileIsError,
      updateAccountTrigger,
      updateAccountError,
      updatePasswordError,
      updatePasswordTrigger,
      deleteAccountTrigger,
      mutateProfile,
      isUpdatingAccount,
      isUpdatingPassword,
      isDeletingAccount,
      derivedState,
    ],
  );
};

// Export types for better TypeScript support
export type UseUserReturn = ReturnType<typeof useUser>;
