import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { AppModule } from "./../src/app.module";

describe("HealthController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (!app) return;

    await app.get(PrismaService).$disconnect();
    await app.close();
  });

  it("answers 200 on GET /health while the database is reachable", () => {
    return request(app.getHttpServer()).get("/health").expect(200);
  });
});
