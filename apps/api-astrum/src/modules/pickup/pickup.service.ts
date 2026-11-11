import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";

const PICKUP_POINT_SELECT = {
  id: true,
  name: true,
  address: true,
} as const;

export type ActivePickupPoint = Prisma.PickupPointGetPayload<{
  select: typeof PICKUP_POINT_SELECT;
}>;

/** The collection points a customer may pick: active rows only, by name (AC-3). */
export class PickupService {
  async getActivePoints(): Promise<ActivePickupPoint[]> {
    return prisma.pickupPoint.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: PICKUP_POINT_SELECT,
    });
  }
}
