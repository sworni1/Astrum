"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { useSWRConfig } from "swr";
import { showToast } from "../../common";
import type { CreateOrderItemDto } from "../../common/types/order.types";
import type { ProductCartProps } from "../../common/types/product.types";
import type { CheckoutFormData } from "../../common/zodSchemes/checkout.scheme";
import { useFetcher } from "../useFetcher";

type OrderErrorBody = {
  code?: string;
  message?: string;
};

const readErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<OrderErrorBody>(error)) {
    const message = error.response?.data?.message;

    if (message) {
      return message;
    }
  }

  return error instanceof Error
    ? error.message
    : "Failed to create order. Please try again.";
};

export const useCheckout = () => {
  const { postItem } = useFetcher();
  const { mutate } = useSWRConfig();
  const router = useRouter();

  const handleCheckout = useCallback(
    async (checkoutData: CheckoutFormData, cartItems: ProductCartProps[]) => {
      try {
        if (cartItems.length === 0) {
          throw new Error("No items selected for checkout");
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

        const orderData = {
          paymentMethod: checkoutData.paymentMethod,
          paymentDetails: checkoutData.paymentDetails || "Online payment",
          deliveryAddress: checkoutData.deliveryAddress,
          deliveryDate: localDeliveryDate.toISOString(),
          shippingMethodId: checkoutData.shippingMethodId,
          orderItems,
        };

        const response = await postItem("/orders", { arg: orderData });

        await Promise.all([mutate("/cart"), mutate("/orders")]);

        showToast({
          title: "Success!",
          type: "success",
          description: "Order placed successfully!",
        });

        router.push(`/orders/${response.id}`);

        return response;
      } catch (error) {
        // A refused order means the cart or the stock moved, so reload both
        // before the customer sees the message and tries again.
        await Promise.all([mutate("/cart"), mutate("/orders")]);

        showToast({
          title: "Error!",
          type: "error",
          description: readErrorMessage(error),
        });

        throw error;
      }
    },
    [postItem, mutate, router],
  );

  return useMemo(
    () => ({
      handleCheckout,
    }),
    [handleCheckout],
  );
};
