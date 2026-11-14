"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/common/helpers/money";
import type { Currency } from "@/common/types/product.types";

type Props = {
  subtotal: number;
  shippingPrice: number;
  total: number;
  currency: Currency;
};

const OrderSummary = ({ subtotal, shippingPrice, total, currency }: Props) => {
  const t = useTranslations("cart");

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex justify-between text-sm">
        <span>{t("subtotal")}</span>
        <span>{formatMoney(subtotal, currency)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>{t("shipping")}</span>
        <span>{formatMoney(shippingPrice, currency)}</span>
      </div>
      <div className="flex justify-between font-medium">
        <span>{t("total")}</span>
        <span>{formatMoney(total, currency)}</span>
      </div>
    </div>
  );
};

export default OrderSummary;
