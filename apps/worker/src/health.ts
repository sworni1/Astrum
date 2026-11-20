import { createServer, type Server } from "node:http";

export type HealthServerOptions = {
  port: number;
  isReady: () => boolean;
  hasSmtp: boolean;
};

export type HealthServer = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

export const createHealthServer = ({
  port,
  isReady,
  hasSmtp,
}: HealthServerOptions): HealthServer => {
  const server: Server = createServer((req, res) => {
    if (!req.url?.startsWith("/health")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "not_found" }));
      return;
    }

    if (!isReady()) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "unavailable", rabbit: false }));
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rabbit: true, smtp: hasSmtp }));
  });

  return {
    start: async () => {
      await new Promise<void>((resolve) => {
        server.listen(port, resolve);
      });
    },
    stop: async () => {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
};
