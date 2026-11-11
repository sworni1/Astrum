"use client";

import { useTranslations } from "next-intl";
import type { Control } from "react-hook-form";
import type { PickupPoint } from "@/common/types/order.types";
import type { CheckoutFormData } from "@/common/zodSchemes/checkout.scheme";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
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
  points: PickupPoint[];
  isLoading: boolean;
  hasFailed: boolean;
  onRetry: () => void;
};

/**
 * The point the parcel is collected from: one select over the active points,
 * its loading and failure states, and the refusal a closed point produces
 * (spec 0013, AC-6).
 */
const PickupPointField = ({
  control,
  points,
  isLoading,
  hasFailed,
  onRetry,
}: Props) => {
  const t = useTranslations("cart");

  return (
    <FormField
      control={control}
      name="pickupPointId"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={isLoading || hasFailed}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoading ? t("pickupLoading") : t("pickupSelect")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {points.map((point) => (
                  <SelectItem key={point.id} value={point.id}>
                    <div className="flex flex-col">
                      <div className="font-medium">{point.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {point.address}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          {hasFailed && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-destructive">
                {t("pickupLoadFailed")}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                {t("pickupRetry")}
              </Button>
            </div>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default PickupPointField;
