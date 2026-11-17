import { useTranslations } from "next-intl";
import type { Control } from "react-hook-form";
import type { PickupPoint } from "@/common/types/order.types";
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
import {
  CHECKOUT_NOTE,
  FIELD,
  FIELD_LABEL,
  REQUIRED_MARK,
  SELECT_CONTROL,
} from "@/features/pages/Checkout/lib/styles";

type Props = {
  control: Control<CheckoutFormData>;
  points: PickupPoint[];
  isLoading: boolean;
  hasFailed: boolean;
  onRetry: () => void;
};

/**
 * The point the parcel is collected from: one select over the active points, its
 * loading and failure states, the refusal a closed point produces, and the
 * chosen point's address under the trigger (spec 0013, AC-6; spec 0024, AC-12).
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
      render={({ field }) => {
        const chosen = points.find((point) => point.id === field.value);

        return (
          <FormItem className={FIELD}>
            <FormLabel className={FIELD_LABEL}>
              {t("pickupPoint")}
              <span className={REQUIRED_MARK}>*</span>
            </FormLabel>
            <FormControl>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isLoading || hasFailed}
              >
                <SelectTrigger className={SELECT_CONTROL}>
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

            {chosen && !hasFailed ? (
              <p className={CHECKOUT_NOTE}>{chosen.address}</p>
            ) : null}

            {hasFailed ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-destructive-soft">
                  {t("pickupLoadFailed")}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                >
                  {t("pickupRetry")}
                </Button>
              </div>
            ) : null}

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};

export default PickupPointField;
