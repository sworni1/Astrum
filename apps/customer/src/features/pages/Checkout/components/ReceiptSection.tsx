import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";
import type { CheckoutFormData } from "@/common/zodSchemes/checkout.scheme";
import CheckoutCard from "@/features/pages/Checkout/components/CheckoutCard";
import DeliveryAddressField from "@/features/pages/Checkout/components/fields/DeliveryAddressField";
import DeliveryDateField from "@/features/pages/Checkout/components/fields/DeliveryDateField";
import PickupPointField from "@/features/pages/Checkout/components/fields/PickupPointField";
import ShippingMethodCards from "@/features/pages/Checkout/components/fields/ShippingMethodCards";
import type { CheckoutFormState } from "@/features/pages/Checkout/lib/checkoutState";

type Props = {
  form: UseFormReturn<CheckoutFormData>;
  state: CheckoutFormState;
};

/**
 * The second card: where it goes, how, and when. The pickup branch follows the
 * chosen method, so no leftover address can pair with a pickup method
 * (spec 0024, AC-8, AC-10).
 */
const ReceiptSection = ({ form, state }: Props) => {
  const t = useTranslations("cart");

  return (
    <CheckoutCard
      title={t("receiptTitle")}
      icon={<MapPin className="size-5" strokeWidth={1.75} />}
    >
      {state.isPickup ? (
        <PickupPointField
          control={form.control}
          points={state.points}
          isLoading={state.pointsLoading}
          hasFailed={state.pointsFailed}
          onRetry={state.retryPoints}
        />
      ) : (
        <DeliveryAddressField control={form.control} />
      )}

      <ShippingMethodCards
        control={form.control}
        methods={state.methods}
        isLoading={state.methodsLoading}
        isUnavailable={state.methodsUnavailable}
        pointsUnavailable={state.pointsUnavailable}
        onRetry={state.retryMethods}
      />

      <DeliveryDateField control={form.control} />
    </CheckoutCard>
  );
};

export default ReceiptSection;
