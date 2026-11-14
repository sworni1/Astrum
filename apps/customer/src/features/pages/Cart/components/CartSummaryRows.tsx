"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/common/helpers/money";
import type { Currency } from "@/common/types/product.types";

type Props = {
  itemCount: number;
  selectedCount: number;
  subtotal: number;
  currency: Currency;
};

const CartSummaryRows = ({
  itemCount,
  selectedCount,
  subtotal,
  currency,
}: Props) => {
  const t = useTranslations("cart");

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{t("totalItems")}</span>
        <span>{t("itemsValue", { count: itemCount })}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>{t("selectedItems", { count: selectedCount })}</span>
        <span>{formatMoney(subtotal, currency)}</span>
      </div>
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{t("shipping")}</span>
        <span>{t("shippingAtCheckout")}</span>
      </div>
      <div className="flex justify-between font-medium text-base pt-2 border-t">
        <span>{t("orderTotal")}</span>
        <span>{formatMoney(subtotal, currency)}</span>
      </div>
    </div>
  );
};

export default CartSummaryRows;
