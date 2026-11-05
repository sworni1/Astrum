import type { PrismaClient } from "../generated/prisma/client";
import { expiresAtFrom, hashToken, mintRawToken } from "./token";

export type MintedToken = {
  rawToken: string;
  expiresAt: Date;
};

/**
 * One transaction writes the new row and kills every other unused row of the
 * user, which is what makes the newest letter the only working one. The raw
 * token leaves this function in memory only: the database keeps its sha256.
 */
export const mintConfirmationToken = async (
  prisma: PrismaClient,
  { userId, email }: { userId: string; email: string },
  now: Date = new Date(),
): Promise<MintedToken> => {
  const rawToken = mintRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = expiresAtFrom(now);

  await prisma.$transaction([
    prisma.emailToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.emailToken.create({
      data: { userId, email, tokenHash, expiresAt },
    }),
  ]);

  return { rawToken, expiresAt };
};
