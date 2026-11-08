jest.mock("../../../lib/prisma", () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

import { prisma } from "../../../lib/prisma";
import type { SessionStore } from "../../session/sessionStore";
import { UserService } from "./user.service";

const findUnique = prisma.user.findUnique as unknown as jest.Mock;

const baseUser = {
  nickName: "ivan",
  email: "ivan@example.com",
  dateOfBirth: new Date("2000-01-01T00:00:00.000Z"),
  gender: "MALE",
  status: "ACTIVE",
};

describe("UserService.userInfo", () => {
  const service = new UserService({} as SessionStore);

  beforeEach(() => {
    findUnique.mockReset();
  });

  it("answers isSeller true for the owner of a business (AC-2)", async () => {
    findUnique.mockResolvedValue({ ...baseUser, business: { id: "biz-1" } });

    const result = await service.userInfo("user-1");

    expect(result).toEqual({ ...baseUser, isSeller: true });
  });

  it("answers isSeller false without a business and keeps the account state (AC-2)", async () => {
    findUnique.mockResolvedValue({
      ...baseUser,
      status: "PENDING",
      business: null,
    });

    const result = await service.userInfo("user-1");

    expect(result).toEqual({
      ...baseUser,
      status: "PENDING",
      isSeller: false,
    });
  });

  it("exposes no business identifier (AC-2)", async () => {
    findUnique.mockResolvedValue({ ...baseUser, business: { id: "biz-1" } });

    const result = await service.userInfo("user-1");

    expect(result).not.toHaveProperty("business");
    expect(JSON.stringify(result)).not.toContain("biz-1");
  });

  it("derives the flag from the owner column of the current row (AC-2)", async () => {
    findUnique.mockResolvedValue({ ...baseUser, business: null });

    await service.userInfo("user-1");

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: expect.objectContaining({ business: { select: { id: true } } }),
    });
  });
});
