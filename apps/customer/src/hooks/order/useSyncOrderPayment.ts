"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { useFetcher } from "@/hooks/useFetcher";

/** Which of the two return branches the provider sent the customer to. */
export type PaymentReturnBranch = "return" | "cancelled" | null;

export interface UseSyncOrderPaymentReturn {
  /** True while the one sync call runs, so the page shows the checking copy. */
  isChecking: boolean;
  branch: PaymentReturnBranch;
}

const readBranch = (): PaymentReturnBranch => {
  if (typeof window === "undefined") {
    return null;
  }

  const branch = new URLSearchParams(window.location.search).get("payment");

  return branch === "return" || branch === "cancelled" ? branch : null;
};

/**
 * The provider sends the browser back with `?payment=return` or
 * `?payment=cancelled`. The first branch reads the truth from the gateway once
 * (a ref guard, so a double mount sends no second request) and the parameter is
 * dropped in both, so a refresh does not repeat the call (AC-14).
 */
export const useSyncOrderPayment = (
  orderId: string,
): UseSyncOrderPaymentReturn => {
  const { postItem } = useFetcher();
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const started = useRef(false);
  const [isChecking, setIsChecking] = useState(false);
  const [branch, setBranch] = useState<PaymentReturnBranch>(null);

  useEffect(() => {
    if (started.current) {
      return;
    }

    const found = readBranch();

    if (found === null) {
      return;
    }

    started.current = true;
    setBranch(found);
    router.replace(`/orders/${orderId}`);

    if (found !== "return") {
      return;
    }

    setIsChecking(true);

    void postItem(`/orders/${orderId}/payment/sync`, { arg: {} })
      .then(async () => {
        await Promise.allSettled([
          mutate(`/orders/${orderId}`),
          mutate("/orders"),
        ]);
      })
      // A failed sync leaves the order as it was read and still offers the pay
      // control: the provider page already told the customer what happened.
      .catch(() => undefined)
      .finally(() => {
        setIsChecking(false);
      });
  }, [orderId, postItem, mutate, router]);

  return { isChecking, branch };
};
