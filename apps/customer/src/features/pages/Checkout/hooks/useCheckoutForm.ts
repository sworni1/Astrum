"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
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
import type { CheckoutFormState } from "@/features/pages/Checkout/lib/checkoutState";
import { checkoutHint } from "@/features/pages/Checkout/lib/hints";
import { selectionSubtotal } from "@/features/pages/Checkout/lib/reconcileLines";
import { refusalReaction } from "@/hooks/order/checkoutErrors";
import { useCheckout } from "@/hooks/order/useCheckout";
import { usePickupPoints } from "@/hooks/pickup/usePickupPoints";
import { useShippingMethods } from "@/hooks/shipping/useShippingMethods";

/**
 * The form, the two lists and the submit in one place (spec 0024, AC-8, AC-14,
 * AC-15). The pickup kind is derived from the chosen method, never held in state,
 * so a reload cannot pair a pickup method with a leftover address.
 */
export const useCheckoutForm = (lines: ProductCartProps[]) => {
  const { handleCheckout } = useCheckout();
  const shipping = useShippingMethods();
  const pickup = usePickupPoints();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("cart");
  const validation = useTranslations("validation");

  // The schema needs the delivery kind, which is only known from the chosen
  // method after the form exists, so the resolver reads the latest value (AC-8).
  const isPickupRef = useRef(false);

  const form = useForm<CheckoutFormData>({
    resolver: (values, context, options) =>
      zodResolver(createCheckoutFormSchema(validation, isPickupRef.current))(
        values,
        context,
        options,
      ),
    defaultValues: {
      deliveryAddress: "",
      pickupPointId: "",
      deliveryDate: undefined,
      shippingMethodId: "",
      paymentMethod: PaymentMethod.ONLINE_CARD,
    },
    mode: "onChange",
  });

  const methods = shipping.methods;
  const points = pickup.points;
  const shippingMethodId = form.watch("shippingMethodId");
  const pickupPointId = form.watch("pickupPointId");
  const deliveryAddress = form.watch("deliveryAddress");
  const deliveryDate = form.watch("deliveryDate");

  const selectedMethod = methods.find(
    (method) => method.id === shippingMethodId,
  );
  const isPickup = selectedMethod?.isPickup ?? false;
  isPickupRef.current = isPickup;

  const methodsUnavailable =
    shipping.error !== null || (!shipping.isLoading && methods.length === 0);
  const pointsUnavailable =
    !pickup.isLoading && (pickup.error !== null || points.length === 0);
  const selectedPoint = points.find((point) => point.id === pickupPointId);
  const currency = toCurrency(
    selectedMethod?.currency ?? methods[0]?.currency ?? Currency.RUB,
  );
  const subtotal = selectionSubtotal(lines);
  const shippingPrice = selectedMethod?.price ?? 0;

  const hint = checkoutHint({
    methodsLoading: shipping.isLoading,
    methodsUnavailable,
    isPickup,
    shippingMethodId,
    pickupPointId,
    deliveryAddress,
    deliveryDate,
    pointsUnavailable,
  });

  const retryMethods = () => {
    void shipping.mutate();
  };

  const retryPoints = () => {
    void pickup.mutate();
  };

  const submit = form.handleSubmit(async (data) => {
    setIsSubmitting(true);

    try {
      await handleCheckout(data, lines);
    } catch (error) {
      const reaction = refusalReaction(error);

      if (!reaction) {
        return;
      }

      if (reaction.resetMethod) {
        await shipping.mutate();
        form.setValue("shippingMethodId", "");
      }

      if (reaction.resetPoint) {
        await pickup.mutate();
        form.setValue("pickupPointId", "");
      }

      showToast({ title: t(reaction.key), type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  });

  const state: CheckoutFormState = {
    methods,
    methodsLoading: shipping.isLoading,
    methodsUnavailable,
    points,
    pointsLoading: pickup.isLoading,
    pointsFailed: pickup.error !== null,
    pointsUnavailable,
    isPickup,
    shippingMethodId,
    pickupPointId,
    selectedMethod,
    selectedPoint,
    currency,
    subtotal,
    shippingPrice,
    total: subtotal + shippingPrice,
    hint,
    isSubmitting,
    retryMethods,
    retryPoints,
  };

  return { form, state, submit };
};
