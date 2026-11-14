"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toCurrency } from "@/common/helpers/money";
import { showToast } from "@/common/helpers/showToast";
import { PaymentMethod } from "@/common/types/order.types";
import type { ProductCartProps } from "@/common/types/product.types";
import { Currency } from "@/common/types/product.types";
import {
  type CheckoutFormData,
  createCheckoutFormSchema,
} from "@/common/zodSchemes/checkout.scheme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { refusalReaction } from "@/hooks/order/checkoutErrors";
import { useCheckout } from "@/hooks/order/useCheckout";
import { usePickupPoints } from "@/hooks/pickup/usePickupPoints";
import { useShippingMethods } from "@/hooks/shipping/useShippingMethods";
import DeliveryDate from "./components/formFields/DeliveryDate";
import DeliveryField from "./components/formFields/DeliveryField";
import PaymentMethodField from "./components/formFields/PaymentMethod";
import ShippingMethodField from "./components/formFields/ShippingMethod";
import OrderSummary from "./components/OrderSummary";
import SelectedItemsSummary from "./components/SelectedItemsSummary";
import SubmitButton from "./components/SubmitButton";

type Props = {
  cartItems: ProductCartProps[];
  subtotal: number;
};

const CheckoutForm = ({ cartItems, subtotal }: Props) => {
  const { handleCheckout } = useCheckout();
  const {
    methods,
    isLoading: methodsLoading,
    error: methodsError,
    mutate: mutateMethods,
  } = useShippingMethods();
  const {
    points,
    isLoading: pointsLoading,
    error: pointsError,
    mutate: mutatePoints,
  } = usePickupPoints();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickup, setIsPickup] = useState(false);
  const t = useTranslations("cart");
  const validation = useTranslations("validation");

  const schema = useMemo(
    () => createCheckoutFormSchema(validation, isPickup),
    [validation, isPickup],
  );

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      deliveryAddress: "",
      pickupPointId: "",
      deliveryDate: undefined,
      shippingMethodId: "",
      paymentMethod: PaymentMethod.ONLINE_CARD,
    },
    mode: "onChange",
  });

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isValid },
  } = form;

  const selectedShippingMethodId = watch("shippingMethodId");
  const pickupPointId = watch("pickupPointId");

  const methodsUnavailable =
    methodsError !== null || (!methodsLoading && methods.length === 0);
  const methodsBlocked = methodsLoading || methodsUnavailable;

  const pointsUnavailable = !pointsLoading && points.length === 0;
  const pointsFailed = pointsError !== null;

  const selectedMethod = methods.find(
    (method) => method.id === selectedShippingMethodId,
  );
  const currency = toCurrency(
    selectedMethod?.currency ?? methods[0]?.currency ?? Currency.RUB,
  );
  const shippingPrice = selectedMethod?.price ?? 0;
  const total = subtotal + shippingPrice;
  const pickupWithoutPoint = isPickup && pickupPointId === "";

  const onSubmit = async (data: CheckoutFormData) => {
    setIsSubmitting(true);
    try {
      await handleCheckout(data, cartItems);
    } catch (error) {
      const reaction = refusalReaction(error);

      if (!reaction) {
        return;
      }

      if (reaction.resetMethod) {
        await mutateMethods();
        setValue("shippingMethodId", "");
        setIsPickup(false);
      }

      if (reaction.resetPoint) {
        await mutatePoints();
        setValue("pickupPointId", "");
      }

      showToast({ title: t(reaction.key), type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {t("checkoutTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SelectedItemsSummary items={cartItems} currency={currency} />

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <DeliveryField
              control={control}
              isPickup={isPickup}
              points={points}
              pointsLoading={pointsLoading}
              pointsFailed={pointsFailed}
              onPointsRetry={() => {
                void mutatePoints();
              }}
            />

            <ShippingMethodField
              control={control}
              methods={methods}
              isLoading={methodsLoading}
              isBlocked={methodsBlocked}
              isUnavailable={methodsUnavailable}
              pointsUnavailable={pointsUnavailable}
              onMethodChange={(value) => {
                setIsPickup(
                  methods.find((method) => method.id === value)?.isPickup ??
                    false,
                );
              }}
              onRetry={() => {
                void mutateMethods();
              }}
            />

            <DeliveryDate control={control} />

            <PaymentMethodField control={control} />

            {methods.length > 0 && (
              <OrderSummary
                subtotal={subtotal}
                shippingPrice={shippingPrice}
                total={total}
                currency={currency}
              />
            )}

            <SubmitButton
              isSubmitting={isSubmitting}
              disabled={
                !isValid ||
                methodsBlocked ||
                selectedShippingMethodId === "" ||
                pickupWithoutPoint
              }
            />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default CheckoutForm;
