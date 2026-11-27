import type { UserRole } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";

export const addRole = async (
  userId: string,
  role: UserRole,
): Promise<void> => {
  await prisma.user.updateMany({
    where: { id: userId, NOT: { roles: { has: role } } },
    data: { roles: { push: role } },
  });
};
