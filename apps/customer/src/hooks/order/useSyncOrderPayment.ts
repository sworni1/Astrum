"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { useFetcher } from "@/hooks/useFetcher";
import { isOrderListKey } from "./orderListKey";

export type PaymentReturnBranch = "return" | "cancelled" | null;

export interface UseSyncOrderPaymentReturn {
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
          mutate(isOrderListKey),
        ]);
      })
      .catch(() => undefined)
      .finally(() => {
        setIsChecking(false);
      });
  }, [orderId, postItem, mutate, router]);

  return { isChecking, branch };
};
