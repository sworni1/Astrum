"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { useSWRConfig } from "swr";
import { showToast } from "@/common/helpers/showToast";
import type { ProductCartProps } from "@/common/types/product.types";
import { useHandedIds } from "@/features/pages/Checkout/hooks/useHandedIds";
import { reconcileLines } from "@/features/pages/Checkout/lib/reconcileLines";
import { useGetCart } from "@/hooks/product/useCart/useGetCart";

export type CheckoutRoute =
  | { status: "loading" }
  | { status: "failed"; retry: () => void }
  | { status: "empty" }
  | { status: "ready"; lines: ProductCartProps[]; missingCount: number };

export const useCheckoutRoute = (): CheckoutRoute => {
  const { cart, cartIsLoading, cartError } = useGetCart();
  const handedIds = useHandedIds();
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const t = useTranslations("cart");
  const leaving = useRef(false);

  const reconciled = useMemo(
    () => (handedIds === null ? null : reconcileLines(cart ?? [], handedIds)),
    [cart, handedIds],
  );

  const answered = reconciled !== null && !cartError && !cartIsLoading;
  const nothingSelected =
    reconciled !== null && reconciled.lines.length === 0 && answered;

  useEffect(() => {
    if (!nothingSelected || leaving.current) {
      return;
    }

    leaving.current = true;
    showToast({ title: t("nothingSelected"), type: "info" });
    router.replace("/cart");
  }, [nothingSelected, router, t]);

  if (cartError) {
    return {
      status: "failed",
      retry: () => {
        void mutate("/cart");
      },
    };
  }

  if (reconciled === null || cartIsLoading) {
    return { status: "loading" };
  }

  if (reconciled.lines.length === 0) {
    return { status: "empty" };
  }

  return {
    status: "ready",
    lines: reconciled.lines,
    missingCount: reconciled.missingCount,
  };
};
