import { randomUUID } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../common/helpers/logger";

const BUSINESS_ID_PREFIX = "biz_";

export type OnboardingResult = { isSeller: true; businessName: string };

type OwnedShop = { id: string; name: string };

const readOwnedShop = (userId: string): Promise<OwnedShop | null> =>
  prisma.business.findUnique({
    where: { ownerUserId: userId },
    select: { id: true, name: true },
  });

/**
 * Opens one shop for the account. The first call creates the row; a repeat and
 * a lost race both answer with the existing shop, so the unique index on
 * `ownerUserId` stays the single source of "one shop per account" (AC-7).
 */
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
        select: { id: true, name: true },
      });

      logger.info({
        event: "seller.onboarding.completed",
        userId,
        businessId: created.id,
      });

      return { isSeller: true, businessName: created.name };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const winner = await readOwnedShop(userId);

        if (winner) {
          return { isSeller: true, businessName: winner.name };
        }
      }

      throw error;
    }
  }
}
