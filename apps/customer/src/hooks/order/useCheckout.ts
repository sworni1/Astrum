"use client";

import { useCallback, useMemo } from "react";
import { showToast } from "../../common";
import { useFetcher } from "../useFetcher";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { CheckoutFormData } from "../../common/zodSchemes/checkout.scheme";
import { CreateOrderItemDto } from "../../common/types/order.types";
import { ProductCartProps } from "../../common/types/product.types";

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

        // Convert cart items to order items
        const orderItems: CreateOrderItemDto[] = cartItems.map((item) => ({
          productId: item.id,
          name: item.name,
          previewImage: item.previewImage,
          quantity: item.quantityInCart,
          price: item.price,
        }));

        // Prepare order data - convert Date to proper format for API
        // Create a new date at start of day in local timezone to avoid timezone conversion issues
        const deliveryDate = new Date(checkoutData.deliveryDate);
        const localDeliveryDate = new Date(
          deliveryDate.getFullYear(),
          deliveryDate.getMonth(),
          deliveryDate.getDate(),
          12, // Set to noon to avoid timezone issues
          0,
          0,
          0,
        );

        const orderData = {
          paymentMethod: checkoutData.paymentMethod,
          paymentDetails: checkoutData.paymentDetails || "Online payment",
          deliveryAddress: checkoutData.deliveryAddress,
          deliveryDate: localDeliveryDate.toISOString(), // Convert Date to ISO string
          shippingMethodId: checkoutData.shippingMethodId,
          orderItems: orderItems,
        };

        const response = await postItem("/orders", { arg: orderData });

        // Clear cart and refresh data
        await mutate("/cart");
        await mutate("/orders");

        showToast({
          title: "Success!",
          type: "success",
          description: "Order placed successfully!",
        });

        // Redirect to order details
        router.push(`/orders/${response.id}`);

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to create order. Please try again.";

        showToast({
          title: "Error!",
          type: "error",
          description: errorMessage,
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
