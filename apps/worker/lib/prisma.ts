import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;
const poolSize = Number(process.env.DB_POOL_SIZE ?? 10);

const adapter = new PrismaPg({
  connectionString,
  max: Number.isFinite(poolSize) && poolSize > 0 ? poolSize : 10,
});
const prisma = new PrismaClient({ adapter });

export { prisma };
