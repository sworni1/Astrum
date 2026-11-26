import { prisma } from "../../../lib/prisma";
import type { StaffRole, StaffRoleRow } from "../../common/types/staff.types";

export const readStaffRoleRow = async (
  role: StaffRole,
  userId: string,
): Promise<StaffRoleRow | null> => {
  if (role === "POINT_WORKER") {
    const row = await prisma.pointWorker.findUnique({
      where: { userId },
      select: { pickupPointId: true },
    });

    return row ? { role, pickupPointId: row.pickupPointId } : null;
  }

  const row = await prisma.courier.findUnique({
    where: { userId },
    select: { userId: true },
  });

  return row ? { role, pickupPointId: null } : null;
};
