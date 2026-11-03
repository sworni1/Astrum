import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { PrismaClient } from "../generated/prisma/client";

if (!process.env.DATABASE_URL) {
  dotenv.config({
    path: fileURLToPath(new URL("../.env", import.meta.url)),
  });
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
