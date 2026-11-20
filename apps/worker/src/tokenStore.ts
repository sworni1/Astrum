import type { PrismaClient } from "@astrum/db/client";
import { expiresAtFrom, hashToken, mintRawToken } from "./token";

export type MintedToken = {
  rawToken: string;
  expiresAt: Date;
};

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
