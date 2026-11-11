"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef } from "react";
import { useSWRConfig } from "swr";
import { showToast } from "@/common/helpers/showToast";
import type { CreateOrderItemDto } from "@/common/types/order.types";
import type { ProductCartProps } from "@/common/types/product.types";
import type { CheckoutFormData } from "@/common/zodSchemes/checkout.scheme";
import { useFetcher } from "@/hooks/useFetcher";
import { checkoutRefusalOf } from "./checkoutErrors";
import { createIdempotencyKey, isTerminalAnswer } from "./idempotency";

export const useCheckout = () => {
  const { postItem } = useFetcher();
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const t = useTranslations("cart");
  const idempotencyKey = useRef<string | null>(null);

  const handleCheckout = useCallback(
    async (checkoutData: CheckoutFormData, cartItems: ProductCartProps[]) => {
      try {
        if (cartItems.length === 0) {
          throw new Error(t("noItemsSelected"));
        }

        const orderItems: CreateOrderItemDto[] = cartItems.map((item) => ({
          productId: item.id,
          quantity: item.quantityInCart,
        }));

        // Set to noon local time so the date does not shift across timezones
        const deliveryDate = new Date(checkoutData.deliveryDate);
        const localDeliveryDate = new Date(
          deliveryDate.getFullYear(),
          deliveryDate.getMonth(),
          deliveryDate.getDate(),
          12,
          0,
          0,
          0,
        );

        const pickupPointId = checkoutData.pickupPointId || undefined;

        const orderData = {
          paymentMethod: checkoutData.paymentMethod,
          paymentDetails: checkoutData.paymentDetails || "Online payment",
          deliveryAddress: pickupPointId ? null : checkoutData.deliveryAddress,
          deliveryDate: localDeliveryDate.toISOString(),
          shippingMethodId: checkoutData.shippingMethodId,
          ...(pickupPointId ? { pickupPointId } : {}),
          orderItems,
        };

        const key = idempotencyKey.current ?? createIdempotencyKey();
        idempotencyKey.current = key;

        const response = await postItem("/orders", {
          arg: orderData,
          headers: { "Idempotency-Key": key },
        });

        idempotencyKey.current = null;

        await Promise.all([mutate("/cart"), mutate("/orders")]);

        showToast({
          title: t("orderPlaced"),
          type: "success",
        });

        router.push(`/orders/${response.id}`);

        return response;
      } catch (error) {
        if (isTerminalAnswer(error)) {
          idempotencyKey.current = null;
        }

        // A delivery method refusal belongs to the form: it names the code,
        // revalidates the list and shows one message, not two (AC-11).
        const refusal = checkoutRefusalOf(error);

        if (refusal) {
          throw refusal;
        }

        // A refused order means the cart or the stock moved, so reload both
        // before the customer sees the message and tries again.
        await Promise.all([mutate("/cart"), mutate("/orders")]);

        showToast({
          title: t("orderFailed"),
          type: "error",
        });

        throw error;
      }
    },
    [postItem, mutate, router, t],
  );

  return useMemo(
    () => ({
      handleCheckout,
    }),
    [handleCheckout],
  );
};
