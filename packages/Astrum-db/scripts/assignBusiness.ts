import { randomUUID } from "node:crypto";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/index";

const BUSINESS_ID_PREFIX = "biz_";

class Refusal extends Error {}

const pickBusiness = async (tx: Prisma.TransactionClient) => {
  const withProducts = await tx.business.findFirst({
    where: { ownerUserId: null, products: { some: {} } },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  if (withProducts) {
    return withProducts.id;
  }

  const anyFree = await tx.business.findFirst({
    where: { ownerUserId: null },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  return anyFree?.id ?? null;
};

const assign = async (email: string) =>
  prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      throw new Refusal(`No account uses the address ${email}.`);
    }

    const owned = await tx.business.findUnique({
      where: { ownerUserId: user.id },
      select: { id: true },
    });

    if (owned) {
      throw new Refusal(`${email} already owns business ${owned.id}.`);
    }

    const free = await pickBusiness(tx);
    const businessId = free ?? `${BUSINESS_ID_PREFIX}${randomUUID()}`;

    if (!free) {
      await tx.business.create({ data: { id: businessId } });
    }

    await tx.business.update({
      where: { id: businessId },
      data: { ownerUserId: user.id },
    });

    const products = await tx.product.count({ where: { businessId } });
    const remaining = await tx.business.count({ where: { ownerUserId: null } });

    return { businessId, products, remaining };
  });

const main = async (): Promise<void> => {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: pnpm db:assign-business <email>");
    process.exitCode = 1;
    return;
  }

  try {
    const { businessId, products, remaining } = await assign(email);

    console.log(
      `Business ${businessId} now belongs to ${email}: ${products} product(s), ${remaining} unassigned business(es) left.`,
    );
  } catch (error) {
    if (error instanceof Refusal) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

await main();
