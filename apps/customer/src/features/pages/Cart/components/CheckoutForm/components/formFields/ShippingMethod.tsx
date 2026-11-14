"use client";

import { useTranslations } from "next-intl";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  control: Control<CheckoutFormData>;
  methods: ShippingMethod[];
  isLoading: boolean;
  isBlocked: boolean;
  isUnavailable: boolean;
  pointsUnavailable: boolean;
  onMethodChange: (value: string) => void;
  onRetry: () => void;
};

const ShippingMethodField = ({
  control,
  methods,
  isLoading,
  isBlocked,
  isUnavailable,
  pointsUnavailable,
  onMethodChange,
  onRetry,
}: Props) => {
  const t = useTranslations("cart");

  return (
    <FormField
      control={control}
      name="shippingMethodId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("shippingMethod")}</FormLabel>
          <FormControl>
            <Select
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                onMethodChange(value);
              }}
              disabled={isBlocked}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoading ? t("shippingLoading") : t("selectShippingMethod")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {methods.map((method) => {
                  const pickupBlocked = method.isPickup && pointsUnavailable;

                  return (
                    <SelectItem
                      key={method.id}
                      value={method.id}
                      disabled={pickupBlocked}
                    >
                      <div className="flex flex-col">
                        <div className="font-medium">{method.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatMoney(
                            method.price,
                            toCurrency(method.currency),
                          )}
                        </div>
                        {pickupBlocked && (
                          <div className="text-sm text-destructive">
                            {t("pickupUnavailable")}
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FormControl>
          {isUnavailable && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-destructive">
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
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default ShippingMethodField;
