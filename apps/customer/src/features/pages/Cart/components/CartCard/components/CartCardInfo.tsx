"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type Props = {
  id: string;
  name: string;
  price: number;
};

const CartCardInfo = ({ id, name, price }: Props) => {
  const t = useTranslations("cart");

  return (
    <div>
      <Link href={`/products/${id}`}>
        <h3 className="font-medium">{name}</h3>
      </Link>

      <p className="text-muted-foreground text-sm">
        {"Grey"} • {15}
      </p>
      <p className="text-sm font-medium mt-1">
        {t("eachPrice", { price: price.toFixed(2) })}
      </p>
    </div>
  );
};

export default CartCardInfo;
