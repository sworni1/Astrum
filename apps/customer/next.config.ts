import path from "node:path";
import type { NextConfig } from "next";

const apiGatewayInternal = (
  process.env.API_GATEWAY_INTERNAL_URL ?? "http://127.0.0.1:3580"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  // Trace from the workspace root so the standalone bundle keeps the monorepo
  // layout (apps/customer/server.js) instead of copying only this package.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async rewrites() {
    return [
      {
        source: "/api-gateway/:path*",
        destination: `${apiGatewayInternal}/api/:path*`,
      },
    ];
  },
  images: {
    // Next 16 narrowed the default qualities to [75]; OptimizedImage requests 85.
    qualities: [75, 85],
    // The demo catalogue is scraped from around fifty shops (ozone, fotosklad,
    // mts, citilink and more), so a fixed host list cannot cover it and any
    // product from an unlisted shop crashed the page that rendered it. A real
    // catalogue should copy images into its own storage and drop the wildcard.
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
