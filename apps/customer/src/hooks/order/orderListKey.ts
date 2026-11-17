import type { OrderListStatus } from "@/common/types/order.types";

const ORDER_LIST_KEY = "/orders";

/** The two filters the screen sends; an absent or `ALL` status means neither. */
export type OrderListFilters = { status?: OrderListStatus; q?: string };

/**
 * The request key of the list read. Both filters empty gives the bare `/orders`,
 * so the Navbar shares one cache entry with an unfiltered screen (spec 0025,
 * AC-16).
 */
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

/**
 * Matches every filtered list key and never `/orders/<id>`, so a cancel
 * refreshes the list and its counts without touching the detail entry
 * (spec 0025, AC-16).
 */
export const isOrderListKey = (key: unknown): boolean =>
  typeof key === "string" &&
  (key === ORDER_LIST_KEY || key.startsWith(`${ORDER_LIST_KEY}?`));
