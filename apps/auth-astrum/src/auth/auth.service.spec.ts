import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { Prisma } from "../../generated/prisma/client";
import { EventsService } from "../events/events.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    emailToken: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let events: { requestAccountConfirmation: jest.Mock };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let config: { get: jest.Mock };
  let sessions: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    ping: jest.Mock;
    incrementWithTtl: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      emailToken: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    events = {
      requestAccountConfirmation: jest.fn().mockResolvedValue(undefined),
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
      incrementWithTtl: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: RedisService, useValue: sessions },
        { provide: EventsService, useValue: events },
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

  describe("register", () => {
    const dto = {
      email: "new@astrum.test",
      password: "secret123",
      gender: "Male" as never,
      dateOfBirth: new Date("2000-01-01"),
    };

    it("AC-4: публикует событие после коммита строки пользователя", async () => {
      prisma.user.create.mockResolvedValue({
        id: "user-123",
        email: "new@astrum.test",
      });

      await service.register({ ...dto });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(events.requestAccountConfirmation).toHaveBeenCalledWith({
        userId: "user-123",
        email: "new@astrum.test",
        locale: "en",
      });
    });

    it("AC-9: carries the language of the page that registered", async () => {
      prisma.user.create.mockResolvedValue({
        id: "user-123",
        email: "new@astrum.test",
      });

      await service.register({ ...dto }, undefined, "ru");

      expect(events.requestAccountConfirmation).toHaveBeenCalledWith({
        userId: "user-123",
        email: "new@astrum.test",
        locale: "ru",
      });
    });

    it("AC-3: занятый адрес отвечает 403 EMAIL_TAKEN и не создаёт пользователя", async () => {
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "7.10.1",
        }),
      );

      await expect(service.register({ ...dto })).rejects.toMatchObject({
        response: { code: "EMAIL_TAKEN" },
      });
      expect(events.requestAccountConfirmation).not.toHaveBeenCalled();
    });
  });

  describe("confirm", () => {
    const liveToken = {
      id: "token-1",
      userId: "user-123",
      email: "a@b.c",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { email: "a@b.c", status: "PENDING" },
    };

    it("AC-8: пустой токен — invalid без обращения к базе", async () => {
      await expect(service.confirm(undefined)).resolves.toBe("invalid");
      await expect(service.confirm("   ")).resolves.toBe("invalid");
      expect(prisma.emailToken.findUnique).not.toHaveBeenCalled();
    });

    it("AC-8: неизвестный хеш — invalid", async () => {
      prisma.emailToken.findUnique.mockResolvedValue(null);

      await expect(service.confirm("unknown-token")).resolves.toBe("invalid");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("AC-8: адрес строки не равен текущему адресу пользователя — invalid", async () => {
      prisma.emailToken.findUnique.mockResolvedValue({
        ...liveToken,
        user: { email: "other@b.c", status: "PENDING" },
      });

      await expect(service.confirm("some-token")).resolves.toBe("invalid");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("AC-8: живая строка подтверждает аккаунт одним переходом", async () => {
      prisma.emailToken.findUnique.mockResolvedValue(liveToken);

      await expect(service.confirm("some-token")).resolves.toBe("ok");
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.emailToken.update).toHaveBeenCalledWith({
        where: { id: "token-1" },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { status: "ACTIVE" },
      });
    });

    it("AC-8: использованная строка на ACTIVE аккаунте — ok без второй записи", async () => {
      prisma.emailToken.findUnique.mockResolvedValue({
        ...liveToken,
        usedAt: new Date(),
        user: { email: "a@b.c", status: "ACTIVE" },
      });

      await expect(service.confirm("some-token")).resolves.toBe("ok");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("AC-8: использованная строка на PENDING аккаунте — used", async () => {
      prisma.emailToken.findUnique.mockResolvedValue({
        ...liveToken,
        usedAt: new Date(),
      });

      await expect(service.confirm("some-token")).resolves.toBe("used");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("AC-8: истёкшая строка — expired", async () => {
      prisma.emailToken.findUnique.mockResolvedValue({
        ...liveToken,
        expiresAt: new Date(Date.now() - 1_000),
      });

      await expect(service.confirm("some-token")).resolves.toBe("expired");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("resend", () => {
    it("AC-11: для PENDING публикует событие с адресом из базы", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "user-123",
        email: "a@b.c",
        status: "PENDING",
      });

      await service.resend("  A@B.C ", "203.0.113.7");

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: "a@b.c", mode: "insensitive" } },
        select: { id: true, email: true, status: true },
      });
      expect(events.requestAccountConfirmation).toHaveBeenCalledWith({
        userId: "user-123",
        email: "a@b.c",
        locale: "en",
      });
    });

    it("AC-11: неизвестный адрес ничего не публикует", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resend("nobody@b.c", "203.0.113.7"),
      ).resolves.toBeUndefined();
      expect(events.requestAccountConfirmation).not.toHaveBeenCalled();
    });

    it("AC-11: ACTIVE аккаунт ничего не публикует", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "user-123",
        email: "a@b.c",
        status: "ACTIVE",
      });

      await service.resend("a@b.c", "203.0.113.7");
      expect(events.requestAccountConfirmation).not.toHaveBeenCalled();
    });

    it("AC-11: четвёртый запрос за 15 минут упирается в лимит по адресу", async () => {
      sessions.incrementWithTtl.mockResolvedValueOnce(4);

      await service.resend("a@b.c", "203.0.113.7");

      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(events.requestAccountConfirmation).not.toHaveBeenCalled();
    });

    it("AC-11: одиннадцатый запрос за час упирается в лимит по IP", async () => {
      sessions.incrementWithTtl
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(11);

      await service.resend("a@b.c", "203.0.113.7");

      expect(events.requestAccountConfirmation).not.toHaveBeenCalled();
    });

    it("AC-11: оба счётчика считаются от TTL окна", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await service.resend("a@b.c", "203.0.113.7");

      expect(sessions.incrementWithTtl).toHaveBeenNthCalledWith(
        1,
        "rl:confirm:email:a@b.c",
        900,
      );
      expect(sessions.incrementWithTtl).toHaveBeenNthCalledWith(
        2,
        "rl:confirm:ip:203.0.113.7",
        3600,
      );
    });

    it("AC-11: сбой лимитера не публикует письмо", async () => {
      sessions.incrementWithTtl.mockRejectedValueOnce(
        new Error("connection refused"),
      );

      await expect(
        service.resend("a@b.c", "203.0.113.7"),
      ).resolves.toBeUndefined();
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(events.requestAccountConfirmation).not.toHaveBeenCalled();
    });
  });
});
