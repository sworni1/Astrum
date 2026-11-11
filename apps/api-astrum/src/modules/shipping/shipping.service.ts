import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";

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
}
