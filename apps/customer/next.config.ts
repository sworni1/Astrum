import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
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
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
