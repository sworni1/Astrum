import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: { user: { create: jest.Mock; findUnique: jest.Mock } };
  let jwt: { signAsync: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    jwt = {
      signAsync: jest.fn().mockResolvedValue("signed.jwt.token"),
    };
    config = {
      get: jest.fn().mockReturnValue("test-secret"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("signToken", () => {
    it("подписывает JWT с userId и читает JWT_SECRET из ConfigService", async () => {
      const userId = "user-123";
      const result = await service.signToken(userId);

      expect(config.get).toHaveBeenCalledWith("JWT_SECRET");
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { userId },
        { expiresIn: "1d", secret: "test-secret" },
      );
      expect(result).toEqual({ token: "signed.jwt.token", expiresIn: "1d" });
    });
  });
});
