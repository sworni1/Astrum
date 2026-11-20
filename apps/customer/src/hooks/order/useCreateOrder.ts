"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { CreateOrderDto, Order } from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";
import { useUser } from "@/hooks/user/useUser";
import { isOrderListKey } from "./orderListKey";

export type CreateOrderError = {
  message: string;
  status?: number;
};

export type CreateOrderTrigger = (
  data: Omit<CreateOrderDto, "userId">,
) => Promise<Order>;

export interface UseCreateOrderReturn {
  createOrderTrigger: CreateOrderTrigger;
  createOrderIsMutating: boolean;
  createOrderError: CreateOrderError | null;
}

export const useCreateOrder = (): UseCreateOrderReturn => {
  const { postItem } = useFetcher();
  const { mutate } = useSWRConfig();
  const { profileData: user } = useUser();

  const {
    trigger: _createOrderTrigger,
    isMutating: createOrderIsMutating,
    error: rawError,
  } = useSWRMutation<Order, CreateOrderError, string, CreateOrderDto>(
    `/orders`,
    postItem,
    {
      onSuccess: async () => {
        await mutate("/cart");

        await mutate(isOrderListKey);
      },
    },
  );

  const createOrderTrigger: CreateOrderTrigger = async (data) => {
    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    const orderData: CreateOrderDto = {
      ...data,
    };

    return _createOrderTrigger(orderData);
  };

  return {
    createOrderTrigger,
    createOrderIsMutating,
    createOrderError: rawError ?? null,
  };
};
