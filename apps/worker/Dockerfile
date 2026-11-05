# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.8.1
WORKDIR /app

# Cuts the workspace down to @astrum/worker and its dependency graph.
FROM base AS pruner
COPY . .
RUN pnpm turbo prune @astrum/worker --docker --out-dir /pruned

FROM base AS deps
COPY --from=pruner /pruned/json/ ./
COPY --from=pruner /pruned/pnpm-lock.yaml /pruned/pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS builder
# Placeholder only: prisma generate must never reach a real database.
ENV DATABASE_URL="postgresql://build:***@127.0.0.1:5432/build?schema=public"
COPY --from=pruner /pruned/full/ ./
RUN pnpm --filter @astrum/worker prisma:generate
RUN pnpm --filter @astrum/worker build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=pruner /pruned/json/ ./
COPY --from=pruner /pruned/pnpm-lock.yaml /pruned/pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/generated ./apps/worker/generated

EXPOSE 5580
CMD ["node", "apps/worker/dist/src/main.js"]
