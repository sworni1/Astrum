import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";
import type { CheckoutFormData } from "@/common/zodSchemes/checkout.scheme";
import CheckoutCard from "@/features/pages/Checkout/components/CheckoutCard";
import PaymentMethodCards from "@/features/pages/Checkout/components/fields/PaymentMethodCards";

type Props = {
  form: UseFormReturn<CheckoutFormData>;
};

const PaymentSection = ({ form }: Props) => {
  const t = useTranslations("cart");

  return (
    <CheckoutCard
      title={t("paymentMethod")}
      icon={<CreditCard className="size-5" strokeWidth={1.75} />}
    >
      <PaymentMethodCards control={form.control} />
    </CheckoutCard>
  );
};

export default PaymentSection;
