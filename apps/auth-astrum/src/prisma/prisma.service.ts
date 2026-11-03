import { Injectable } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const connectionString = process.env.DATABASE_URL as string;
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  cleandb() {
    return this.$transaction([this.user.deleteMany()]);
  }
}
