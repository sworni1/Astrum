jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    business: { findUnique: jest.fn() },
    order: { findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    orderItem: { update: jest.fn(), updateMany: jest.fn() },
  },
}));

import type { AddressInfo } from "node:net";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { sign } from "jsonwebtoken";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../common/helpers/logger";
import { createAuthenticateToken } from "../../../middlewares/authenticateToken";
import type { SessionStore } from "../../../session/sessionStore";
import sellerOrderRoutes, { refuseSellerWrite } from "../seller-order.routes";

const prismaMock = prisma as unknown as {
  $queryRaw: jest.Mock;
  business: { findUnique: jest.Mock };
  order: { findMany: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
  orderItem: { update: jest.Mock; updateMany: jest.Mock };
};

const JWT_SECRET = "seller-panel-read-only-secret";
const SID = "sid-1";
const USER_ID = "user-1";

const sessionStore = {
  get: jest.fn(),
} as unknown as SessionStore;

const authCookie = (): string => {
  const token = sign({ userId: USER_ID, sid: SID }, JWT_SECRET);

  return `__auth=${token}`;
};

type Harness = { close: () => Promise<void>; url: string };

const startServer = async (): Promise<Harness> => {
  const app: Express = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api", createAuthenticateToken(sessionStore), sellerOrderRoutes);

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

const sellerOrderRow = {
  id: "order-1",
  createdAt: new Date("2026-11-14T09:00:00.000Z"),
  paymentStatus: "PENDING" as const,
  paymentMethod: "ONLINE_CARD" as const,
  pickupPointId: "pp-1",
  pickupPointName: "Central",
  pickupPointAddress: "Tverskaya 12",
  handedOverAt: null,
  shippingMethod: { isPickup: true },
  OrderItem: [
    {
      id: "line-1",
      productId: "product-1",
      name: "Drill",
      previewImage: null,
      quantity: 2,
      price: 19.99,
      currency: "RUB",
      status: "CONFIRMED" as const,
    },
  ],
};

const routeWithPath = (path: string) =>
  (
    sellerOrderRoutes as unknown as {
      stack: Array<{ route?: { path: string; stack: Array<{ handle: unknown }> } }>;
    }
  ).stack.find((layer) => layer.route?.path === path);

describe("Seller panel refusals", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  beforeEach(() => {
    prismaMock.business.findUnique.mockResolvedValue({ id: "business-1" });
    prismaMock.$queryRaw.mockResolvedValue([{ total: 1 }]);
    prismaMock.order.findMany.mockResolvedValue([sellerOrderRow]);
    (sessionStore.get as jest.Mock).mockResolvedValue(
      JSON.stringify({ userId: USER_ID }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("mounts one shared handler on both write paths (AC-9)", () => {
    const handover = routeWithPath("/seller/orders/:orderId/handover");
    const status = routeWithPath("/order-items/:orderItemId/status");

    expect(handover?.route?.stack.map((layer) => layer.handle)).toEqual([
      refuseSellerWrite,
    ]);
    expect(status?.route?.stack.map((layer) => layer.handle)).toEqual([
      refuseSellerWrite,
    ]);
  });

  it("answers 404 SELLER_PANEL_READ_ONLY to a seller handover and writes nothing (AC-9)", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const server = await startServer();

    try {
      const response = await fetch(
        `${server.url}/api/seller/orders/order-1/handover?from=stale-tab`,
        {
          method: "PATCH",
          headers: { Cookie: authCookie() },
        },
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        code: "SELLER_PANEL_READ_ONLY",
        message: "Seller writes were removed; the panel is read only.",
      });
      expect(prismaMock.order.update).not.toHaveBeenCalled();
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.orderItem.update).not.toHaveBeenCalled();
      expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith({
        event: "seller.write_refused",
        userId: USER_ID,
        method: "PATCH",
        path: "/api/seller/orders/order-1/handover?from=stale-tab",
        orderId: "order-1",
      });
    } finally {
      await server.close();
    }
  });

  it("answers 404 to a seller line status change and leaves the rows untouched (AC-9)", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const rowBefore = JSON.stringify(sellerOrderRow);
    const server = await startServer();

    try {
      const response = await fetch(
        `${server.url}/api/order-items/line-1/status`,
        {
          method: "PATCH",
          headers: {
            Cookie: authCookie(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "CANCELLED" }),
        },
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        code: "SELLER_PANEL_READ_ONLY",
      });
      expect(JSON.stringify(sellerOrderRow)).toBe(rowBefore);
      expect(prismaMock.orderItem.update).not.toHaveBeenCalled();
      expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith({
        event: "seller.write_refused",
        userId: USER_ID,
        method: "PATCH",
        path: "/api/order-items/line-1/status",
        orderItemId: "line-1",
      });
    } finally {
      await server.close();
    }
  });

  it("never logs the body, a cookie or a token on a refusal (AC-9)", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const server = await startServer();

    try {
      await fetch(`${server.url}/api/seller/orders/order-1/handover`, {
        method: "PATCH",
        headers: { Cookie: authCookie() },
      });

      const fields = warn.mock.calls[0][0];

      expect(Object.keys(fields).sort()).toEqual([
        "event",
        "method",
        "orderId",
        "path",
        "userId",
      ]);
    } finally {
      await server.close();
    }
  });

  it("answers 401 with no cookie before the handler runs (AC-9)", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const server = await startServer();

    try {
      const response = await fetch(
        `${server.url}/api/order-items/line-1/status`,
        { method: "PATCH" },
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        code: "SESSION_MISSING",
      });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("serves the read with exactly the documented keys and no buyer identity (AC-6)", async () => {
    const server = await startServer();

    try {
      const response = await fetch(`${server.url}/api/seller/orders`, {
        headers: { Cookie: authCookie() },
      });
      const body = (await response.json()) as {
        orders: Array<Record<string, unknown> & { orderItems: Array<object> }>;
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };

      expect(response.status).toBe(200);
      expect(body.total).toBe(1);
      expect(Object.keys(body.orders[0]).sort()).toEqual([
        "createdAt",
        "handedOverAt",
        "id",
        "isPickup",
        "orderItems",
        "paymentMethod",
        "paymentStatus",
        "pickupPointAddress",
        "pickupPointId",
        "pickupPointName",
      ]);
      expect(Object.keys(body.orders[0].orderItems[0]).sort()).toEqual([
        "currency",
        "id",
        "name",
        "previewImage",
        "price",
        "productId",
        "quantity",
        "status",
      ]);
    } finally {
      await server.close();
    }
  });

  it("keeps the read open to a PENDING account (AC-7)", async () => {
    prismaMock.business.findUnique.mockResolvedValue({ id: "business-1" });
    const server = await startServer();

    try {
      const response = await fetch(`${server.url}/api/seller/orders`, {
        headers: { Cookie: authCookie() },
      });

      expect(response.status).toBe(200);
      expect(prismaMock.business.findUnique).toHaveBeenCalledWith({
        where: { ownerUserId: USER_ID },
        select: { id: true },
      });
    } finally {
      await server.close();
    }
  });
});
