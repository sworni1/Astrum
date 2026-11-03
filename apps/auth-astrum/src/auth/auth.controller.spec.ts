import { Test, type TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import type { RegisterUserDto, SignInUserDto } from "./dto";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: { register: jest.Mock; signin: jest.Mock };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      signin: jest.fn(),
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
    it("делегирует register в AuthService", async () => {
      const dto: RegisterUserDto = {
        email: "a@b.c",
        password: "secret123",
        gender: "Male" as never,
        dateOfBirth: new Date("2000-01-01"),
      };
      authService.register.mockResolvedValue({ token: "t", expiresIn: "1d" });

      const result = await controller.signup(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ token: "t", expiresIn: "1d" });
    });
  });

  describe("signin", () => {
    it("делегирует signin в AuthService", async () => {
      const dto: SignInUserDto = { email: "a@b.c", password: "secret123" };
      authService.signin.mockResolvedValue({ token: "t", expiresIn: "1d" });

      const result = await controller.signin(dto);

      expect(authService.signin).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ token: "t", expiresIn: "1d" });
    });
  });
});
