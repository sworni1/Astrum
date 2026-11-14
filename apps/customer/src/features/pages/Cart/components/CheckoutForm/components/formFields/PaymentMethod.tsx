"use client";

import { useTranslations } from "next-intl";
import type { Control } from "react-hook-form";
import {
  CHECKOUT_METHOD_KEYS,
  CHOOSABLE_PAYMENT_METHODS,
} from "@/common/helpers/paymentMethods";
import type { CheckoutFormData } from "@/common/zodSchemes/checkout.scheme";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  control: Control<CheckoutFormData>;
};

const PaymentMethodField = ({ control }: Props) => {
  const t = useTranslations("cart");

  return (
    <FormField
      control={control}
      name="paymentMethod"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("paymentMethod")}</FormLabel>
          <FormControl>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHOOSABLE_PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {t(CHECKOUT_METHOD_KEYS[method])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default PaymentMethodField;
