import { useLocale, useTranslations } from "next-intl";
import type { Control } from "react-hook-form";
import { formatMoney, toCurrency } from "@/common/helpers/money";
import type { ShippingMethod } from "@/common/types/order.types";
import type { CheckoutFormData } from "@/common/zodSchemes/checkout.scheme";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FIELD,
  FIELD_LABEL,
  RADIO_CARD,
  RADIO_CARD_CHECKED,
  RADIO_CARD_DISABLED,
  RADIO_GROUP,
  RADIO_INPUT,
  RADIO_NAME,
  RADIO_NOTE,
  RADIO_PRICE,
  RADIO_TEXT,
  REQUIRED_MARK,
} from "@/features/pages/Checkout/lib/styles";
import { cn } from "@/lib/utils";

type Props = {
  control: Control<CheckoutFormData>;
  methods: ShippingMethod[];
  isLoading: boolean;
  isUnavailable: boolean;
  pointsUnavailable: boolean;
  onRetry: () => void;
};

const ShippingMethodCards = ({
  control,
  methods,
  isLoading,
  isUnavailable,
  pointsUnavailable,
  onRetry,
}: Props) => {
  const t = useTranslations("cart");
  const locale = useLocale();

  return (
    <FormField
      control={control}
      name="shippingMethodId"
      render={({ field }) => (
        <FormItem className={FIELD}>
          <FormLabel className={FIELD_LABEL}>
            {t("shippingMethod")}
            <span className={REQUIRED_MARK}>*</span>
          </FormLabel>

          {isLoading ? (
            <div className={RADIO_GROUP} aria-hidden="true">
              <Skeleton className="h-[52px] rounded-lg" />
              <Skeleton className="h-[52px] rounded-lg" />
            </div>
          ) : (
            <FormControl>
              <div className={RADIO_GROUP} role="radiogroup">
                {methods.map((method) => {
                  const blocked = method.isPickup && pointsUnavailable;
                  const checked = field.value === method.id;

                  return (
                    <label
                      key={method.id}
                      className={cn(
                        RADIO_CARD,
                        checked && RADIO_CARD_CHECKED,
                        blocked && RADIO_CARD_DISABLED,
                      )}
                    >
                      <input
                        type="radio"
                        className={RADIO_INPUT}
                        name={field.name}
                        value={method.id}
                        checked={checked}
                        disabled={blocked}
                        onChange={() => field.onChange(method.id)}
                        onBlur={field.onBlur}
                      />
                      <span className={RADIO_TEXT}>
                        <span className={RADIO_NAME}>{method.name}</span>
                        {blocked ? (
                          <span className={RADIO_NOTE}>
                            {t("pickupUnavailable")}
                          </span>
                        ) : null}
                      </span>
                      <span className={RADIO_PRICE}>
                        {formatMoney(
                          method.price,
                          toCurrency(method.currency), locale,
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </FormControl>
          )}

          {isUnavailable ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-destructive-soft">
                {t("shippingUnavailable")}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
              >
                {t("shippingRetry")}
              </Button>
            </div>
          ) : null}

          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default ShippingMethodCards;
