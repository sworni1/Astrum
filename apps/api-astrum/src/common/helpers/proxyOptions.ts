import { createProxyMiddleware } from "http-proxy-middleware";

const proxyOptions = (target: string) => {
  return createProxyMiddleware({
    target: target,
    changeOrigin: true,
  });
};

export default proxyOptions;
