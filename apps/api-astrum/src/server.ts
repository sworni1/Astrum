import "reflect-metadata";
import type { Server } from "node:http";
import { prisma } from "../lib/prisma";
import app from "./app";

const PORT = Number(process.env.API_PORT ?? 3580);
const SHUTDOWN_TIMEOUT_MS = 10_000;

const server: Server = app.listen(PORT, () => {
  console.log(`API Gateway running at http://localhost:${PORT}/api`);
});

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`[api] ${signal} received, draining connections`);

  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });

  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
