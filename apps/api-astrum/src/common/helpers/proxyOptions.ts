import { createProxyMiddleware } from "http-proxy-middleware";

type ProxyOptionsParams = {
  readonly pathRewrite?: Record<string, string>;
};

const proxyOptions = (target: string, params: ProxyOptionsParams = {}) => {
  return createProxyMiddleware({
    target: target,
    changeOrigin: true,
    ...(params.pathRewrite ? { pathRewrite: params.pathRewrite } : {}),
  });
};

export default proxyOptions;
