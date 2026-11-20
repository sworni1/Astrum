"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef } from "react";
import { useSWRConfig } from "swr";
import { clearCheckoutSelection } from "@/common/helpers/checkoutSelection";
import { showToast } from "@/common/helpers/showToast";
import type { CreateOrderItemDto } from "@/common/types/order.types";
import type { ProductCartProps } from "@/common/types/product.types";
import type { CheckoutFormData } from "@/common/zodSchemes/checkout.scheme";
import { useFetcher } from "@/hooks/useFetcher";
import { checkoutRefusalOf } from "./checkoutErrors";
import { createIdempotencyKey, isTerminalAnswer } from "./idempotency";
import { isOrderListKey } from "./orderListKey";

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

        await Promise.all([mutate("/cart"), mutate(isOrderListKey)]);

        clearCheckoutSelection();

        showToast({
          title: t("orderPlaced"),
          type: "success",
        });

        router.replace(`/orders/${response.id}`);

        return response;
      } catch (error) {
        if (isTerminalAnswer(error)) {
          idempotencyKey.current = null;
        }

        const refusal = checkoutRefusalOf(error);

        if (refusal) {
          throw refusal;
        }

        await Promise.all([mutate("/cart"), mutate(isOrderListKey)]);

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
