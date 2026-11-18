"use client";

import { useTranslations } from "next-intl";
import type { Currency } from "@/common/types/product.types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import CartFeatures from "./CartFeatures";
import CartSummaryRows from "./CartSummaryRows";
import CheckoutButton from "./CheckoutButton";

type Props = {
  itemCount: number;
  selectedCount: number;
  subtotal: number;
  currency: Currency;
  guest: boolean;
};

const CartSummary = ({
  itemCount,
  selectedCount,
  subtotal,
  currency,
  guest,
}: Props) => {
  const t = useTranslations("cart");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("summaryTitle")}</CardTitle>
        <CardDescription>{t("summaryDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <CartSummaryRows
          itemCount={itemCount}
          selectedCount={selectedCount}
          subtotal={subtotal}
          currency={currency}
        />
        <CartFeatures />
        <CheckoutButton selectedCount={selectedCount} guest={guest} />
      </CardContent>
    </Card>
  );
};

export default CartSummary;
