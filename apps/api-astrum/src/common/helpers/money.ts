import type { Prisma } from "@astrum/db/client";

export const toMoney = (value: Prisma.Decimal | number): number =>
  Number(value.toFixed(2));
