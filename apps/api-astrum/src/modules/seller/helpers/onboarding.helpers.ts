import { prisma } from "../../../../lib/prisma";
import { OWNED_SHOP_SELECT } from "../constants/seller.constants";

export type OwnedShop = { id: string; name: string };

export const readOwnedShop = (userId: string): Promise<OwnedShop | null> =>
  prisma.business.findUnique({
    where: { ownerUserId: userId },
    select: OWNED_SHOP_SELECT,
  });
