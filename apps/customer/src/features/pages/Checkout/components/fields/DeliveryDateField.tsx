import { CalendarIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Control } from "react-hook-form";
import type { CheckoutFormData } from "@/common/zodSchemes/checkout.scheme";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DATE_TRIGGER,
  FIELD,
  FIELD_LABEL,
  REQUIRED_MARK,
} from "@/features/pages/Checkout/lib/styles";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  control: Control<CheckoutFormData>;
};

/**
 * The delivery date stays a `Popover` over a `Calendar` at the mockup's control
 * geometry, never a native date input (spec 0024, AC-12).
 */
const DeliveryDateField = ({ control }: Props) => {
  const t = useTranslations("cart");
  const format = useFormatter();

  return (
    <FormField
      control={control}
      name="deliveryDate"
      render={({ field }) => (
        <FormItem className={FIELD}>
          <FormLabel className={FIELD_LABEL}>
            {t("deliveryDate")}
            <span className={REQUIRED_MARK}>*</span>
          </FormLabel>
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    DATE_TRIGGER,
                    !field.value && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {field.value ? (
                    format.dateTime(field.value, {
                      dateStyle: "long",
                      timeZone: browserTimeZone(),
                    })
                  ) : (
                    <span>{t("pickDeliveryDate")}</span>
                  )}
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto border bg-background p-0"
              align="start"
            >
              <Calendar
                mode="single"
                selected={field.value}
                onSelect={field.onChange}
                disabled={(date) =>
                  date < new Date() || date < new Date("1900-01-01")
                }
                className="rounded-md border-0"
              />
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default DeliveryDateField;
