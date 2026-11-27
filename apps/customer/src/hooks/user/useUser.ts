"use client";

import { useMemo } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import type { UserData } from "@/common/types/user.types";
import { useFetcher } from "@/hooks/useFetcher";
import { useLogOut } from "@/hooks/useLogOut";

const USER_SWR_CONFIG = {
  compare: (a: UserData | undefined, b: UserData | undefined) => {
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

type UseUserOptions = { enabled?: boolean };

export const useUser = ({ enabled = true }: UseUserOptions = {}) => {
  const { getData, deleteItem, patchItem } = useFetcher();
  const { logOut } = useLogOut();

  const {
    data: profileData,
    isLoading: profileIsLoading,
    error: profileIsError,
    mutate: mutateProfile,
  } = useSWR<UserData>(enabled ? "/users/me" : null, getData, USER_SWR_CONFIG);

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

export type UseUserReturn = ReturnType<typeof useUser>;
