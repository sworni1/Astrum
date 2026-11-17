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
  FormMessage,
} from "@/components/ui/form";
import {
  FIELD,
  RADIO_CARD,
  RADIO_CARD_CHECKED,
  RADIO_GROUP,
  RADIO_INPUT,
  RADIO_NAME,
  RADIO_TEXT,
} from "@/features/pages/Checkout/lib/styles";
import { cn } from "@/lib/utils";

type Props = {
  control: Control<CheckoutFormData>;
};

/**
 * The three payment methods as radio cards, the label of each taken from the
 * `cart` catalog (spec 0024, AC-11).
 */
const PaymentMethodCards = ({ control }: Props) => {
  const t = useTranslations("cart");

  return (
    <FormField
      control={control}
      name="paymentMethod"
      render={({ field }) => (
        <FormItem className={FIELD}>
          <FormControl>
            <div
              className={RADIO_GROUP}
              role="radiogroup"
              aria-label={t("paymentMethod")}
            >
              {CHOOSABLE_PAYMENT_METHODS.map((method) => {
                const checked = field.value === method;

                return (
                  <label
                    key={method}
                    className={cn(RADIO_CARD, checked && RADIO_CARD_CHECKED)}
                  >
                    <input
                      type="radio"
                      className={RADIO_INPUT}
                      name={field.name}
                      value={method}
                      checked={checked}
                      onChange={() => field.onChange(method)}
                      onBlur={field.onBlur}
                    />
                    <span className={RADIO_TEXT}>
                      <span className={RADIO_NAME}>
                        {t(CHECKOUT_METHOD_KEYS[method])}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default PaymentMethodCards;
