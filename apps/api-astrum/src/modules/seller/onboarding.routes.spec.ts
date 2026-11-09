jest.mock("../../../lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    business: { findUnique: jest.fn(), create: jest.fn() },
  },
}));

import type { AddressInfo } from "node:net";
import express, { type Express } from "express";
import { prisma } from "../../../lib/prisma";
import { requireActiveAccount } from "../../middlewares/requireActiveAccount";
import sellerOnboardingRoutes from "./onboarding.routes";

const userFindUnique = prisma.user.findUnique as unknown as jest.Mock;
const businessFindUnique = prisma.business.findUnique as unknown as jest.Mock;
const businessCreate = prisma.business.create as unknown as jest.Mock;

type Handler = { handle: unknown };
type Route = { route?: { path: string; stack: Handler[] } };

const route = (
  sellerOnboardingRoutes as unknown as { stack: Route[] }
).stack.find((layer) => layer.route?.path === "/seller/onboarding");

const handlersOf = (target: typeof route): unknown[] =>
  target?.route?.stack.map((layer) => layer.handle) ?? [];

const startServer = async (): Promise<{
  close: () => Promise<void>;
  url: string;
}> => {
  const app: Express = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { userId: string }).userId = "user-1";
    next();
  });
  app.use("/api", sellerOnboardingRoutes);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
};

const post = async (url: string, body: unknown) => {
  const response = await fetch(`${url}/api/seller/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return { status: response.status, body: await response.json() };
};

describe("POST /api/seller/onboarding", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    userFindUnique.mockReset();
    businessFindUnique.mockReset();
    businessCreate.mockReset();
  });

  it("mounts the account gate before the body validation (AC-5)", () => {
    const handlers = handlersOf(route);

    expect(handlers).toHaveLength(3);
    expect(handlers[0]).toBe(requireActiveAccount);
  });

  it("refuses a PENDING account with 403 and creates nothing, even with an invalid body (AC-8)", async () => {
    userFindUnique.mockResolvedValue({ status: "PENDING" });
    const server = await startServer();

    try {
      const answer = await post(server.url, {});

      expect(answer.status).toBe(403);
      expect(answer.body).toMatchObject({ code: "EMAIL_NOT_CONFIRMED" });
      expect(businessCreate).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("creates the shop for an ACTIVE account and answers the stored name (AC-5)", async () => {
    userFindUnique.mockResolvedValue({ status: "ACTIVE" });
    businessFindUnique.mockResolvedValue(null);
    businessCreate.mockResolvedValue({ id: "biz_1", name: "My Shop" });
    const server = await startServer();

    try {
      const answer = await post(server.url, { name: "  My   Shop  " });

      expect(answer.status).toBe(200);
      expect(answer.body).toEqual({ isSeller: true, businessName: "My Shop" });
      expect(businessCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "My Shop",
            ownerUserId: "user-1",
          }),
        }),
      );
    } finally {
      await server.close();
    }
  });

  it("answers 422 VALIDATION with a name field error and creates nothing (AC-6)", async () => {
    userFindUnique.mockResolvedValue({ status: "ACTIVE" });
    const server = await startServer();

    try {
      const answer = await post(server.url, { name: "A" });

      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({
        code: "VALIDATION",
        errors: [{ property: "name" }],
      });
      expect(businessCreate).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("answers 500 and keeps the error shape on a database failure (AC-8)", async () => {
    userFindUnique.mockResolvedValue({ status: "ACTIVE" });
    businessFindUnique.mockResolvedValue(null);
    businessCreate.mockRejectedValue(new Error("connection lost"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const server = await startServer();

    try {
      const answer = await post(server.url, { name: "My Shop" });

      expect(answer.status).toBe(500);
      expect(answer.body).toMatchObject({
        message: "Internal Server Error",
      });
    } finally {
      await server.close();
    }
  });
});
