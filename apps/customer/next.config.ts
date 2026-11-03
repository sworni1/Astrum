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
    remotePatterns: [
      new URL("https://flowbite.s3.amazonaws.com/docs/gallery/**"),
      new URL("https://bundui-images.netlify.app/**"),
      new URL("https://images.unsplash.com/**"),
      new URL("http://magazilla.ru/**"),
      new URL("https://magazilla.ru/**"),
      new URL("http://mzimg.com/**"),
      new URL("https://mzimg.com/**"),
    ],
  },
};

export default nextConfig;
