jest.mock("../../../../lib/prisma", () => ({
  prisma: { pickupPoint: { findMany: jest.fn() } },
}));

import { prisma } from "../../../../lib/prisma";
import { PickupService } from "../pickup.service";

const findMany = (
  prisma as unknown as { pickupPoint: { findMany: jest.Mock } }
).pickupPoint.findMany;

describe("PickupService.getActivePoints", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("читает только активные точки в порядке имени (AC-3)", async () => {
    findMany.mockResolvedValue([]);

    await new PickupService().getActivePoints();

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true },
    });
  });

  it("отдаёт точку тремя полями и не тянет switch и дату (AC-3)", async () => {
    findMany.mockResolvedValue([
      { id: "pp-1", name: "Central Pickup", address: "Tverskaya 12" },
    ]);

    const points = await new PickupService().getActivePoints();

    expect(points).toEqual([
      { id: "pp-1", name: "Central Pickup", address: "Tverskaya 12" },
    ]);
  });
});
