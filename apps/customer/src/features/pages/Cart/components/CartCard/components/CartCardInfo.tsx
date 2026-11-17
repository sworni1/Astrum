"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/common/helpers/money";
import { Currency } from "@/common/types/product.types";

type Props = {
  id: string;
  name: string;
  price: number;
};

const CartCardInfo = ({ id, name, price }: Props) => {
  const t = useTranslations("cart");
  const locale = useLocale();

  return (
    <div>
      <Link href={`/products/${id}`}>
        <h3 className="font-medium">{name}</h3>
      </Link>

      <p className="text-muted-foreground text-sm">
        {"Grey"} • {15}
      </p>
      <p className="text-sm font-medium mt-1">
        {t("eachPrice", { price: formatMoney(price, Currency.RUB, locale) })}
      </p>
    </div>
  );
};

export default CartCardInfo;
