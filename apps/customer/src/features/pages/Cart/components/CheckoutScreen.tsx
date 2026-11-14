"use client";

import { useTranslations } from "next-intl";
import type { ProductCartProps } from "@/common/types/product.types";
import { Button } from "@/components/ui/button";
import CheckoutForm from "./CheckoutForm";

type Props = {
  cartItems: ProductCartProps[];
  subtotal: number;
  onBack: () => void;
};

const CheckoutScreen = ({ cartItems, subtotal, onBack }: Props) => {
  const t = useTranslations("cart");

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          ← {t("back")}
        </Button>
        <h1 className="text-2xl font-semibold">{t("checkoutTitle")}</h1>
        <p className="text-muted-foreground">{t("checkoutSubtitle")}</p>
      </div>
      <CheckoutForm cartItems={cartItems} subtotal={subtotal} />
    </div>
  );
};

export default CheckoutScreen;
