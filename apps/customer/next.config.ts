import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const apiGatewayInternal = (
  process.env.API_GATEWAY_INTERNAL_URL ?? "http://127.0.0.1:3580"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",

  outputFileTracingRoot: path.join(__dirname, "../../"),

  experimental: {
    agentUpgrade: "security",
  },
  async rewrites() {
    return [
      {
        source: "/api-gateway/:path*",
        destination: `${apiGatewayInternal}/api/:path*`,
      },
    ];
  },
  images: {
    qualities: [75, 85],

    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default withNextIntl(nextConfig);
