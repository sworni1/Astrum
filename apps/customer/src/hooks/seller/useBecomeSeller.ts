"use client";

import useSWRMutation from "swr/mutation";
import { useFetcher } from "@/hooks/useFetcher";

export type BecomeSellerResult = { isSeller: true; businessName: string };
export type ShopNameInput = { name: string };

export interface UseBecomeSellerReturn {
  becomeSeller: (input: ShopNameInput) => Promise<BecomeSellerResult>;
  isSubmitting: boolean;
  error: unknown;
}

/** One deliberate action opens the shop of the signed in account (spec 0008). */
export const useBecomeSeller = (): UseBecomeSellerReturn => {
  const { postItem } = useFetcher();

  const { trigger, isMutating, error } = useSWRMutation<
    BecomeSellerResult,
    unknown,
    string,
    ShopNameInput
  >("/seller/onboarding", postItem);

  return { becomeSeller: trigger, isSubmitting: isMutating, error };
};
