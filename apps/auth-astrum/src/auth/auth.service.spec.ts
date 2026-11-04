import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: { user: { create: jest.Mock; findUnique: jest.Mock } };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let config: { get: jest.Mock };
  let sessions: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    ping: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    jwt = {
      signAsync: jest.fn().mockResolvedValue("signed.jwt.token"),
      verifyAsync: jest.fn(),
    };
    config = {
      get: jest.fn().mockReturnValue("test-secret"),
    };
    sessions = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue("OK"),
      del: jest.fn().mockResolvedValue(1),
      ping: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: RedisService, useValue: sessions },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("signToken", () => {
    it("AC-1: пишет запись сессии с TTL 86400 до подписи и кладёт sid в токен", async () => {
      const result = await service.signToken("user-123", "Mozilla/5.0");

      expect(sessions.set).toHaveBeenCalledTimes(1);

      const [key, payload, ttl] = sessions.set.mock.calls[0] as [
        string,
        string,
        number,
      ];

      expect(key).toMatch(/^session:[\w-]{43}$/);
      expect(ttl).toBe(86_400);
      expect(JSON.parse(payload)).toEqual({
        userId: "user-123",
        createdAt: expect.any(String),
        userAgent: "Mozilla/5.0",
      });

      const sid = key.slice("session:".length);

      expect(config.get).toHaveBeenCalledWith("JWT_SECRET");
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { userId: "user-123", sid },
        { expiresIn: "1d", secret: "test-secret" },
      );
      expect(result).toEqual({ token: "signed.jwt.token", expiresIn: "1d" });
    });

    it("AC-1: обрезает userAgent до 512 символов и пишет null без заголовка", async () => {
      await service.signToken("user-123", "a".repeat(600));
      await service.signToken("user-123");

      const longAgent = JSON.parse(sessions.set.mock.calls[0][1] as string);
      const noAgent = JSON.parse(sessions.set.mock.calls[1][1] as string);

      expect((longAgent.userAgent as string).length).toBe(512);
      expect(noAgent.userAgent).toBeNull();
    });

    it("AC-14: отвечает 503 SESSION_STORE_UNAVAILABLE и не выдаёт токен, если запись не удалась", async () => {
      sessions.set.mockRejectedValueOnce(new Error("connection refused"));

      await expect(service.signToken("user-123")).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it("AC-6: каждая подпись даёт новый sid", async () => {
      await service.signToken("user-123");
      await service.signToken("user-123");

      expect(sessions.set.mock.calls[0][0]).not.toBe(
        sessions.set.mock.calls[1][0],
      );
    });
  });

  describe("logout", () => {
    it("AC-4: удаляет запись по sid из проверенного токена", async () => {
      jwt.verifyAsync.mockResolvedValueOnce({
        userId: "user-123",
        sid: "sid-abc",
      });

      await service.logout("good-token");

      expect(sessions.del).toHaveBeenCalledWith("session:sid-abc");
    });

    it("AC-4: без токена или с невалидным токеном ничего не удаляет", async () => {
      jwt.verifyAsync.mockRejectedValueOnce(new Error("invalid signature"));

      await service.logout(undefined);
      await service.logout("broken-token");

      expect(sessions.del).not.toHaveBeenCalled();
    });

    it("AC-4: сбой хранилища не превращается в ошибку ответа", async () => {
      jwt.verifyAsync.mockResolvedValueOnce({
        userId: "user-123",
        sid: "sid-abc",
      });
      sessions.del.mockRejectedValueOnce(new Error("connection refused"));

      await expect(service.logout("good-token")).resolves.toBeUndefined();
    });
  });
});
