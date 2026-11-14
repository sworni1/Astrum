"use client";

import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  selectedCount: number;
  onCheckout: () => void;
};

const CheckoutButton = ({ selectedCount, onCheckout }: Props) => {
  const t = useTranslations("cart");

  return (
    <Button
      className="w-full"
      onClick={onCheckout}
      disabled={selectedCount === 0}
    >
      <CreditCard className="mr-2 h-4 w-4" />
      {selectedCount === 0
        ? t("selectToCheckout")
        : t("proceed", { count: selectedCount })}
    </Button>
  );
};

export default CheckoutButton;
