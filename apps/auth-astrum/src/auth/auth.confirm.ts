import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { TOKEN_HASH_ALGORITHM } from "./constants/auth.constants";
import type { ConfirmOutcome } from "./types/auth.types";

export const confirmEmailToken = async (
  prisma: PrismaService,
  rawToken: string | undefined,
): Promise<ConfirmOutcome> => {
  const token = rawToken?.trim();

  if (!token) {
    return "invalid";
  }

  const tokenHash = createHash(TOKEN_HASH_ALGORITHM)
    .update(token)
    .digest("hex");

  const row = await prisma.emailToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      email: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { email: true, status: true } },
    },
  });

  if (!row || row.email !== row.user.email) {
    return "invalid";
  }

  if (row.usedAt) {
    return row.user.status === "ACTIVE" ? "ok" : "used";
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    return "expired";
  }

  await prisma.$transaction([
    prisma.emailToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: { status: "ACTIVE" },
    }),
  ]);

  return "ok";
};
