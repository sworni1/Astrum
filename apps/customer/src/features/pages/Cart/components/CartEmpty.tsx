"use client";

import { useTranslations } from "next-intl";

const CartEmpty = () => {
  const t = useTranslations("cart");

  return (
    <div className="text-center py-20 text-muted-foreground">{t("empty")}</div>
  );
};

export default CartEmpty;
