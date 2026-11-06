import {
  type INestApplication,
  RequestMethod,
  ValidationPipe,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { prisma } from "../../api-astrum/lib/prisma";
import apiApp from "../../api-astrum/src/app";
import { AppModule as AuthAppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

jest.setTimeout(30000);

const birthDate = (yearsAgo: number) => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - yearsAgo);

  return date.toISOString();
};

describe("Auth -> api-astrum (e2e)", () => {
  let authApp: INestApplication;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required to run integration tests");
    }

    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-jwt-secret";
    }

    if (!process.env.AUTH_SERVICE_URL) {
      process.env.AUTH_SERVICE_URL = "http://localhost:4580";
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthAppModule],
    }).compile();

    authApp = moduleFixture.createNestApplication();
    authApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
      }),
    );
    authApp.setGlobalPrefix("/api", {
      exclude: [{ path: "health", method: RequestMethod.GET }],
    });
    await authApp.init();
  });

  afterAll(async () => {
    if (authApp) {
      await authApp.get(PrismaService).$disconnect();
      await authApp.close();
    }

    await prisma.$disconnect();
  });

  it("returns 401 when __auth cookie is missing", async () => {
    await request(apiApp).get("/api/users/me").expect(401);
  });

  it("authenticates in auth-astrum and accesses protected endpoints in api-astrum", async () => {
    const email = `test_${Date.now()}@example.com`;
    const password = "qwertyuiop";
    const gender = "Male";
    const dateOfBirth = "2000-01-01T00:00:00.000Z";

    await request(authApp.getHttpServer())
      .post("/api/auth/register")
      .send({
        email,
        password,
        gender,
        dateOfBirth,
        nickName: "TestUser",
      })
      .expect(200);

    const signinResponse = await request(authApp.getHttpServer())
      .post("/api/auth/signin")
      .send({
        email,
        password,
      })
      .expect(200);

    const token = signinResponse.body?.token;
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);

    const cookie = `__auth=${token}`;

    const userResponse = await request(apiApp)
      .get("/api/users/me")
      .set("Cookie", cookie)
      .expect(200);

    expect(userResponse.body?.email).toBe(email);

    const wishlistResponse = await request(apiApp)
      .get("/api/wishlist")
      .set("Cookie", cookie)
      .expect(200);

    expect(Array.isArray(wishlistResponse.body)).toBe(true);

    const cartResponse = await request(apiApp)
      .get("/api/cart")
      .set("Cookie", cookie)
      .expect(200);

    expect(Array.isArray(cartResponse.body)).toBe(true);

    const ordersResponse = await request(apiApp)
      .get("/api/orders")
      .set("Cookie", cookie)
      .expect(200);

    expect(Array.isArray(ordersResponse.body)).toBe(true);
  });

  it("отклоняет регистрацию младше 14 лет и не создаёт пользователя", async () => {
    const email = `underage_${Date.now()}@example.com`;

    const response = await request(authApp.getHttpServer())
      .post("/api/auth/register")
      .send({
        email,
        password: "qwertyuiop",
        gender: "Male",
        dateOfBirth: birthDate(13),
      })
      .expect(400);

    expect(response.body?.message).toContain(
      "You must be at least 14 years old",
    );

    await request(authApp.getHttpServer())
      .post("/api/auth/signin")
      .send({ email, password: "qwertyuiop" })
      .expect(403);
  });

  it("принимает регистрацию ровно в 14 лет", async () => {
    const email = `exactly14_${Date.now()}@example.com`;

    await request(authApp.getHttpServer())
      .post("/api/auth/register")
      .send({
        email,
        password: "qwertyuiop",
        gender: "Female",
        dateOfBirth: birthDate(14),
      })
      .expect(200);
  });

  it("отклоняет будущую дату рождения", async () => {
    const response = await request(authApp.getHttpServer())
      .post("/api/auth/register")
      .send({
        email: `future_${Date.now()}@example.com`,
        password: "qwertyuiop",
        gender: "Male",
        dateOfBirth: birthDate(-1),
      })
      .expect(400);

    expect(response.body?.message).toContain(
      "Date of birth cannot be in the future",
    );
  });
});
