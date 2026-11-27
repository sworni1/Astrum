import type { ShippingMethod } from "@astrum/db/client";
import { toMoney } from "../../common/helpers/money";

type ShippingRow = Pick<
  ShippingMethod,
  "id" | "name" | "price" | "currency" | "isPickup"
>;

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
