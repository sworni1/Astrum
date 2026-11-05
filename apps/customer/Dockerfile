# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.8.1 \
    && pnpm config set store-dir /pnpm/store
WORKDIR /app

# Cuts the workspace down to @astrum/customer and its dependency graph.
FROM base AS pruner
COPY . .
RUN pnpm turbo prune @astrum/customer --docker --out-dir /pruned

FROM base AS deps
COPY --from=pruner /pruned/json/ ./
COPY --from=pruner /pruned/pnpm-lock.yaml /pruned/pnpm-workspace.yaml ./
RUN --mount=type=cache,id=astrum-pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile

FROM deps AS builder
# Rewrites are compiled into the routes manifest, so both values are baked at build time.
ARG API_GATEWAY_INTERNAL_URL=http://proxy:3580
ARG NEXT_PUBLIC_API_GATEWAY_URL=/api-gateway
ENV API_GATEWAY_INTERNAL_URL=$API_GATEWAY_INTERNAL_URL \
    NEXT_PUBLIC_API_GATEWAY_URL=$NEXT_PUBLIC_API_GATEWAY_URL
COPY --from=pruner /pruned/full/ ./
RUN pnpm --filter @astrum/customer build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# outputFileTracingRoot points at the repo root, so the bundle keeps the monorepo layout.
COPY --from=builder /app/apps/customer/.next/standalone ./
COPY --from=builder /app/apps/customer/.next/static ./apps/customer/.next/static
COPY --from=builder /app/apps/customer/public ./apps/customer/public
COPY apps/customer/docker/graceful.cjs ./graceful.cjs

EXPOSE 3000
CMD ["node", "--require", "./graceful.cjs", "apps/customer/server.js"]
