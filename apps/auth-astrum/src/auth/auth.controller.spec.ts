import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Request, Response } from "express";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import type {
  RegisterUserDto,
  ResendConfirmationDto,
  SignInUserDto,
} from "./dto";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    signin: jest.Mock;
    logout: jest.Mock;
    confirm: jest.Mock;
    resend: jest.Mock;
  };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      signin: jest.fn(),
      logout: jest.fn(),
      confirm: jest.fn(),
      resend: jest.fn(),
    };
    config = {
      get: jest.fn().mockReturnValue("http://localhost:3000"),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("signup", () => {
    it("делегирует register в AuthService вместе с User-Agent", async () => {
      const dto: RegisterUserDto = {
        email: "a@b.c",
        password: "secret123",
        gender: "Male" as never,
        dateOfBirth: new Date("2000-01-01"),
      };
      authService.register.mockResolvedValue({ token: "t", expiresIn: "1d" });

      const result = await controller.signup(dto, "Mozilla/5.0");

      expect(authService.register).toHaveBeenCalledWith(dto, "Mozilla/5.0");
      expect(result).toEqual({ token: "t", expiresIn: "1d" });
    });
  });

  describe("signin", () => {
    it("делегирует signin в AuthService вместе с User-Agent", async () => {
      const dto: SignInUserDto = { email: "a@b.c", password: "secret123" };
      authService.signin.mockResolvedValue({ token: "t", expiresIn: "1d" });

      const result = await controller.signin(dto, "Mozilla/5.0");

      expect(authService.signin).toHaveBeenCalledWith(dto, "Mozilla/5.0");
      expect(result).toEqual({ token: "t", expiresIn: "1d" });
    });
  });

  describe("confirm", () => {
    it("AC-8: всегда отвечает 302 на страницу витрины с исходом", async () => {
      authService.confirm.mockResolvedValue("expired");
      const res = { redirect: jest.fn() };

      await controller.confirm("token-value", res as unknown as Response);

      expect(authService.confirm).toHaveBeenCalledWith("token-value");
      expect(res.redirect).toHaveBeenCalledWith(
        302,
        "http://localhost:3000/auth/confirm-email?status=expired",
      );
    });

    it("AC-8: без параметра токена всё равно редиректит, исход invalid", async () => {
      authService.confirm.mockResolvedValue("invalid");
      const res = { redirect: jest.fn() };

      await controller.confirm(undefined, res as unknown as Response);

      expect(res.redirect).toHaveBeenCalledWith(
        302,
        "http://localhost:3000/auth/confirm-email?status=invalid",
      );
    });
  });

  describe("resend", () => {
    it("AC-11: передаёт адрес и ip запроса и не возвращает тело", async () => {
      const req = { ip: "203.0.113.7" } as unknown as Request;
      const dto: ResendConfirmationDto = { email: "a@b.c" };

      await expect(controller.resend(dto, req)).resolves.toBeUndefined();
      expect(authService.resend).toHaveBeenCalledWith("a@b.c", "203.0.113.7");
    });
  });

  describe("logout", () => {
    it("AC-4: передаёт токен из cookie и не возвращает тело", async () => {
      const req = { cookies: { __auth: "good-token" } } as unknown as Request;

      await expect(controller.logout(req)).resolves.toBeUndefined();
      expect(authService.logout).toHaveBeenCalledWith("good-token");
    });

    it("AC-4: без cookie делегирует logout с undefined", async () => {
      const req = { cookies: {} } as unknown as Request;

      await controller.logout(req);

      expect(authService.logout).toHaveBeenCalledWith(undefined);
    });
  });
});
