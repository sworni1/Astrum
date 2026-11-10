import type { Prisma } from "../../../generated/prisma/client";

/**
 * Money reaches JSON as a number with at most two decimals. Every handler that
 * returns an amount maps it through this helper, so a `Decimal` never reaches
 * the client as a string and no mapper keeps its own copy (spec 0009, AC-7).
 */
export const toMoney = (value: Prisma.Decimal | number): number =>
  Number(value.toFixed(2));
