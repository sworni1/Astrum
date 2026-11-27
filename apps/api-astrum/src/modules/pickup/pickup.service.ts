import type { Prisma } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import { PICKUP_POINT_SELECT } from "./constants/pickup.constants";

export type ActivePickupPoint = Prisma.PickupPointGetPayload<{
  select: typeof PICKUP_POINT_SELECT;
}>;

export class PickupService {
  async getActivePoints(): Promise<ActivePickupPoint[]> {
    return prisma.pickupPoint.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: PICKUP_POINT_SELECT,
    });
  }
}
