import { useTranslations } from "next-intl";
import type { Control } from "react-hook-form";
import type { CheckoutFormData } from "@/common/zodSchemes/checkout.scheme";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  FIELD,
  FIELD_LABEL,
  REQUIRED_MARK,
  TEXTAREA_CONTROL,
} from "@/features/pages/Checkout/lib/styles";

type Props = {
  control: Control<CheckoutFormData>;
};

const DeliveryAddressField = ({ control }: Props) => {
  const t = useTranslations("cart");

  return (
    <FormField
      control={control}
      name="deliveryAddress"
      render={({ field }) => (
        <FormItem className={FIELD}>
          <FormLabel className={FIELD_LABEL}>
            {t("deliveryAddress")}
            <span className={REQUIRED_MARK}>*</span>
          </FormLabel>
          <FormControl>
            <Textarea
              placeholder={t("fullAddressPlaceholder")}
              rows={3}
              className={TEXTAREA_CONTROL}
              name={field.name}
              ref={field.ref}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default DeliveryAddressField;
