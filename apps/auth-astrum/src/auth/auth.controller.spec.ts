import { Test, type TestingModule } from "@nestjs/testing";
import type { Request } from "express";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import type { RegisterUserDto, SignInUserDto } from "./dto";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    signin: jest.Mock;
    logout: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      signin: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
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
