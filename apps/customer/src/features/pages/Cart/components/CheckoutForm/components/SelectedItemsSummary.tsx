"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/common/helpers/money";
import type { Currency, ProductCartProps } from "@/common/types/product.types";

type Props = {
  items: ProductCartProps[];
  currency: Currency;
};

const SelectedItemsSummary = ({ items, currency }: Props) => {
  const t = useTranslations("cart");

  return (
    <div className="mb-6 p-4 bg-muted/30 rounded-lg">
      <h3 className="font-medium mb-2">
        {t("checkoutSelectedItems", { count: items.length })}
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="flex-1">
              {item.name} x {item.quantityInCart}
            </span>
            <span className="font-medium">
              {formatMoney(item.price * item.quantityInCart, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SelectedItemsSummary;
