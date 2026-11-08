import express, { type Express } from "express";

jest.mock("../../../lib/prisma", () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

jest.mock("./seller-order-workflow.config", () => ({
  requireSellerOrderWorkflow: (
    _req: unknown,
    _res: unknown,
    next: () => void,
  ) => next(),
  parseSellerOrderWorkflowEnabled: () => true,
  createRequireSellerOrderWorkflow:
    () => (_req: unknown, _res: unknown, next: () => void) =>
      next(),
}));

import type { AddressInfo } from "node:net";
import { prisma } from "../../../lib/prisma";
import { requireActiveAccount } from "../../middlewares/requireActiveAccount";
import { requireSellerOrderWorkflow } from "./seller-order-workflow.config";
import { SellerOrderService } from "./seller-order.service";
import sellerOrderRoutes from "./seller-order.routes";

const findUnique = prisma.user.findUnique as unknown as jest.Mock;

const patchRoute = (
  sellerOrderRoutes as unknown as {
    stack: Array<{
      route?: { path: string; stack: Array<{ handle: unknown }> };
    }>;
  }
).stack.find(
  (layer) => layer.route?.path === "/order-items/:orderItemId/status",
);

const getRoute = (
  sellerOrderRoutes as unknown as {
    stack: Array<{
      route?: { path: string; stack: Array<{ handle: unknown }> };
    }>;
  }
).stack.find((layer) => layer.route?.path === "/seller/orders");

const handlersOf = (route: typeof patchRoute): unknown[] =>
  route?.route?.stack.map((layer) => layer.handle) ?? [];

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
  app.use("/api", sellerOrderRoutes);

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

describe("Seller route access gate", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    findUnique.mockReset();
  });

  it("mounts the account gate on the write before the workflow check (AC-13)", () => {
    const handlers = handlersOf(patchRoute);
    const gateIndex = handlers.indexOf(requireActiveAccount);
    const workflowIndex = handlers.indexOf(requireSellerOrderWorkflow);

    expect(gateIndex).toBeGreaterThanOrEqual(0);
    expect(workflowIndex).toBeGreaterThanOrEqual(0);
    expect(gateIndex).toBeLessThan(workflowIndex);
  });

  it("keeps the read route open to any account state (AC-13)", () => {
    expect(handlersOf(getRoute)).not.toContain(requireActiveAccount);
  });

  it("refuses the write of a PENDING account and changes nothing (AC-13)", async () => {
    findUnique.mockResolvedValue({ status: "PENDING" });
    const change = jest
      .spyOn(SellerOrderService.prototype, "updateSellerOrderItemStatus")
      .mockResolvedValue({} as never);
    const server = await startServer();

    try {
      const response = await fetch(
        `${server.url}/api/order-items/line-1/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CONFIRMED" }),
        },
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        code: "EMAIL_NOT_CONFIRMED",
      });
      expect(change).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("serves the read to a PENDING account (AC-13)", async () => {
    findUnique.mockResolvedValue({ status: "PENDING" });
    jest
      .spyOn(SellerOrderService.prototype, "getSellerOrders")
      .mockResolvedValue({
        orders: [{ id: "order-1", createdAt: new Date(0), orderItems: [] }],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    const server = await startServer();

    try {
      const response = await fetch(`${server.url}/api/seller/orders`);
      const body = (await response.json()) as {
        total: number;
        orders: unknown[];
      };

      expect(response.status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.orders).toHaveLength(1);
    } finally {
      await server.close();
    }
  });
});
