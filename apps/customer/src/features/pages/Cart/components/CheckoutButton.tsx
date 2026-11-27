"use client";

import { CreditCard } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  selectedCount: number;
  guest: boolean;
};

const CheckoutButton = ({ selectedCount, guest }: Props) => {
  const t = useTranslations("cart");

  if (selectedCount === 0) {
    return (
      <Button className="w-full" disabled>
        <CreditCard className="mr-2 h-4 w-4" />
        {t("selectToCheckout")}
      </Button>
    );
  }

  const target = guest ? "/auth/signin?next=/checkout" : "/checkout";

  return (
    <Button asChild className="w-full">
      <Link href={target}>
        <CreditCard className="mr-2 h-4 w-4" />
        {t("proceed", { count: selectedCount })}
      </Link>
    </Button>
  );
};

export default CheckoutButton;
