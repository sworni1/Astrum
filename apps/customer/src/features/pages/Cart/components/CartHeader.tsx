"use client";

import { useTranslations } from "next-intl";

type Props = {
  itemCount: number;
};

const CartHeader = ({ itemCount }: Props) => {
  const t = useTranslations("cart");

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">
        {t("itemCount", { count: itemCount })}
      </p>
    </div>
  );
};

export default CartHeader;
