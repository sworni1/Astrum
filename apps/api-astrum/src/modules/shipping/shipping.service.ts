import type { Prisma } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import { getOrSet, listTtlSeconds } from "../../cache/cache";
import { cacheKeys } from "../../cache/cacheKeys";
import { toShippingMethodListJson } from "./shipping.mapper";

const SHIPPING_METHOD_SELECT = {
  id: true,
  name: true,
  price: true,
  currency: true,
  isPickup: true,
} as const;

export type ActiveShippingMethod = Prisma.ShippingMethodGetPayload<{
  select: typeof SHIPPING_METHOD_SELECT;
}>;

export class ShippingService {
  async getActiveMethods(): Promise<ActiveShippingMethod[]> {
    return prisma.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: SHIPPING_METHOD_SELECT,
    });
  }

  async getMethodListJson(): Promise<
    ReturnType<typeof toShippingMethodListJson>
  > {
    return await getOrSet({
      key: cacheKeys.shipping(),
      ttlSeconds: listTtlSeconds(),
      load: async () => toShippingMethodListJson(await this.getActiveMethods()),
    });
  }
}
