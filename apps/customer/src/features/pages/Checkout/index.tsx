"use client";

import { useTranslations } from "next-intl";
import CheckoutForm from "@/features/pages/Checkout/components/CheckoutForm";
import CheckoutLoadFailure from "@/features/pages/Checkout/components/CheckoutLoadFailure";
import CheckoutSkeleton from "@/features/pages/Checkout/components/CheckoutSkeleton";
import { useCheckoutRoute } from "@/features/pages/Checkout/hooks/useCheckoutRoute";
import {
  CHECKOUT_NOTE,
  CHECKOUT_STACK,
  CHECKOUT_SUBTITLE,
  CHECKOUT_TITLE,
  CHECKOUT_WRAPPER,
} from "@/features/pages/Checkout/lib/styles";

export default function Checkout() {
  const route = useCheckoutRoute();
  const t = useTranslations("cart");

  if (route.status === "failed") {
    return <CheckoutLoadFailure onRetry={route.retry} />;
  }

  if (route.status !== "ready") {
    return <CheckoutSkeleton />;
  }

  return (
    <main className={CHECKOUT_WRAPPER}>
      <div className={CHECKOUT_STACK}>
        <header>
          <h1 className={CHECKOUT_TITLE}>{t("checkoutTitle")}</h1>
          <p className={CHECKOUT_SUBTITLE}>{t("checkoutSubtitle")}</p>
          {route.missingCount > 0 ? (
            <p className={`mt-2 ${CHECKOUT_NOTE}`}>
              {t("selectionPartlyUnavailable")}
            </p>
          ) : null}
        </header>

        <CheckoutForm lines={route.lines} />
      </div>
    </main>
  );
}
