"use client";

import { Package, Shield, Truck } from "lucide-react";
import { useTranslations } from "next-intl";

const CartFeatures = () => {
  const t = useTranslations("cart");

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center gap-2 text-sm">
        <Package className="text-primary h-4 w-4" />
        <span>{t("freeReturns")}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Shield className="text-primary h-4 w-4" />
        <span>{t("securePayment")}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Truck className="text-primary h-4 w-4" />
        <span>{t("fastDelivery")}</span>
      </div>
    </div>
  );
};

export default CartFeatures;
