"use client";

import { CreditCard } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  selectedCount: number;
};

/**
 * Only a link to `/checkout`: the selection is already in the handoff key, so
 * the button writes nothing and one place owns that key (spec 0024, AC-2).
 */
const CheckoutButton = ({ selectedCount }: Props) => {
  const t = useTranslations("cart");

  if (selectedCount === 0) {
    return (
      <Button className="w-full" disabled>
        <CreditCard className="mr-2 h-4 w-4" />
        {t("selectToCheckout")}
      </Button>
    );
  }

  return (
    <Button asChild className="w-full">
      <Link href="/checkout">
        <CreditCard className="mr-2 h-4 w-4" />
        {t("proceed", { count: selectedCount })}
      </Link>
    </Button>
  );
};

export default CheckoutButton;
