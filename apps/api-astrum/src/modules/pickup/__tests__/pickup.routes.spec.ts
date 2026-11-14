import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import express from "express";
import { StatusCodes } from "http-status-codes";

jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    pickupPoint: {
      findMany: jest.fn().mockResolvedValue([
        { id: "pp-1", name: "Central Pickup", address: "Tverskaya 12" },
      ]),
    },
  },
}));

import pickupRoutes from "../pickup.routes";

const SESSION_COOKIE = "__auth=session";
const APP_SOURCE = readFileSync(join(__dirname, "../../../app.ts"), "utf8");

const counted = { value: 0 };
let server: Server;

const startApp = async (): Promise<string> => {
  const app = express();

  app.use(
    "/api",
    (req, res, next) => {
      counted.value += 1;

      if (req.headers.cookie !== SESSION_COOKIE) {
        res.status(StatusCodes.UNAUTHORIZED).json({ code: "NO_SESSION" });
        return;
      }

      next();
    },
    pickupRoutes,
  );

  server = app.listen(0);
  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

describe("pickup router", () => {
  let url = "";

  beforeAll(async () => {
    url = await startApp();
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  beforeEach(() => {
    counted.value = 0;
  });

  it("отказывает 401 без сессии и просит сессию ровно один раз (AC-3)", async () => {
    const response = await fetch(`${url}/api/pickup-points`);
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(body.code).toBe("NO_SESSION");
    expect(counted.value).toBe(1);
  });

  it("отдаёт точки под ключом points и читает сессию один раз (AC-3)", async () => {
    const response = await fetch(`${url}/api/pickup-points`, {
      headers: { cookie: SESSION_COOKIE },
    });
    const body = (await response.json()) as {
      points?: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(StatusCodes.OK);
    expect(body).toEqual({
      points: [{ id: "pp-1", name: "Central Pickup", address: "Tverskaya 12" }],
    });
    expect(counted.value).toBe(1);
  });

  it("смонтирован в цепочке /api под authenticateToken, без второго маунта (AC-3)", () => {
    const references = APP_SOURCE.match(/pickupRoutes/g) ?? [];
    const mountAt = APP_SOURCE.lastIndexOf("pickupRoutes");
    const mountStart = APP_SOURCE.lastIndexOf("app.use(", mountAt);
    const mount = APP_SOURCE.slice(mountStart, mountAt);

    expect(references).toHaveLength(2);
    expect(mount).toContain('"/api"');
    expect(mount).toContain("authenticateToken");
    expect(APP_SOURCE).not.toMatch(/app\.use\(\s*"\/api\/pickup/);
  });
});
