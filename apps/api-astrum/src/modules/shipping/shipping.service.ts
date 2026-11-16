import type { Prisma } from "../../../generated/prisma/client";
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

/** The methods a customer may pick: active rows only, ordered by name (AC-4). */
export class ShippingService {
  async getActiveMethods(): Promise<ActiveShippingMethod[]> {
    return prisma.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: SHIPPING_METHOD_SELECT,
    });
  }

  /**
   * The list every customer reads, from Redis when a fresh copy exists. The
   * mapped body is what is cached, so a hit answers the same `price` numbers a
   * miss does (spec 0022, AC-6).
   */
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
