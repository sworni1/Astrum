import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  it("класс определён и декорирован @Injectable", () => {
    expect(PrismaService).toBeDefined();

    expect(typeof PrismaService).toBe("function");
  });

  it("метод cleandb существует", () => {
    expect(typeof PrismaService.prototype.cleandb).toBe("function");
  });
});
