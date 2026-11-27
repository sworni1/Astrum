import type { OrderListStatus } from "@/common/types/order.types";

const ORDER_LIST_KEY = "/orders";

export type OrderListFilters = { status?: OrderListStatus; q?: string };

export const orderListKey = ({ status, q }: OrderListFilters = {}): string => {
  const params = new URLSearchParams();

  if (status !== undefined && status !== "ALL") {
    params.set("status", status);
  }

  const query = q?.trim() ?? "";

  if (query !== "") {
    params.set("q", query);
  }

  const search = params.toString();

  return search === "" ? ORDER_LIST_KEY : `${ORDER_LIST_KEY}?${search}`;
};

export const isOrderListKey = (key: unknown): boolean =>
  typeof key === "string" &&
  (key === ORDER_LIST_KEY || key.startsWith(`${ORDER_LIST_KEY}?`));
