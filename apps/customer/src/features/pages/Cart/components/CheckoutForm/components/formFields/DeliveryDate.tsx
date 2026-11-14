"use client";

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
import { cn } from "@/lib/utils";

type Props = {
  control: Control<CheckoutFormData>;
};

const DeliveryDate = ({ control }: Props) => {
  const t = useTranslations("cart");
  const format = useFormatter();

  return (
    <FormField
      control={control}
      name="deliveryDate"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>{t("deliveryDate")}</FormLabel>
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !field.value && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value ? (
                    format.dateTime(field.value, { dateStyle: "long" })
                  ) : (
                    <span>{t("pickDeliveryDate")}</span>
                  )}
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 bg-background border"
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

export default DeliveryDate;
