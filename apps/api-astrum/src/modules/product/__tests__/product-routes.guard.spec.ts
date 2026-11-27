jest.mock("../../../../lib/prisma", () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

import type { Request, Response } from "express";
import { requireSession } from "../../../middlewares/resolveOwner";
import productRoutes from "../product.routes";

type Layer = {
  name: string;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ name: string }>;
  };
  handle?: { stack?: Layer[] };
};

const layersOf = (router: unknown): Layer[] =>
  (router as { stack: Layer[] }).stack;

const collectRoutes = (
  router: unknown,
): Array<{ path: string; methods: string[]; handlers: string[] }> => {
  const found: Array<{ path: string; methods: string[]; handlers: string[] }> =
    [];

  for (const layer of layersOf(router)) {
    if (layer.route) {
      found.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
        handlers: layer.route.stack.map((handler) => handler.name),
      });
      continue;
    }

    if (layer.handle?.stack) {
      found.push(...collectRoutes(layer.handle));
    }
  }

  return found;
};

describe("productRoutes write guards", () => {
  const routes = collectRoutes(productRoutes);

  it("finds the write routes it is meant to guard", () => {
    const writes = routes.filter((route) =>
      route.methods.some((method) => method !== "get"),
    );

    expect(writes.map((route) => route.path)).toEqual(
      expect.arrayContaining(["/", "/"]),
    );
    expect(writes).toHaveLength(2);
  });

  it("carries requireSession on every non GET route", () => {
    const writes = routes.filter((route) =>
      route.methods.some((method) => method !== "get"),
    );

    for (const route of writes) {
      expect(route.handlers).toContain(requireSession.name);
    }
  });

  it("leaves every read public", () => {
    const reads = routes.filter((route) =>
      route.methods.every((method) => method === "get"),
    );

    for (const route of reads) {
      expect(route.handlers).not.toContain(requireSession.name);
    }
  });

  it("answers 401 SESSION_MISSING to a write with no session (AC-6)", async () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const next = jest.fn();

    requireSession({} as Request, { status } as unknown as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "SESSION_MISSING" }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
