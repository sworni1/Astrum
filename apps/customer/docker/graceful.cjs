// Graceful shutdown wrapper for the Next.js standalone server.
// The generated server.js does not close its HTTP server on SIGTERM, so listen()
// is patched to keep a reference and drain in-flight requests before exit.
const http = require("node:http");

const SHUTDOWN_TIMEOUT_MS = 10_000;
const originalListen = http.Server.prototype.listen;

http.Server.prototype.listen = function listen(...args) {
  const server = this;

  const shutdown = () => {
    console.log("[customer] SIGTERM received, draining connections");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return originalListen.apply(this, args);
};
