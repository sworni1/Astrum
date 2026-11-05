# syntax=docker/dockerfile:1

# One-shot image: applies Prisma migrations, then exits.
FROM node:24-bookworm-slim AS base
ENV CI=true
RUN npm install --global pnpm@12.8.1 \
    && pnpm config set store-dir /pnpm/store
WORKDIR /app

FROM base AS pruner
COPY . .
RUN pnpm turbo prune @astrum/db --docker --out-dir /pruned

FROM base AS runner
# The Prisma CLI detects the OpenSSL version through the openssl binary.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=pruner /pruned/json/ ./
COPY --from=pruner /pruned/pnpm-lock.yaml /pruned/pnpm-workspace.yaml ./
RUN --mount=type=cache,id=astrum-pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile
COPY --from=pruner /pruned/full/ ./

WORKDIR /app/packages/Astrum-db
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]
