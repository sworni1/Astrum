jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    business: { findUnique: jest.fn(), create: jest.fn() },
  },
}));

import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../common/helpers/logger";
import { SellerOnboardingService } from "../onboarding.service";

const prismaMock = prisma as unknown as {
  business: { findUnique: jest.Mock; create: jest.Mock };
};

const service = new SellerOnboardingService();

describe("SellerOnboardingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates one shop with a biz_ id, the stored name and the owner (AC-5)", async () => {
    prismaMock.business.findUnique.mockResolvedValue(null);
    prismaMock.business.create.mockResolvedValue({
      id: "biz_created",
      name: "My Shop",
    });
    const info = jest.spyOn(logger, "info");

    const result = await service.createShop("user-1", "My Shop");

    expect(prismaMock.business.create).toHaveBeenCalledWith({
      data: {
        id: expect.stringMatching(
          /^biz_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ),
        name: "My Shop",
        ownerUserId: "user-1",
      },
      select: { id: true, name: true },
    });
    expect(result).toEqual({ isSeller: true, businessName: "My Shop" });
    expect(info).toHaveBeenCalledWith({
      event: "seller.onboarding.completed",
      userId: "user-1",
      businessId: "biz_created",
    });
  });

  it("returns the existing shop on a repeat and never renames it (AC-7)", async () => {
    prismaMock.business.findUnique.mockResolvedValue({
      id: "biz_existing",
      name: "Old Name",
    });
    const info = jest.spyOn(logger, "info");

    const result = await service.createShop("user-1", "New Name");

    expect(prismaMock.business.create).not.toHaveBeenCalled();
    expect(result).toEqual({ isSeller: true, businessName: "Old Name" });
    expect(info).not.toHaveBeenCalled();
  });

  it("answers from the winner row when the unique index decides a race (AC-7)", async () => {
    prismaMock.business.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "biz_winner", name: "Winner Name" });
    prismaMock.business.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.10.1",
      }),
    );
    const info = jest.spyOn(logger, "info");

    const result = await service.createShop("user-1", "Loser Name");

    expect(result).toEqual({ isSeller: true, businessName: "Winner Name" });
    expect(prismaMock.business.findUnique).toHaveBeenCalledTimes(2);
    expect(info).not.toHaveBeenCalled();
  });

  it("rethrows any other database failure so the route answers 500 (AC-8)", async () => {
    prismaMock.business.findUnique.mockResolvedValue(null);
    prismaMock.business.create.mockRejectedValue(new Error("connection lost"));
    const info = jest.spyOn(logger, "info");

    await expect(service.createShop("user-1", "My Shop")).rejects.toThrow(
      "connection lost",
    );
    expect(info).not.toHaveBeenCalled();
  });

  it("rethrows a unique violation that leaves no owned shop behind (AC-8)", async () => {
    prismaMock.business.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.business.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.10.1",
      }),
    );

    await expect(
      service.createShop("user-1", "My Shop"),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
