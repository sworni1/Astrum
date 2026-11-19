import { Injectable } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@astrum/db/client";

const poolSize = Number(process.env.DB_POOL_SIZE ?? 10);

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const connectionString = process.env.DATABASE_URL as string;
    const adapter = new PrismaPg({
      connectionString,
      max: Number.isFinite(poolSize) && poolSize > 0 ? poolSize : 10,
    });
    super({ adapter });
  }

  cleandb(): Promise<{ count: number }[]> {
    return this.$transaction([this.user.deleteMany()]);
  }
}
