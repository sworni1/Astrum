import type { ShippingMethod } from "../../../generated/prisma/client";
import { toMoney } from "../../common/helpers/money";

type ShippingRow = Pick<
  ShippingMethod,
  "id" | "name" | "price" | "currency" | "isPickup"
>;

/** Each item is exactly `{ id, name, price, currency, isPickup }` (AC-4). */
export const toShippingMethodJson = (method: ShippingRow) => ({
  id: method.id,
  name: method.name,
  price: toMoney(method.price),
  currency: method.currency,
  isPickup: method.isPickup,
});

export const toShippingMethodListJson = (methods: ShippingRow[]) => ({
  methods: methods.map(toShippingMethodJson),
});
