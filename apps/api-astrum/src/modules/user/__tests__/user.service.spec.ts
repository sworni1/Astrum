jest.mock("../../../../lib/prisma", () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

import { prisma } from "../../../../lib/prisma";
import type { SessionStore } from "../../../session/sessionStore";
import { UserService } from "../user.service";

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
    findUnique.mockResolvedValue({
      ...baseUser,
      business: { id: "biz-1" },
      pointWorker: null,
      courier: null,
    });

    const result = await service.userInfo("user-1");

    expect(result).toEqual({ ...baseUser, isSeller: true, staffRoles: [] });
  });

  it("answers isSeller false without a business and keeps the account state (AC-2)", async () => {
    findUnique.mockResolvedValue({
      ...baseUser,
      status: "PENDING",
      business: null,
      pointWorker: null,
      courier: null,
    });

    const result = await service.userInfo("user-1");

    expect(result).toEqual({
      ...baseUser,
      status: "PENDING",
      isSeller: false,
      staffRoles: [],
    });
  });

  it("exposes no business identifier (AC-2)", async () => {
    findUnique.mockResolvedValue({
      ...baseUser,
      business: { id: "biz-1" },
      pointWorker: null,
      courier: null,
    });

    const result = await service.userInfo("user-1");

    expect(result).not.toHaveProperty("business");
    expect(JSON.stringify(result)).not.toContain("biz-1");
  });

  it("derives the flag from the owner column of the current row (AC-2)", async () => {
    findUnique.mockResolvedValue({
      ...baseUser,
      business: null,
      pointWorker: null,
      courier: null,
    });

    await service.userInfo("user-1");

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: expect.objectContaining({ business: { select: { id: true } } }),
    });
  });

  it("carries one staff role without a business (AC-11)", async () => {
    findUnique.mockResolvedValue({
      ...baseUser,
      business: null,
      pointWorker: { id: "pw-1" },
      courier: null,
    });

    const result = await service.userInfo("user-1");

    expect(result).toEqual({
      ...baseUser,
      isSeller: false,
      staffRoles: ["POINT_WORKER"],
    });
  });

  it("lists both roles in the fixed order and exposes no row id (AC-11)", async () => {
    findUnique.mockResolvedValue({
      ...baseUser,
      business: null,
      pointWorker: { id: "pw-1" },
      courier: { id: "c-1" },
    });

    const result = await service.userInfo("user-1");

    expect(result.staffRoles).toEqual(["POINT_WORKER", "COURIER"]);
    expect(result).not.toHaveProperty("pointWorker");
    expect(result).not.toHaveProperty("courier");
    expect(JSON.stringify(result)).not.toContain("pw-1");
  });

  it("reads both relations in the one query that answers the profile (AC-11)", async () => {
    findUnique.mockResolvedValue({
      ...baseUser,
      business: null,
      pointWorker: null,
      courier: null,
    });

    await service.userInfo("user-1");

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: expect.objectContaining({
        pointWorker: { select: { id: true } },
        courier: { select: { id: true } },
      }),
    });
  });
});
