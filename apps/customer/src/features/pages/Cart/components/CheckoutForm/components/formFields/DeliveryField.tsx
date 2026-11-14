"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Control } from "react-hook-form";
import type { PickupPoint } from "@/common/types/order.types";
import type { CheckoutFormData } from "@/common/zodSchemes/checkout.scheme";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import PickupPointField from "./PickupPointField";

type Props = {
  control: Control<CheckoutFormData>;
  isPickup: boolean;
  points: PickupPoint[];
  pointsLoading: boolean;
  pointsFailed: boolean;
  onPointsRetry: () => void;
};

/**
 * One delivery block with one of two fields: the address a courier needs, or
 * the point a collection happens at. The chosen method decides which, and
 * `isPickup` false (also the state before any method is picked) keeps the
 * address (spec 0013, AC-6).
 */
const DeliveryField = ({
  control,
  isPickup,
  points,
  pointsLoading,
  pointsFailed,
  onPointsRetry,
}: Props) => {
  const t = useTranslations("cart");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5" />
        <FormLabel className="text-base font-medium">
          {isPickup ? t("pickupPoint") : t("deliveryAddress")}
        </FormLabel>
      </div>

      {isPickup ? (
        <PickupPointField
          control={control}
          points={points}
          isLoading={pointsLoading}
          hasFailed={pointsFailed}
          onRetry={onPointsRetry}
        />
      ) : (
        <FormField
          control={control}
          name="deliveryAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("fullAddress")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("fullAddressPlaceholder")}
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
};

export default DeliveryField;
