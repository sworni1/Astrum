"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  isSubmitting: boolean;
  disabled: boolean;
};

const SubmitButton = ({ isSubmitting, disabled }: Props) => {
  const t = useTranslations("cart");

  return (
    <Button
      type="submit"
      className="w-full"
      disabled={disabled || isSubmitting}
    >
      {isSubmitting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t("placingOrder")}
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          {t("placeOrder")}
        </>
      )}
    </Button>
  );
};

export default SubmitButton;
