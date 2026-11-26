import "dotenv/config";
import { PrismaClient } from "@astrum/db/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;
const poolSize = Number(process.env.DB_POOL_SIZE ?? 10);

const adapter = new PrismaPg({
  connectionString,
  max: Number.isFinite(poolSize) && poolSize > 0 ? poolSize : 10,
});
const prisma: PrismaClient = new PrismaClient({ adapter });

export { prisma };
