import { randomUUID } from "node:crypto";
import { UserRole } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import { addRole } from "../../common/helpers/addRole";
import { logger } from "../../common/helpers/logger";
import { isUniqueViolation } from "../../common/helpers/prismaErrors";
import {
  BUSINESS_ID_PREFIX,
  OWNED_SHOP_SELECT,
} from "./constants/seller.constants";
import { readOwnedShop } from "./helpers/onboarding.helpers";

export type OnboardingResult = { isSeller: true; businessName: string };

export class SellerOnboardingService {
  async createShop(userId: string, name: string): Promise<OnboardingResult> {
    const existing = await readOwnedShop(userId);

    if (existing) {
      return { isSeller: true, businessName: existing.name };
    }

    try {
      const created = await prisma.business.create({
        data: {
          id: `${BUSINESS_ID_PREFIX}${randomUUID()}`,
          name,
          ownerUserId: userId,
        },
        select: OWNED_SHOP_SELECT,
      });

      await addRole(userId, UserRole.SELLER);

      logger.info({
        event: "seller.onboarding.completed",
        userId,
        businessId: created.id,
      });

      return { isSeller: true, businessName: created.name };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const winner = await readOwnedShop(userId);

        if (winner) {
          return { isSeller: true, businessName: winner.name };
        }
      }

      throw error;
    }
  }
}
