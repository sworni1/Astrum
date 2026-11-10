import type { ShippingMethod } from "../../../generated/prisma/client";
import { toMoney } from "../../common/helpers/money";

type ShippingRow = Pick<ShippingMethod, "id" | "name" | "price" | "currency">;

/** Each item is exactly `{ id, name, price, currency }` (AC-4, AC-7). */
export const toShippingMethodJson = (method: ShippingRow) => ({
  id: method.id,
  name: method.name,
  price: toMoney(method.price),
  currency: method.currency,
});

export const toShippingMethodListJson = (methods: ShippingRow[]) => ({
  methods: methods.map(toShippingMethodJson),
});
